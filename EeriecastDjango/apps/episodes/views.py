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
RECO_PROFILE_CACHE_VERSION = 1
RECO_PROFILE_TTL = 300  # 5 minutes


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

# Cap the number of podcasts we ask for popularity stats over to keep
# the candidate-pool join bounded on huge catalogs.
RECOMMENDED_POPULARITY_DAYS = 14


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

    interested_podcast_ids = (
        set(profile["podcast_engagement"].keys())
        | profile["followed_podcast_ids"]
        | profile["favorite_podcast_ids"]
    )
    if interested_podcast_ids:
        # Per-podcast taste weight used to derive category/creator
        # preferences. Follows are the strongest explicit signal, then
        # favorites, then accumulated engagement.
        def _podcast_weight(pid):
            base = profile["podcast_engagement"].get(pid, 0.0)
            if pid in profile["followed_podcast_ids"]:
                base = max(base, 1.0)
            elif pid in profile["favorite_podcast_ids"]:
                base = max(base, 0.7)
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
    # one-time listen of the same category.
    follow_weight = 60.0
    favorite_weight = 35.0
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
    """For You / Recommended feed.

    The ranker combines explicit signals (follows, favorites), implicit
    signals (engagement-weighted listening history), and content-similarity
    signals (shared categories, shared creators) into a per-podcast score,
    then annotates each candidate episode with that score plus a recency
    bonus and a recent-popularity prior. Ordering is fully deterministic
    server-side; the frontend should not reshuffle.

    Cold-start (anonymous users, or signed-in users with zero usable
    signals) falls through to a popularity + recency ranking instead of
    Postgres ``ORDER BY RANDOM()``, which is both expensive and the source
    of the "different 20 every refresh" symptom.
    """

    serializer_class = EpisodeSerializer
    permission_classes = [permissions.AllowAny]
    pagination_class = RecommendedFeedPagination

    def _cold_start_queryset(self, base_queryset):
        now = timezone.now()
        recent_pop_filter = Q(
            playbackevent__created_at__gte=now - timedelta(days=RECOMMENDED_POPULARITY_DAYS),
            playbackevent__event__in=["play", "complete"],
        )
        recency_expr = Case(
            When(published_at__gte=now - timedelta(days=14), then=Value(20)),
            When(published_at__gte=now - timedelta(days=60), then=Value(10)),
            When(published_at__gte=now - timedelta(days=180), then=Value(3)),
            default=Value(0),
            output_field=IntegerField(),
        )
        return (
            base_queryset
            .annotate(
                _recency=recency_expr,
                _popularity=Count("playbackevent", filter=recent_pop_filter),
            )
            .annotate(_total_score=F("_recency") + F("_popularity") * 2)
            .order_by("-_total_score", "-published_at")
        )

    def get_queryset(self):
        base_queryset = _base_non_audiobook_queryset()
        user = self.request.user
        is_premium = _is_premium_user(user)

        if not is_premium:
            base_queryset = base_queryset.filter(
                podcast__is_exclusive=False, is_premium=False
            )

        if not user or not user.is_authenticated:
            return self._cold_start_queryset(base_queryset)

        profile = _build_user_profile(user)

        # Exclude every episode the user has already started or finished.
        # "Continue Listening" is a separate surface; For You is meant to
        # surface content they haven't met yet.
        listened_ids = profile["listened_episode_ids"]
        candidates = (
            base_queryset.exclude(id__in=listened_ids) if listened_ids else base_queryset
        )

        podcast_scores = _compute_podcast_scores(profile)

        # Cold-start the user too: if we found zero personalization signal
        # (brand-new account, all signals filtered out by recency, etc.),
        # fall through to popularity+recency on their eligible candidates.
        if not podcast_scores:
            return self._cold_start_queryset(candidates)

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
        recency_expr = Case(
            When(published_at__gte=now - timedelta(days=7), then=Value(15)),
            When(published_at__gte=now - timedelta(days=30), then=Value(10)),
            When(published_at__gte=now - timedelta(days=90), then=Value(5)),
            When(published_at__gte=now - timedelta(days=365), then=Value(1)),
            default=Value(0),
            output_field=IntegerField(),
        )

        # Light popularity prior so equally-personalized candidates break
        # ties toward what other listeners are actually engaging with right
        # now, instead of arbitrary id order.
        recent_pop_filter = Q(
            playbackevent__created_at__gte=now - timedelta(days=RECOMMENDED_POPULARITY_DAYS),
            playbackevent__event__in=["play", "complete"],
        )

        return (
            candidates
            .annotate(
                _personalization=personalization_expr,
                _recency=recency_expr,
                _popularity=Count("playbackevent", filter=recent_pop_filter),
            )
            .annotate(
                _total_score=F("_personalization") + F("_recency") + F("_popularity"),
            )
            .order_by("-_total_score", "-published_at")
        )
