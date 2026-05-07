import hashlib
import random
from datetime import timedelta

from django.contrib.contenttypes.models import ContentType
from django.core.cache import cache
from django.db.models import Case, Count, F, IntegerField, Q, Sum, Value, When
from django.utils import timezone
from rest_framework import filters, generics, permissions
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response

from apps.library.models import Favorite, ListeningHistory, PodcastFollowing
from apps.podcasts.models import Podcast
from .models import Episode
from .serializers import EpisodeSerializer


# ── Recommendation profile cache ───────────────────────────────────────
# The profile build is a handful of bounded queries (all keyed on
# user.id with covering indexes) plus a tight Python loop over the
# user's listening history. It's not expensive in absolute terms, but
# it runs on every For You / Discover Recommended page load. A short
# cache window collapses bursts of activity (home → episode page →
# back → home, or scroll-paginating Discover) into a single profile
# computation per user.
#
# Invalidation is triggered by signals in apps/library/signals.py
# whenever a follow / favorite / new listening-history row lands. The
# TTL is the safety net: even without signals (e.g. cross-worker on
# LocMemCache, or future deploys before signals reload), stale profiles
# self-heal within RECO_PROFILE_TTL seconds.
#
# 60s TTL: cache busting via signals only propagates within the worker
# that received the write. With multiple gunicorn workers on a per-
# process LocMemCache, sibling workers keep a stale profile until their
# own copy expires. Five minutes was long enough for "I just played
# something and the For You feed didn't change" to be a recurring
# complaint; 60s is short enough that staleness is bounded to a single
# refresh while still amortizing the profile build across the bursty
# fan-out from a single page paint (home rows + Discover prefetch).
RECO_PROFILE_CACHE_VERSION = 2
RECO_PROFILE_TTL = 60


def _reco_profile_cache_key(user_id):
    return f"reco:profile:v{RECO_PROFILE_CACHE_VERSION}:{user_id}"


def bust_reco_profile_cache(user_id):
    """Drop a user's cached recommendation profile.

    Public so signal handlers in other apps can call it without
    importing the cache key format. Safe to call with ``None`` (no-op).
    """
    if user_id is None:
        return
    cache.delete(_reco_profile_cache_key(user_id))


TREND_WINDOW_MIN_HOURS = 24
TREND_WINDOW_MAX_HOURS = 72
DEFAULT_TREND_WINDOW_HOURS = 48
DEFAULT_TREND_MIN_VOLUME = 10

# How far back to look when building the listener profile from history.
# Older listens still count toward "what shows you've touched" (so we can
# exclude them) but only the last RECOMMENDED_PROFILE_DAYS contribute to
# scoring weights, so the feed adapts as taste shifts over time.
RECOMMENDED_PROFILE_DAYS = 90

# Cap the number of podcasts we map into the SQL Case/When expression.
# A user with thousands of followed/listened-to podcasts would otherwise
# blow up the query size. Top-N preserves the strongest signals.
RECOMMENDED_PODCAST_SCORE_CAP = 250

class RecommendedFeedPagination(PageNumberPagination):
    """Dedicated pagination for /episodes/recommended/.

    The shared StandardResultsSetPagination caps page_size at 100, which
    artificially shrinks the For You feed everywhere. This class is only
    used by the recommendation endpoint so we can serve a deeper feed
    without affecting any other API surface.
    """

    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 250

    def get_paginated_response(self, data):
        return Response({
            "links": {
                "next": self.get_next_link(),
                "previous": self.get_previous_link(),
            },
            "count": self.page.paginator.count,
            "total_pages": self.page.paginator.num_pages,
            "current_page": self.page.number,
            "results": data,
        })


def _clamp_int(value, default, minimum, maximum):
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return default
    return max(minimum, min(maximum, parsed))


def _is_premium_user(user):
    if not user or not getattr(user, "is_authenticated", False):
        return False
    return bool(getattr(user, "is_premium_member", lambda: getattr(user, "is_premium", False))())


