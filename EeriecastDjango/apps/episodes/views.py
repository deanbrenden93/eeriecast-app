import re
from collections import Counter
from datetime import timedelta

from django.db.models import Case, Count, IntegerField, Q, Sum, When
from django.utils import timezone
from rest_framework import filters, generics, permissions

from apps.library.models import ListeningHistory
from apps.podcasts.models import Podcast
from .models import Episode
from .serializers import EpisodeSerializer


PODCAST_STOP_WORDS = {
    "a", "an", "and", "are", "as", "at", "be", "been", "but", "by", "for", "from", "how", "if",
    "in", "into", "is", "it", "its", "of", "on", "or", "so", "that", "the", "their", "there",
    "these", "they", "this", "to", "was", "we", "were", "what", "when", "where", "who", "why",
    "will", "with", "you", "your", "our", "about", "after", "all", "also", "am", "any", "around",
    "back", "before", "can", "could", "did", "do", "does", "done", "each", "every", "get",
    "getting", "got", "had", "has", "have", "here", "just", "like", "many", "may", "more", "most",
    "much", "new", "next", "now", "only", "other", "out", "over", "part", "really", "same",
    "should", "some", "still", "than", "then", "them", "those", "too", "under", "up", "very",
    "want", "well", "while", "would", "episode", "episodes", "podcast", "podcasts", "show",
    "shows", "today", "tonight", "host", "hosts", "listening", "listen", "welcome", "latest",
}

PODCAST_STOP_PHRASES = {
    "this week",
    "new episode",
    "join us",
    "in this episode",
    "on this episode",
    "for this episode",
    "today we",
    "this podcast",
    "podcast episode",
    "welcome back",
    "thanks for listening",
}

TOKEN_PATTERN = re.compile(r"[a-z0-9']+")
TREND_WINDOW_MIN_HOURS = 24
TREND_WINDOW_MAX_HOURS = 72
DEFAULT_TREND_WINDOW_HOURS = 48
DEFAULT_TREND_MIN_VOLUME = 10
RECOMMENDED_LOOKBACK_DAYS = 30
RECOMMENDED_CANDIDATE_LIMIT = 3000
RECOMMENDED_RANKED_LIMIT = 500


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


def _extract_terms_and_phrases(text):
    tokens = []
    for raw_token in TOKEN_PATTERN.findall((text or "").lower()):
        token = raw_token.strip("'")
        if len(token) < 3 or token.isdigit():
            continue
        if token in PODCAST_STOP_WORDS:
            continue
        tokens.append(token)

    unique_terms = set(tokens)
    unique_phrases = set()
    for size in (2, 3):
        if len(tokens) < size:
            continue
        for idx in range(len(tokens) - size + 1):
            phrase = " ".join(tokens[idx:idx + size])
            if phrase in PODCAST_STOP_PHRASES:
                continue
            unique_phrases.add(phrase)
    return unique_terms, unique_phrases


def _build_listener_profile(history_items):
    term_weights = Counter()
    phrase_weights = Counter()

    for item in history_items:
        episode = getattr(item, "episode", None)
        if not episode:
            continue
        podcast_title = getattr(getattr(episode, "podcast", None), "title", "")
        source_text = f"{episode.title or ''} {episode.description or ''} {podcast_title or ''}"
        terms, phrases = _extract_terms_and_phrases(source_text)
        term_weights.update(terms)
        phrase_weights.update(phrases)

    return term_weights, phrase_weights


def _score_candidate_episode(title, description, show_name, term_weights, phrase_weights):
    source_text = f"{title or ''} {description or ''} {show_name or ''}"
    terms, phrases = _extract_terms_and_phrases(source_text)
    if not terms and not phrases:
        return 0

    term_score = sum(term_weights.get(term, 0) for term in terms)
    phrase_score = sum(phrase_weights.get(phrase, 0) for phrase in phrases)
    return term_score + (phrase_score * 2)


class EpisodeListCreateView(generics.ListCreateAPIView):
    queryset = Episode.objects.select_related('podcast', 'podcast__creator')
    serializer_class = EpisodeSerializer
    filter_backends = [filters.OrderingFilter]
    ordering = ['-published_at']

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
    serializer_class = EpisodeSerializer
    permission_classes = [permissions.AllowAny]

    def _fallback_queryset(self, base_queryset):
        if not base_queryset.exists():
            return base_queryset
        return base_queryset.order_by("?")

    def get_queryset(self):
        base_queryset = _base_non_audiobook_queryset()
        user = self.request.user
        is_premium = _is_premium_user(user)

        if not is_premium:
            base_queryset = base_queryset.filter(podcast__is_exclusive=False, is_premium=False)

        if not user or not user.is_authenticated:
            return self._fallback_queryset(base_queryset)

        all_history = ListeningHistory.objects.filter(user=user)
        listened_episode_ids = list(all_history.values_list("episode_id", flat=True))
        candidates = base_queryset.exclude(id__in=listened_episode_ids) if listened_episode_ids else base_queryset
        if not candidates.exists():
            return candidates

        recent_history = all_history.filter(
            last_played__gte=timezone.now() - timedelta(days=RECOMMENDED_LOOKBACK_DAYS)
        ).select_related("episode", "episode__podcast")

        term_weights, phrase_weights = _build_listener_profile(recent_history)
        if not term_weights and not phrase_weights:
            return self._fallback_queryset(candidates)

        scored = []
        candidate_rows = candidates.values(
            "id", "title", "description", "podcast__title", "published_at"
        )[:RECOMMENDED_CANDIDATE_LIMIT]
        for row in candidate_rows:
            score = _score_candidate_episode(
                title=row.get("title"),
                description=row.get("description"),
                show_name=row.get("podcast__title"),
                term_weights=term_weights,
                phrase_weights=phrase_weights,
            )
            if score <= 0:
                continue
            scored.append((row["id"], score, row.get("published_at")))

        if not scored:
            return self._fallback_queryset(candidates)

        scored.sort(
            key=lambda item: (item[1], (item[2].timestamp() if item[2] else 0)),
            reverse=True,
        )
        ordered_ids = [episode_id for episode_id, _, _ in scored[:RECOMMENDED_RANKED_LIMIT]]
        if not ordered_ids:
            return self._fallback_queryset(candidates)

        ordering = Case(
            *[When(id=episode_id, then=position) for position, episode_id in enumerate(ordered_ids)],
            output_field=IntegerField(),
        )
        return candidates.filter(id__in=ordered_ids).order_by(ordering)
