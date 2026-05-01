"""
Activity-tracking middleware.

Two complementary middlewares feed the admin "Active in last 24h" KPI:

* ``UserActivityMiddleware`` — bumps ``User.last_seen_at`` on each
  authenticated request.
* ``AnonymousActivityMiddleware`` — sets a long-lived random cookie on
  the first request from an unauthenticated browser and bumps a
  matching ``AnonymousSession.last_seen_at`` row on each request.

Both are aggressively throttled via the local-memory cache so the
hot request path issues at most one extra DB write per minute per
visitor. Tracking is best-effort: any exception is swallowed so a
failure here can never break the request.

The cookie name and TTL are deliberately conservative — long enough
that returning visitors aren't double-counted across sessions, short
enough that a single shared device doesn't keep a unique-visitor
slot forever.
"""
from __future__ import annotations

import logging
import uuid

from django.core.cache import cache
from django.utils import timezone
from django.utils.deprecation import MiddlewareMixin

logger = logging.getLogger(__name__)


# How often we're willing to issue a DB write per visitor, in seconds.
# 60s gives the dashboard near-real-time accuracy without hammering
# Postgres on every API call. Anything finer-grained would be wasted
# precision for a 24h rolling window.
_THROTTLE_SECONDS = 60

# Cookie that identifies a unique anonymous browser. UUIDv4 → 36 bytes
# of opaque text. We avoid signing because the cookie value is just a
# tracking handle — there's nothing to forge.
_ANON_COOKIE_NAME = "ee_anon_id"

# 90 days — long enough that a returning monthly visitor isn't counted
# as a brand-new session, short enough that a shared family device
# doesn't keep a session row alive forever.
_ANON_COOKIE_MAX_AGE = 60 * 60 * 24 * 90


def _seen_recently(cache_key: str) -> bool:
    """Return True if we've recorded activity for this key within the
    throttle window.

    Atomically claims the next throttle window via ``cache.add`` so
    only one request per visitor per minute makes it through to the
    DB write. Any cache backend failure is silently ignored — we'd
    rather over-write than skip tracking entirely.
    """
    try:
        # cache.add returns True only if the key was empty. If it was
        # already populated by a recent request we've seen them
        # already; bail out without touching the DB.
        return not cache.add(cache_key, 1, timeout=_THROTTLE_SECONDS)
    except Exception:
        return False


class UserActivityMiddleware(MiddlewareMixin):
    """Bump ``User.last_seen_at`` for authenticated requests.

    Placed near the bottom of the MIDDLEWARE chain so the auth
    middleware (and DRF auth, which runs at view time) has had a
    chance to attach a user. We touch the DB at most once per user
    per ``_THROTTLE_SECONDS`` interval.
    """

    def process_response(self, request, response):
        try:
            user = getattr(request, "user", None)
            if not user or not getattr(user, "is_authenticated", False):
                return response

            user_id = getattr(user, "pk", None)
            if user_id is None:
                return response

            cache_key = f"last_seen:user:{user_id}"
            if _seen_recently(cache_key):
                return response

            # Bypass save() / signals — we don't want this hot path
            # firing user post_save handlers (premium recompute, etc.)
            # 60 times an hour per active user.
            now = timezone.now()
            from django.contrib.auth import get_user_model
            User = get_user_model()
            User.objects.filter(pk=user_id).update(last_seen_at=now)
        except Exception:
            # Activity tracking must never break a request. Log at
            # debug so we don't spam production logs if the DB or
            # cache is briefly unavailable.
            logger.debug("UserActivityMiddleware: tracking write failed", exc_info=True)

        return response


class AnonymousActivityMiddleware(MiddlewareMixin):
    """Set/refresh an anonymous-visitor cookie and bump its activity row.

    Skipped for authenticated requests so we don't double-count a
    user who is also touching the same browser. Skipped for non-GET
    safe-side-effect-free requests... actually, no — we want POST
    activity counted too (someone hitting /auth/register/ is an
    active user). The only thing we *don't* want is the dashboard's
    own polling loop self-incrementing a session forever, but the
    throttle takes care of that.

    The cookie is set lazily on the response so we only mint it for
    visitors whose request actually reached our app (vs. CDN
    short-circuits, OPTIONS preflights, etc.).
    """

    def process_response(self, request, response):
        try:
            user = getattr(request, "user", None)
            if user and getattr(user, "is_authenticated", False):
                return response

            # Skip CORS preflights — the browser issues these without
            # cookies anyway, and they're not "visits" in any
            # meaningful sense.
            if request.method == "OPTIONS":
                return response

            anon_id = request.COOKIES.get(_ANON_COOKIE_NAME)
            is_new = False
            if not anon_id:
                anon_id = uuid.uuid4().hex
                is_new = True
            else:
                # Defensive: if a malformed cookie sneaks in, replace it
                # rather than fail downstream lookups.
                try:
                    uuid.UUID(anon_id)
                except (ValueError, AttributeError):
                    anon_id = uuid.uuid4().hex
                    is_new = True

            cache_key = f"last_seen:anon:{anon_id}"
            should_write = is_new or not _seen_recently(cache_key)

            if should_write:
                from apps.analytics.models import AnonymousSession
                now = timezone.now()
                AnonymousSession.objects.update_or_create(
                    id=uuid.UUID(anon_id),
                    defaults={"last_seen_at": now},
                )

            if is_new:
                # Set the cookie on the way out. ``samesite=Lax`` keeps
                # it from being sent on top-level cross-site requests
                # (which would inflate counts via embeds), while still
                # surviving same-site navigation. ``httponly`` because
                # nothing in the frontend needs to read it. ``secure``
                # is mirrored off the request scheme so local dev over
                # http still works, but production HTTPS visitors get
                # a cookie that won't leak over an accidental http
                # request.
                response.set_cookie(
                    _ANON_COOKIE_NAME,
                    anon_id,
                    max_age=_ANON_COOKIE_MAX_AGE,
                    samesite="Lax",
                    httponly=True,
                    secure=request.is_secure(),
                )
        except Exception:
            logger.debug(
                "AnonymousActivityMiddleware: tracking write failed",
                exc_info=True,
            )

        return response