def _audiobook_podcast_ids_queryset():
    return Podcast.objects.filter(
        Q(categories__slug__iexact="audiobook")
        | Q(categories__slug__iexact="audiobooks")
        | Q(categories__name__iexact="audiobook")
        | Q(categories__name__iexact="audiobooks")
    ).values_list("id", flat=True)


def _base_non_audiobook_queryset():
    return (
        Episode.objects.select_related("podcast", "podcast__creator")
        .exclude(podcast_id__in=_audiobook_podcast_ids_queryset())
        .filter(published_at__lte=timezone.now())
    )


def _build_user_profile(user):
    """Cached entry point for the recommendation profile.

    See ``_compute_user_profile`` for the actual signal aggregation.
    The cache is short-lived and signal-busted on profile-relevant
    writes; it exists so that a single page paint that fans out to
    multiple recommended-feed requests (home row + Discover prefetch,
    say) doesn't rebuild the profile per request.
    """
    if not user or not getattr(user, "id", None):
        return _compute_user_profile(user)

    cache_key = _reco_profile_cache_key(user.id)
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    profile = _compute_user_profile(user)
    # Profiles are picklable (sets of ints, dicts of {int: float}).
    # We store even empty profiles so brand-new accounts don't pay for
    # a rebuild on every refresh during their first session.
    cache.set(cache_key, profile, RECO_PROFILE_TTL)
    return profile


def _compute_user_profile(user):
    """Build a recommendation profile from every signal we already collect.

    Pulls follows, favorites, and engagement-weighted listening history,
    then derives category and creator preferences from the union of those
    podcasts. Returns a dict consumed by ``_compute_podcast_scores``.

    Engagement weighting uses both ``progress / duration`` and the
    ``completed`` flag, with a recency decay over RECOMMENDED_PROFILE_DAYS.
    A finished 60-minute episode counts much more than a 30-second tap.
    """
    now = timezone.now()
    profile = {
        "listened_episode_ids": set(),
        "podcast_engagement": {},
        "followed_podcast_ids": set(),
        "favorite_podcast_ids": set(),
        # Podcasts derived from the user's favorited *episodes*. Episode
        # favorites used to be invisible to the ranker (the algorithm
        # only looked at podcast-level favorites), so a user who tapped
        # the heart on a dozen episodes would still hit cold-start and
        # see the global popularity list. We now roll those favorites
        # up to their parent podcast and feed them into the same
        # interested_podcast_ids set as podcast follows / favorites.
        "favorite_episode_podcast_ids": set(),
        "category_weights": {},
        "creator_weights": {},
    }

    history_rows = list(
        ListeningHistory.objects.filter(user=user).values(
            "episode_id",
            "episode__podcast_id",
            "progress",
            "duration",
            "completed",
            "last_played",
        )
    )

    for row in history_rows:
        episode_id = row.get("episode_id")
        podcast_id = row.get("episode__podcast_id")
        if episode_id:
            profile["listened_episode_ids"].add(episode_id)
        if not podcast_id:
            continue

        last_played = row.get("last_played")
        if not last_played:
            continue
        days_ago = (now - last_played).days
        if days_ago < 0 or days_ago > RECOMMENDED_PROFILE_DAYS:
            continue

        # Linear recency decay: 1.0 at 0d → ~0.3 at the cutoff.
        recency_factor = max(0.3, 1.0 - (days_ago / float(RECOMMENDED_PROFILE_DAYS + 30)))

        progress = row.get("progress") or 0
        duration = row.get("duration") or 0
        if row.get("completed"):
            engagement_factor = 1.0
        elif duration > 0:
            engagement_factor = max(0.05, min(1.0, progress / float(duration)))
        elif progress > 60:
            engagement_factor = 0.3
        else:
            engagement_factor = 0.1

        weight = recency_factor * engagement_factor
        profile["podcast_engagement"][podcast_id] = (
            profile["podcast_engagement"].get(podcast_id, 0.0) + weight
        )

    profile["followed_podcast_ids"] = set(
        PodcastFollowing.objects.filter(user=user).values_list("podcast_id", flat=True)
    )

    podcast_ct = ContentType.objects.get_for_model(Podcast)
    profile["favorite_podcast_ids"] = set(
        Favorite.objects.filter(user=user, content_type=podcast_ct)
        .values_list("object_id", flat=True)
    )

    # Episode favorites — roll up to the parent podcast so a user who
    # only ever favorites individual episodes still produces signal.
    # Without this, hearting episodes does literally nothing to the
    # ranking and the feed feels broken ("I favorited five episodes
    # and the order didn't budge").
    episode_ct = ContentType.objects.get_for_model(Episode)
    favorite_episode_ids = list(
        Favorite.objects.filter(user=user, content_type=episode_ct)
        .values_list("object_id", flat=True)
    )
    if favorite_episode_ids:
        profile["favorite_episode_podcast_ids"] = set(
            Episode.objects.filter(id__in=favorite_episode_ids)
            .values_list("podcast_id", flat=True)
        )

    interested_podcast_ids = (
        set(profile["podcast_engagement"].keys())
        | profile["followed_podcast_ids"]
        | profile["favorite_podcast_ids"]
        | profile["favorite_episode_podcast_ids"]
    )
    if interested_podcast_ids:
        # Per-podcast taste weight used to derive category/creator
        # preferences. Follows are the strongest explicit signal, then
        # podcast favorites, then episode-level favorites (a softer
        # "I liked this thing" than starring the whole show), then
        # accumulated engagement.
        def _podcast_weight(pid):
            base = profile["podcast_engagement"].get(pid, 0.0)
            if pid in profile["followed_podcast_ids"]:
                base = max(base, 1.0)
            elif pid in profile["favorite_podcast_ids"]:
                base = max(base, 0.7)
            elif pid in profile["favorite_episode_podcast_ids"]:
                base = max(base, 0.5)
            return base

        for pid, cat_id in (
            Podcast.objects.filter(id__in=interested_podcast_ids)
            .values_list("id", "categories__id")
        ):
            if cat_id is None:
                continue
            profile["category_weights"][cat_id] = (
                profile["category_weights"].get(cat_id, 0.0) + _podcast_weight(pid)
            )

        for pid, creator_id in (
            Podcast.objects.filter(id__in=interested_podcast_ids)
            .values_list("id", "creator_id")
        ):
            if creator_id is None:
                continue
            profile["creator_weights"][creator_id] = (
                profile["creator_weights"].get(creator_id, 0.0) + _podcast_weight(pid)
            )

    return profile


def _compute_podcast_scores(profile):
    """Score every podcast that *could* plausibly match the profile.

    The scoreable set is derived from the profile itself, not from the
    candidate episode pool, so the per-request cost is bounded by user
    behavior rather than catalog size. We score:
      * Explicit matches: follows ∪ favorites ∪ engaged-with shows.
      * Category matches: shows in the user's top categories.
      * Creator matches: shows by the user's preferred creators.
    Anything outside this set has a personalization score of 0 and
    relies on the recency / popularity components to rank.

    Components:
      * Follow:    +60  (explicit "I want more of this show")
      * Favorite:  +35
      * History:   up to +75 (engagement-weighted, capped)
      * Category:  up to +24 (capped overlap)
      * Creator:   up to +36 (capped overlap)

    Returns ``dict[podcast_id, float]`` for podcasts with non-zero score.
    """
    explicit_pids = (
        set(profile["podcast_engagement"].keys())
        | profile["followed_podcast_ids"]
        | profile["favorite_podcast_ids"]
        | profile["favorite_episode_podcast_ids"]
    )

    # Cap category and creator expansion so a user with extremely broad
    # taste still produces a bounded scoreable set. Top-K by weight keeps
    # the strongest signals.
    top_category_ids = [
        cid for cid, _ in sorted(
            profile["category_weights"].items(),
            key=lambda kv: kv[1],
            reverse=True,
        )[:25]
    ]
    top_creator_ids = [
        cid for cid, _ in sorted(
            profile["creator_weights"].items(),
            key=lambda kv: kv[1],
            reverse=True,
        )[:50]
    ]

    category_pids = set()
    if top_category_ids:
        category_pids = set(
            Podcast.objects.filter(categories__id__in=top_category_ids)
            .values_list("id", flat=True)
        )
    creator_pids = set()
    if top_creator_ids:
        creator_pids = set(
            Podcast.objects.filter(creator_id__in=top_creator_ids)
            .values_list("id", flat=True)
        )

    scoreable_pids = explicit_pids | category_pids | creator_pids
    if not scoreable_pids:
        return {}

    # Pull metadata only for the scoreable set — bounded by user
    # behavior + their preferred categories/creators, never the full
    # catalog.
    cats_by_podcast = {}
    creator_by_podcast = {}
    for pid, cat_id in (
        Podcast.objects.filter(id__in=scoreable_pids)
        .values_list("id", "categories__id")
    ):
        if cat_id is None:
            continue
        cats_by_podcast.setdefault(pid, []).append(cat_id)
    for pid, creator_id in (
        Podcast.objects.filter(id__in=scoreable_pids)
        .values_list("id", "creator_id")
    ):
        if creator_id is not None:
            creator_by_podcast[pid] = creator_id

    # Component weights — tuned so an explicit follow always beats a
    # category-only similarity, and a favorited show beats a casual
    # one-time listen of the same category. Episode favorites land
    # between podcast favorites and pure category overlap: weaker than
    # "I love the whole show" but stronger than "I happen to like the
    # genre".
    follow_weight = 60.0
    favorite_weight = 35.0
    favorite_episode_weight = 22.0
    history_weight = 25.0   # multiplied by capped engagement (0..3)
    category_weight = 8.0   # multiplied by capped overlap (0..3)
    creator_weight = 12.0   # multiplied by capped overlap (0..3)

    podcast_scores = {}
    for pid in scoreable_pids:
        score = 0.0

        if pid in profile["followed_podcast_ids"]:
            score += follow_weight
        if pid in profile["favorite_podcast_ids"]:
            score += favorite_weight
        if pid in profile["favorite_episode_podcast_ids"]:
            score += favorite_episode_weight

        engagement = profile["podcast_engagement"].get(pid, 0.0)
        if engagement > 0:
            score += history_weight * min(engagement, 3.0)

        if profile["category_weights"]:
            cats = cats_by_podcast.get(pid, [])
            if cats:
                overlap = sum(
                    profile["category_weights"].get(c, 0.0) for c in cats
                )
                if overlap > 0:
                    score += category_weight * min(overlap, 3.0)

        creator_id = creator_by_podcast.get(pid)
        if creator_id is not None and profile["creator_weights"]:
            creator_overlap = profile["creator_weights"].get(creator_id, 0.0)
            if creator_overlap > 0:
                score += creator_weight * min(creator_overlap, 3.0)

        if score > 0:
            podcast_scores[pid] = score

    return podcast_scores


class EpisodeListCreateView(generics.ListCreateAPIView):
    serializer_class = EpisodeSerializer
    filter_backends = [filters.OrderingFilter]
    ordering = ['-published_at']

    def get_queryset(self):
        return _base_non_audiobook_queryset()

    def get_permissions(self):
        """Allow anyone to view episodes, but require authentication to create"""
        if self.request.method == 'GET':
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated()]

class EpisodeDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Episode.objects.select_related('podcast', 'podcast__creator')
    serializer_class = EpisodeSerializer

    def get_permissions(self):
        """Allow anyone to view episode details, but require authentication to modify"""
        if self.request.method == 'GET':
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated()]


class TrendingEpisodeListView(generics.ListAPIView):
    serializer_class = EpisodeSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        window_hours = _clamp_int(
            self.request.query_params.get("window_hours"),
            DEFAULT_TREND_WINDOW_HOURS,
            TREND_WINDOW_MIN_HOURS,
            TREND_WINDOW_MAX_HOURS,
        )
        min_volume = _clamp_int(
            self.request.query_params.get("min_volume"),
            DEFAULT_TREND_MIN_VOLUME,
            1,
            100000,
        )

        window_start = timezone.now() - timedelta(hours=window_hours)
        trend_filter = Q(
            playbackevent__created_at__gte=window_start,
            playbackevent__event__in=["play", "complete"],
        )

        queryset = _base_non_audiobook_queryset().annotate(
            recent_downloads=Count("playbackevent", filter=trend_filter)
        )

        recent_volume = queryset.aggregate(total=Sum("recent_downloads")).get("total") or 0
        if recent_volume < min_volume:
            return _base_non_audiobook_queryset().order_by("-published_at")

        trending = queryset.filter(recent_downloads__gt=0).order_by("-recent_downloads", "-published_at")
        if trending.exists():
            return trending
        return _base_non_audiobook_queryset().order_by("-published_at")


class RecommendedEpisodeListView(generics.ListAPIView):
    """For You / Recommended feed — pure-taste, no popularity bandwagon.

    Philosophy. The point of this surface is "based on what *you* have
    been liking and listening to so far, here is more of that." It is
    explicitly *not* a "what's hot right now" or "everyone is listening
    to this" surface — those exist (the Trending feed and the Newest
    feed) and they live on their own tabs. We deliberately do not bias
    For You toward popular content, because doing so collapses every
    user's recommendations into a global popularity ranking and erases
    the personalization the user can feel.

    Scoring inputs (all sourced from the requesting user's own data):
      * Follows                — +60  per podcast
      * Podcast favorites      — +35  per podcast
      * Episode favorites      — +22  per parent podcast
      * Engaged listening      — up to +75 per podcast (engagement-
                                 weighted, recency-decayed)
      * Category overlap       — up to +24 per episode (own categories)
      * Creator overlap        — up to +36 per episode (own creators)
      * Recency bonus          — +1 / +5 / +10 / +15 by age bucket
                                 (a freshness tiebreak, not a driver)

    Notably absent: any global popularity term. Two episodes with the
    same personalization score sort by recency and then by a per-user
    deterministic shuffle (see ``list``), never by "how many other
    listeners played this in the last 14 days."

    No-signal users see an empty feed. Anonymous visitors and signed-
    in users with zero usable signal (no follows, no favorites of any
    kind, no listening history within the profile window) get an empty
    result on purpose — there is nothing personal to recommend yet.
    The frontend already handles this with a "Sign in" CTA on the
    Discover Recommended tab and by hiding the For You row on the
    home screen until the user accumulates some taste signal.

    Two-phase ordering. The DB sort buckets episodes by score; the
    Python pass then (a) shuffles within each score bucket using a
    seed derived from ``user_id + today``, and (b) round-robins across
    podcasts within each bucket so a single followed show can't
    monopolize the entire row. Same user + same day = stable order
    across refreshes; different users (or same user, next day) =
    different orderings.
    """

    serializer_class = EpisodeSerializer
    permission_classes = [permissions.AllowAny]
    pagination_class = RecommendedFeedPagination

    # How many candidates we materialize before applying the per-user
    # shuffle + diversity pass. Has to comfortably exceed the largest
    # page the frontend asks for (FEED_FETCH_LIMIT = 200) so a full
    # first page can be served from the post-processed window.
    SHUFFLE_WINDOW = 1000

    # Diversity cap — within the post-shuffle order, no more than this
    # many consecutive episodes may come from the same podcast before
    # we round-robin to a different one (when one is available at the
    # same or lower score tier). Prevents a single followed show with
    # a deep back-catalog from filling the whole feed.
    MAX_CONSECUTIVE_PER_PODCAST = 1

    def get_queryset(self):
        user = self.request.user
        # Anonymous visitors have no taste signal of any kind. Returning
        # nothing is the honest answer; the home-screen row hides itself
        # on an empty feed and the Discover tab shows "Sign in to get
        # personalized recommendations" — both designed exactly for this
        # state.
        if not user or not user.is_authenticated:
            return Episode.objects.none()

        base_queryset = _base_non_audiobook_queryset()
        if not _is_premium_user(user):
            base_queryset = base_queryset.filter(
                podcast__is_exclusive=False, is_premium=False
            )

        profile = _build_user_profile(user)

        # Exclude every episode the user has already started or finished.
        # "Continue Listening" is a separate surface; For You is meant to
        # surface content they haven't met yet.
        listened_ids = profile["listened_episode_ids"]
        candidates = (
            base_queryset.exclude(id__in=listened_ids) if listened_ids else base_queryset
        )

        podcast_scores = _compute_podcast_scores(profile)

        # Signed in but no signal yet → empty feed. The frontend shows
        # "Listen to some episodes to get personalized suggestions" in
        # this state. We refuse to fall back to a global popularity
        # ranking because doing so would make every brand-new account
        # see the exact same list as every other brand-new account,
        # which is the symptom that motivated this rewrite.
        if not podcast_scores:
            return Episode.objects.none()

        # Cap the SQL Case expression to the top-N strongest podcasts so
        # that very heavy users don't generate unwieldy queries.
        top_podcasts = sorted(
            podcast_scores.items(), key=lambda kv: kv[1], reverse=True
        )[:RECOMMENDED_PODCAST_SCORE_CAP]

        whens = [
            When(podcast_id=pid, then=Value(int(round(score))))
            for pid, score in top_podcasts
        ]
        personalization_expr = Case(
            *whens,
            default=Value(0),
            output_field=IntegerField(),
        )

        now = timezone.now()
        # Recency is a freshness tiebreak, not a driver — the largest
        # bucket here (+15 for "this week") is still smaller than the
        # smallest personalization signal (+22 for an episode favorite).
        # An ancient episode of a podcast you follow always outranks
        # a brand-new episode of a podcast you've never touched.
        recency_expr = Case(
            When(published_at__gte=now - timedelta(days=7), then=Value(15)),
            When(published_at__gte=now - timedelta(days=30), then=Value(10)),
            When(published_at__gte=now - timedelta(days=90), then=Value(5)),
            When(published_at__gte=now - timedelta(days=365), then=Value(1)),
            default=Value(0),
            output_field=IntegerField(),
        )

        # Filter the candidate pool down to episodes whose podcast
        # actually scored. Without this filter we'd materialize the
        # entire catalog into the SHUFFLE_WINDOW (most of it scoring
        # zero on personalization) and then throw it away in the
        # diversity pass — a huge waste of DB IO for users with a
        # narrow taste profile. Keeping the queryset bounded to
        # podcasts with non-zero score also means the post-fetch
        # shuffle works on signal, not noise.
        scored_pids = [pid for pid, _ in top_podcasts]
        candidates = candidates.filter(podcast_id__in=scored_pids)

        return (
            candidates
            .annotate(
                _personalization=personalization_expr,
                _recency=recency_expr,
            )
            .annotate(
                _total_score=F("_personalization") + F("_recency"),
            )
            .order_by("-_total_score", "-published_at")
        )

    def _shuffle_seed(self, request):
        """Build the deterministic shuffle seed for this request.

        Authenticated users key on their user id so the order is
        stable across refreshes within a day but different per
        account. Anonymous visitors key on a hash of their IP +
        User-Agent + day, which is enough to give different anon
        visitors different orderings without breaking refresh
        stability for any one of them. The day component rotates the
        feed naturally so even a returning user gets a fresh top-of-
        feed each day instead of seeing the same five episodes
        forever.
        """
        user = getattr(request, "user", None)
        if user is not None and getattr(user, "is_authenticated", False) and getattr(user, "id", None):
            user_key = f"u:{user.id}"
        else:
            ip = (
                request.META.get("HTTP_X_FORWARDED_FOR", "").split(",")[0].strip()
                or request.META.get("REMOTE_ADDR", "")
                or ""
            )
            ua = request.META.get("HTTP_USER_AGENT", "") or ""
            user_key = "anon:" + hashlib.md5(f"{ip}|{ua}".encode("utf-8")).hexdigest()[:16]
        day_key = timezone.now().date().isoformat()
        return f"{user_key}:{day_key}"

    @staticmethod
    def _shuffle_within_score_tiers(items, rng):
        """Shuffle ``items`` in place per contiguous ``_total_score`` tier.

        ``items`` arrives already sorted by ``-_total_score`` from the
        DB. We walk the list once, group consecutive items that share
        the same score, and shuffle each group with the per-request
        RNG. The relative order of score tiers is preserved — a
        78-point episode never overtakes a 92-point one — so the
        algorithm's intent stays intact.
        """
        if not items:
            return items

        out = []
        bucket = []
        current_score = object()  # sentinel guaranteed to mismatch
        for ep in items:
            score = getattr(ep, "_total_score", None)
            if score is None:
                score = 0
            if score == current_score:
                bucket.append(ep)
            else:
                if bucket:
                    rng.shuffle(bucket)
                    out.extend(bucket)
                bucket = [ep]
                current_score = score
        if bucket:
            rng.shuffle(bucket)
            out.extend(bucket)
        return out

    @staticmethod
    def _diversify_by_podcast(items, max_consecutive):
        """Round-robin items so the same podcast doesn't dominate.

        Walks the (already shuffled) list and reorders so no more than
        ``max_consecutive`` episodes from the same podcast appear back-
        to-back. Stable beyond that — when no diversity-respecting
        choice is available we just emit the next item in order, so a
        user whose top score tier is dominated by a single show will
        still see those episodes (correctly), just not all bunched at
        the very top.
        """
        if not items or max_consecutive < 1:
            return items

        remaining = list(items)
        out = []
        recent = []  # last `max_consecutive` podcast_ids emitted

        while remaining:
            chosen_idx = None
            for idx, ep in enumerate(remaining):
                pid = getattr(ep, "podcast_id", None)
                # Recency window only counts repeats — a None pid (no
                # podcast?) shouldn't be penalized.
                if pid is None or recent.count(pid) < max_consecutive:
                    chosen_idx = idx
                    break
            if chosen_idx is None:
                # All remaining items would violate the cap; emit the
                # next item in order rather than stall.
                chosen_idx = 0

            ep = remaining.pop(chosen_idx)
            out.append(ep)
            pid = getattr(ep, "podcast_id", None)
            recent.append(pid)
            if len(recent) > max_consecutive:
                recent.pop(0)

        return out

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())

        # Materialize a window. Slicing a queryset issues a LIMIT, so
        # we never pull the whole catalog — just enough to cover the
        # largest page anyone actually fetches plus headroom for the
        # in-bucket shuffle and diversity pass to have meaningful range.
        candidates = list(queryset[: self.SHUFFLE_WINDOW])

        seed_input = self._shuffle_seed(request).encode("utf-8")
        rng = random.Random(int(hashlib.md5(seed_input).hexdigest(), 16))
        candidates = self._shuffle_within_score_tiers(candidates, rng)
        candidates = self._diversify_by_podcast(
            candidates, self.MAX_CONSECUTIVE_PER_PODCAST
        )

        page = self.paginate_queryset(candidates)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(candidates, many=True)
        return Response(serializer.data)
