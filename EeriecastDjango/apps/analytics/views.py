"""
Admin analytics summary endpoint.

Single endpoint that returns everything the /AdminAnalytics page needs in
one request. Computes user, subscription and content metrics from the
existing DB — nothing new is stored. All aggregations are keyed off
`created_at` (User, Subscription, PodcastFollowing) and `canceled_at`
(Subscription) so the numbers stay accurate without any background
jobs or schema changes.

MRR is derived from the Subscription.plan_id → price-in-cents mapping
defined in settings (STRIPE_MONTHLY_AMOUNT_CENTS /
STRIPE_YEARLY_AMOUNT_CENTS). If you add new Stripe prices, map them
here or the MRR number for new plans will fall back to the monthly
default.
"""
from datetime import datetime, timedelta, date
from typing import Any

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.contenttypes.models import ContentType
from django.db.models import Count, Q, Sum
from django.db.models.functions import TruncDate
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.billing.models import Subscription
from apps.episodes.models import Episode
from apps.library.models import Favorite, ListeningHistory, PlaybackEvent, PodcastFollowing
from apps.podcasts.models import Podcast

from .models import AnonymousSession
from .permissions import IsStaffSuperuser

User = get_user_model()

RANGE_CHOICES = {
    "24h": timedelta(hours=24),
    "7d": timedelta(days=7),
    "30d": timedelta(days=30),
    "90d": timedelta(days=90),
    "1y": timedelta(days=365),
}

# "all" is special — it means "no lower bound, the entire history of
# the platform". It isn't in RANGE_CHOICES because it doesn't map to
# a fixed timedelta; the resolver below treats it as a sentinel and
# computes a synthetic start from the earliest record on disk so the
# bucketed series still has something to chart against.
ALL_TIME_KEY = "all"



def _price_cents_for_plan(plan_id: str | None) -> int:
    """Map a Stripe plan_id to its monthly-equivalent price in cents."""
    if not plan_id:
        return settings.STRIPE_MONTHLY_AMOUNT_CENTS
    if plan_id == settings.STRIPE_YEARLY_PRICE_ID:
        return settings.STRIPE_YEARLY_AMOUNT_CENTS // 12
    if plan_id == settings.STRIPE_MONTHLY_PRICE_ID:
        return settings.STRIPE_MONTHLY_AMOUNT_CENTS
    return settings.STRIPE_MONTHLY_AMOUNT_CENTS


def _plan_label(plan_id: str | None) -> str:
    if not plan_id:
        return "unknown"
    if plan_id == settings.STRIPE_YEARLY_PRICE_ID:
        return "yearly"
    if plan_id == settings.STRIPE_MONTHLY_PRICE_ID:
        return "monthly"
    return "other"


def _earliest_platform_event() -> datetime:
    """Find the oldest timestamp on the platform.

    Used as the synthetic ``start`` when the caller asks for the
    ``all`` range. We look at the records most likely to predate
    everything else (users, then subscriptions, then play events)
    and fall back to "1 year ago" if the database is somehow empty.
    """
    candidates: list[datetime] = []
    earliest_user = User.objects.order_by("created_at").values_list(
        "created_at", flat=True
    ).first()
    if earliest_user:
        candidates.append(earliest_user)
    earliest_sub = Subscription.objects.order_by("created_at").values_list(
        "created_at", flat=True
    ).first()
    if earliest_sub:
        candidates.append(earliest_sub)
    earliest_play = PlaybackEvent.objects.order_by("created_at").values_list(
        "created_at", flat=True
    ).first()
    if earliest_play:
        candidates.append(earliest_play)
    if not candidates:
        return timezone.now() - timedelta(days=365)
    return min(candidates)


def _parse_range(request) -> tuple[datetime, datetime, str, bool]:
    """Resolve `?range=` or `?start=&end=` into a temporal scope.

    Returns ``(start, end, label, is_all_time)``. ``label`` is one of
    the RANGE_CHOICES keys, ``"custom"``, or ``"all"``. ``is_all_time``
    is True only when the caller explicitly requested the all-time
    range; it's used downstream to skip per-day bucketing on series
    that would otherwise produce thousands of points.
    """
    now = timezone.now()
    range_key = (request.query_params.get("range") or "").lower().strip()
    start_param = request.query_params.get("start")
    end_param = request.query_params.get("end")

    if start_param or end_param:
        start = _parse_iso(start_param) if start_param else (now - timedelta(days=30))
        end = _parse_iso(end_param) if end_param else now
        if end <= start:
            end = start + timedelta(days=1)
        return start, end, "custom", False

    if range_key == ALL_TIME_KEY:
        return _earliest_platform_event(), now, ALL_TIME_KEY, True

    delta = RANGE_CHOICES.get(range_key, RANGE_CHOICES["30d"])
    label = range_key if range_key in RANGE_CHOICES else "30d"
    return now - delta, now, label, False


def _parse_iso(value: str) -> datetime:
    # Accept both "YYYY-MM-DD" and full ISO timestamps. Treat dates as midnight UTC.
    try:
        if len(value) == 10:
            d = date.fromisoformat(value)
            return timezone.make_aware(datetime(d.year, d.month, d.day))
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except Exception:
        return timezone.now() - timedelta(days=30)


def _daily_buckets(start: datetime, end: datetime) -> list[date]:
    """Return a list of dates from start.date() through end.date() inclusive
    of start, exclusive of end (mirrors a typical range convention).
    """
    out: list[date] = []
    d = start.date()
    last = end.date()
    while d <= last:
        out.append(d)
        d += timedelta(days=1)
    return out


def _counts_per_day(queryset, field: str, buckets: list[date]) -> list[int]:
    """Group a queryset by DATE(field) and align the result to `buckets`.

    Missing days return 0. Uses TruncDate so the DB does the grouping.
    """
    rows = (
        queryset
        .annotate(_day=TruncDate(field))
        .values("_day")
        .annotate(n=Count("id"))
    )
    by_day: dict[date, int] = {}
    for row in rows:
        key = row["_day"]
        if hasattr(key, "date"):
            key = key.date()
        by_day[key] = row["n"]
    return [by_day.get(d, 0) for d in buckets]


def _active_sub_qs():
    """Subscription rows treated as 'currently paying' for MRR + counts."""
    now = timezone.now()
    return Subscription.objects.filter(
        Q(status__in=["active", "trialing", "past_due"])
        & (Q(current_period_end__isnull=True) | Q(current_period_end__gt=now))
    )


class AnalyticsSummaryView(APIView):
    """GET /api/analytics/summary/?range=30d or ?start=&end=

    Permissions: IsAuthenticated + staff + superuser.
    """

    permission_classes = [IsAuthenticated, IsStaffSuperuser]

    def get(self, request):
        start, end, range_label, is_all_time = _parse_range(request)
        now = timezone.now()
        buckets = _daily_buckets(start, end)
        bucket_labels = [d.isoformat() for d in buckets]

        # ── USER METRICS ────────────────────────────────────────────
        user_qs = User.objects.filter(is_deleted=False)
        total_users = user_qs.count()
        total_users_deleted = User.objects.filter(is_deleted=True).count()
        new_users_in_range = user_qs.filter(created_at__gte=start, created_at__lt=end).count()
        new_users_prev = user_qs.filter(
            created_at__gte=start - (end - start), created_at__lt=start
        ).count()
        new_users_series = _counts_per_day(
            user_qs.filter(created_at__gte=start, created_at__lt=end),
            "created_at",
            buckets,
        )

        # Cumulative user total at end of each day. Done with a single query
        # that counts users created on or before each bucket date.
        # For simplicity and correctness we count at end-of-day.
        # Total users as of bucket end = running sum of daily signups + users that existed before `start`
        pre_range_users = user_qs.filter(created_at__lt=start).count()
        cumulative_users_series: list[int] = []
        running = pre_range_users
        for n in new_users_series:
            running += n
            cumulative_users_series.append(running)

        email_verified_count = user_qs.filter(email_verified=True).count()
        onboarding_completed_count = user_qs.filter(onboarding_completed=True).count()
        imported_count = user_qs.filter(is_imported_from_memberful=True).count()
        has_dob_count = user_qs.filter(date_of_birth__isnull=False).count()

        # Age distribution (bucketed) — only for users with a DOB on file.
        today = timezone.localdate()
        age_buckets = {"<18": 0, "18–24": 0, "25–34": 0, "35–44": 0, "45–54": 0, "55–64": 0, "65+": 0}
        for dob in user_qs.filter(date_of_birth__isnull=False).values_list("date_of_birth", flat=True):
            if not dob:
                continue
            age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
            if age < 18:
                age_buckets["<18"] += 1
            elif age < 25:
                age_buckets["18–24"] += 1
            elif age < 35:
                age_buckets["25–34"] += 1
            elif age < 45:
                age_buckets["35–44"] += 1
            elif age < 55:
                age_buckets["45–54"] += 1
            elif age < 65:
                age_buckets["55–64"] += 1
            else:
                age_buckets["65+"] += 1

        # ── SUBSCRIPTION / REVENUE METRICS ──────────────────────────
        all_subs = Subscription.objects.all()
        active_subs_qs = _active_sub_qs()
        active_sub_user_ids = set(active_subs_qs.values_list("user_id", flat=True))

        paying_users_now = len(active_sub_user_ids)
        trialing_now = active_subs_qs.filter(status="trialing").count()
        active_now = active_subs_qs.filter(status="active").count()
        past_due_now = active_subs_qs.filter(status="past_due").count()
        free_users_now = max(0, total_users - paying_users_now)

        # ── ACTIVE-IN-LAST-24H BREAKDOWN ────────────────────────────
        # Steam-style live-activity counters. We split signed-in
        # active users by paid/free using the same Subscription
        # check that powers ``paying_users_now``, then count
        # AnonymousSession rows for the not-signed-in tally. A
        # visitor who logs in mid-session shows up in "logged in"
        # for that day, not "anonymous" — the auth middleware
        # bumps ``last_seen_at`` and skips the anon path on the
        # very same response.
        active_window_start = now - timedelta(hours=24)
        active_user_ids = set(
            user_qs.filter(last_seen_at__gte=active_window_start)
            .values_list("id", flat=True)
        )
        active_paid_ids = active_user_ids & active_sub_user_ids
        active_logged_in = len(active_user_ids)
        active_paid = len(active_paid_ids)
        active_free = max(0, active_logged_in - active_paid)
        active_anonymous = AnonymousSession.objects.filter(
            last_seen_at__gte=active_window_start
        ).count()
        active_total = active_logged_in + active_anonymous

        # MRR — sum monthly-equivalent price of every currently-active sub.
        mrr_cents = 0
        plan_mix: dict[str, int] = {}
        for plan_id in active_subs_qs.values_list("plan_id", flat=True):
            mrr_cents += _price_cents_for_plan(plan_id)
            label = _plan_label(plan_id)
            plan_mix[label] = plan_mix.get(label, 0) + 1
        arr_cents = mrr_cents * 12
        arpu_cents = (mrr_cents // paying_users_now) if paying_users_now else 0

        new_subs_in_range = all_subs.filter(created_at__gte=start, created_at__lt=end).count()
        canceled_in_range = all_subs.filter(canceled_at__gte=start, canceled_at__lt=end).count()
        new_subs_prev = all_subs.filter(
            created_at__gte=start - (end - start), created_at__lt=start
        ).count()
        canceled_prev = all_subs.filter(
            canceled_at__gte=start - (end - start), canceled_at__lt=start
        ).count()

        new_subs_series = _counts_per_day(
            all_subs.filter(created_at__gte=start, created_at__lt=end),
            "created_at",
            buckets,
        )
        canceled_series = _counts_per_day(
            all_subs.filter(canceled_at__gte=start, canceled_at__lt=end),
            "canceled_at",
            buckets,
        )

        # Churn % over the range — defined as the share of the at-start
        # cohort that left during the window. We deliberately scope the
        # numerator to the same cohort (subs that were active at the
        # start of the window AND canceled inside it). Without that
        # restriction, a sub created and canceled within the same window
        # would inflate churn above 100% (e.g. 3 cancellations against
        # 2 active-at-start subs producing 150%), which is meaningless
        # to operators trying to gauge retention.
        active_at_start_qs = all_subs.filter(
            created_at__lt=start,
        ).filter(
            Q(canceled_at__isnull=True) | Q(canceled_at__gte=start)
        )
        active_at_start = active_at_start_qs.count()
        churned_from_cohort = active_at_start_qs.filter(
            canceled_at__gte=start, canceled_at__lt=end,
        ).count()
        churn_rate = (churned_from_cohort / active_at_start) if active_at_start else 0.0
        # Bound to [0, 1] as a final defensive guard — the cohort filter
        # above guarantees this analytically, but rounding off corner
        # cases (e.g. timezone boundaries) is cheap insurance.
        churn_rate = max(0.0, min(1.0, churn_rate))

        # Cumulative paid / free split aligned to the same buckets so the
        # frontend can render a stacked area chart of Free vs Paid over time.
        # We approximate "paid at end of day D" as:
        #   subs where created_at <= end-of-D AND (canceled_at IS NULL OR canceled_at > end-of-D)
        # Done with two bulk queries (all subs' created_at / canceled_at) and
        # aggregated in Python to keep it cheap even for long ranges.
        sub_events = list(all_subs.values_list("created_at", "canceled_at"))
        paid_series: list[int] = []
        for d in buckets:
            day_end = timezone.make_aware(datetime(d.year, d.month, d.day)) + timedelta(days=1)
            count = sum(
                1 for c_at, x_at in sub_events
                if c_at is not None and c_at < day_end and (x_at is None or x_at >= day_end)
            )
            paid_series.append(count)
        free_series = [max(0, cumulative_users_series[i] - paid_series[i]) for i in range(len(buckets))]

        # ── CONTENT METRICS ─────────────────────────────────────────
        total_shows = Podcast.objects.count()

        # Follow counts.
        #
        # Two tables exist for follow-like relationships:
        #   • PodcastFollowing — intended follows table, but the public API
        #     endpoint (PodcastFollowingViewSet) *writes* to Favorite instead
        #     (see apps/library/views.py:create). Production data has
        #     effectively zero PodcastFollowing rows.
        #   • Favorite — generic-foreign-key table that holds real follows
        #     under content_type=Podcast. This is where the data lives.
        #
        # The analytics dashboard used to count the empty PodcastFollowing
        # table, which is why every follow metric read "0". We now read
        # from Favorite filtered to the Podcast content type, and fall
        # back to PodcastFollowing for any environments where it has been
        # backfilled. The two counts are summed as a belt-and-braces
        # guard — real deployments will only have data in one of them,
        # but double-counting a follow that somehow ended up in both is
        # less harmful than silently dropping it.
        podcast_ct = ContentType.objects.get_for_model(Podcast)
        podcast_favs = Favorite.objects.filter(content_type=podcast_ct)
        legacy_follows = PodcastFollowing.objects.all()

        total_follows = podcast_favs.count() + legacy_follows.count()
        new_follows_in_range = (
            podcast_favs.filter(created_at__gte=start, created_at__lt=end).count()
            + legacy_follows.filter(created_at__gte=start, created_at__lt=end).count()
        )
        new_follows_series = [
            a + b for a, b in zip(
                _counts_per_day(
                    podcast_favs.filter(created_at__gte=start, created_at__lt=end),
                    "created_at",
                    buckets,
                ),
                _counts_per_day(
                    legacy_follows.filter(created_at__gte=start, created_at__lt=end),
                    "created_at",
                    buckets,
                ),
                strict=False,
            )
        ]

        # Top followed podcasts. Count Favorite rows per podcast + any
        # stragglers in PodcastFollowing, merged in Python so we can
        # rank across both sources.
        #
        # Leaderboards now respect the active range — "top followed
        # shows in the last 30 days" is a meaningfully different
        # question from "all time", and admins now get the answer
        # they asked for instead of always seeing the all-time list.
        # Selecting the "All time" range falls back to no date filter,
        # which is identical to the previous always-all-time behavior.
        favs_in_range = (
            podcast_favs
            if is_all_time
            else podcast_favs.filter(created_at__gte=start, created_at__lt=end)
        )
        legacy_in_range = (
            legacy_follows
            if is_all_time
            else legacy_follows.filter(created_at__gte=start, created_at__lt=end)
        )
        fav_counts: dict[int, int] = {
            row["object_id"]: row["n"]
            for row in favs_in_range.values("object_id").annotate(n=Count("id"))
        }
        legacy_counts: dict[int, int] = {
            row["podcast_id"]: row["n"]
            for row in legacy_in_range.values("podcast_id").annotate(n=Count("id"))
        }
        merged: dict[int, int] = {}
        for pid, n in fav_counts.items():
            merged[pid] = merged.get(pid, 0) + n
        for pid, n in legacy_counts.items():
            merged[pid] = merged.get(pid, 0) + n
        top_ids = [pid for pid, _ in sorted(merged.items(), key=lambda kv: kv[1], reverse=True)[:10]]
        id_to_title = dict(
            Podcast.objects.filter(id__in=top_ids).values_list("id", "title")
        )
        top_followed = [
            {"id": pid, "title": id_to_title.get(pid, f"Podcast #{pid}"), "follower_count": merged[pid]}
            for pid in top_ids
        ]

        # Listened-time metrics.
        #
        # User.minutes_listened is declared on the model but isn't
        # incremented anywhere in the app, so summing it produced 0.
        # ListeningHistory is the real source of truth — one row per
        # (user, episode) with the last-known playback position. We sum
        # that position column and convert to minutes. This undercounts
        # replays (a user who listens twice still only contributes their
        # max position once), but it's accurate enough for a dashboard
        # and matches what users would describe as "total time listened
        # across the catalogue".
        total_seconds_listened = (
            ListeningHistory.objects.aggregate(total=Sum("progress")).get("total") or 0
        )
        total_minutes = int(total_seconds_listened // 60)

        # Play & completion engagement ---------------------------------
        # "Plays" = distinct play events recorded via PlaybackEvent
        # (fired from /library/progress/ when the client sends
        # event="play"). Counting events rather than unique episodes
        # captures repeat listens, which is the normal industry
        # definition of a "play".
        play_events = PlaybackEvent.objects.filter(event="play")
        complete_events = PlaybackEvent.objects.filter(event="complete")

        total_plays = play_events.count()
        plays_in_range = play_events.filter(created_at__gte=start, created_at__lt=end).count()
        plays_prev = play_events.filter(
            created_at__gte=start - (end - start), created_at__lt=start
        ).count()
        completions_in_range = complete_events.filter(
            created_at__gte=start, created_at__lt=end
        ).count()

        plays_series = _counts_per_day(
            play_events.filter(created_at__gte=start, created_at__lt=end),
            "created_at",
            buckets,
        )
        completions_series = _counts_per_day(
            complete_events.filter(created_at__gte=start, created_at__lt=end),
            "created_at",
            buckets,
        )

        # Listen-minutes per day — derived from heartbeat events. The
        # web client fires a heartbeat roughly every 15s while audio is
        # actively playing (see use-audio-player.js), so counting
        # heartbeats-per-day × the interval gives us a reasonable proxy
        # for "minutes listened on day D". If the heartbeat interval
        # ever changes, adjust HEARTBEAT_SECONDS below.
        HEARTBEAT_SECONDS = 15
        heartbeats_series = _counts_per_day(
            PlaybackEvent.objects.filter(
                event="heartbeat", created_at__gte=start, created_at__lt=end
            ),
            "created_at",
            buckets,
        )
        listen_minutes_series = [round((n * HEARTBEAT_SECONDS) / 60, 1) for n in heartbeats_series]
        listen_minutes_in_range = int(sum(listen_minutes_series))

        # Top 10 episodes by plays & by listen time. Leaderboards now
        # respect the active range — when the admin picks "Last 7
        # days" the lists answer "what's hot right now" instead of
        # always reflecting the all-time winners. Selecting "All
        # time" falls back to the unfiltered queryset.
        play_events_in_range = (
            play_events
            if is_all_time
            else play_events.filter(created_at__gte=start, created_at__lt=end)
        )
        # ListeningHistory rows are upserts (one per user/episode pair)
        # rather than append-only events, so ``created_at`` reflects
        # when the user FIRST played the episode and is meaningless
        # for a "what's hot recently" question. ``last_played`` is
        # auto_now=True (see apps/library/models.py) and is the right
        # column to filter on for range-scoped listen-time leaderboards.
        listen_in_range = (
            ListeningHistory.objects
            if is_all_time
            else ListeningHistory.objects.filter(
                last_played__gte=start, last_played__lt=end
            )
        )

        top_ep_plays_rows = list(
            play_events_in_range
            .values("episode_id")
            .annotate(plays=Count("id"))
            .order_by("-plays")[:10]
        )
        top_ep_ids = [r["episode_id"] for r in top_ep_plays_rows]
        ep_details = {
            e["id"]: e for e in
            Episode.objects.filter(id__in=top_ep_ids).values("id", "title", "podcast_id", "podcast__title")
        }
        top_episodes_by_plays = [
            {
                "id": r["episode_id"],
                "title": ep_details.get(r["episode_id"], {}).get("title") or f"Episode #{r['episode_id']}",
                "podcast_title": ep_details.get(r["episode_id"], {}).get("podcast__title") or "",
                "plays": r["plays"],
            }
            for r in top_ep_plays_rows
        ]

        top_ep_listen_rows = list(
            listen_in_range
            .values("episode_id")
            .annotate(seconds=Sum("progress"))
            .order_by("-seconds")[:10]
        )
        top_ep_listen_ids = [r["episode_id"] for r in top_ep_listen_rows]
        ep_listen_details = {
            e["id"]: e for e in
            Episode.objects.filter(id__in=top_ep_listen_ids).values("id", "title", "podcast_id", "podcast__title")
        }
        top_episodes_by_listen_time = [
            {
                "id": r["episode_id"],
                "title": ep_listen_details.get(r["episode_id"], {}).get("title") or f"Episode #{r['episode_id']}",
                "podcast_title": ep_listen_details.get(r["episode_id"], {}).get("podcast__title") or "",
                "minutes": int((r["seconds"] or 0) // 60),
            }
            for r in top_ep_listen_rows
        ]

        # Top 10 shows by plays & by listen time — aggregated across all
        # episodes of the show. Same range-aware treatment as the
        # episode lists above.
        top_show_plays_rows = list(
            play_events_in_range
            .values("episode__podcast_id")
            .annotate(plays=Count("id"))
            .order_by("-plays")[:10]
        )
        show_play_ids = [r["episode__podcast_id"] for r in top_show_plays_rows]
        show_play_titles = dict(
            Podcast.objects.filter(id__in=show_play_ids).values_list("id", "title")
        )
        top_shows_by_plays = [
            {
                "id": r["episode__podcast_id"],
                "title": show_play_titles.get(r["episode__podcast_id"]) or f"Podcast #{r['episode__podcast_id']}",
                "plays": r["plays"],
            }
            for r in top_show_plays_rows
        ]

        top_show_listen_rows = list(
            listen_in_range
            .values("episode__podcast_id")
            .annotate(seconds=Sum("progress"))
            .order_by("-seconds")[:10]
        )
        show_listen_ids = [r["episode__podcast_id"] for r in top_show_listen_rows]
        show_listen_titles = dict(
            Podcast.objects.filter(id__in=show_listen_ids).values_list("id", "title")
        )
        top_shows_by_listen_time = [
            {
                "id": r["episode__podcast_id"],
                "title": show_listen_titles.get(r["episode__podcast_id"]) or f"Podcast #{r['episode__podcast_id']}",
                "minutes": int((r["seconds"] or 0) // 60),
            }
            for r in top_show_listen_rows
        ]

        # ── RESPONSE ────────────────────────────────────────────────
        def pct_delta(curr: int, prev: int) -> float | None:
            if prev <= 0:
                return None
            return round(((curr - prev) / prev) * 100.0, 1)

        payload: dict[str, Any] = {
            "range": {
                "key": range_label,
                "start": start.isoformat(),
                "end": end.isoformat(),
                "now": now.isoformat(),
            },
            "kpis": {
                "total_users": total_users,
                "total_users_deleted": total_users_deleted,
                "free_users_now": free_users_now,
                "paying_users_now": paying_users_now,
                "trialing_now": trialing_now,
                "active_now": active_now,
                "past_due_now": past_due_now,
                # Steam-style 24h active-visitor breakdown. ``logged_in``
                # equals the sum of ``paid`` and ``free``; ``total``
                # equals ``logged_in + anonymous``. We send the components
                # rather than just the totals so the frontend can render
                # the breakdown without recomputing.
                "active_24h_total": active_total,
                "active_24h_logged_in": active_logged_in,
                "active_24h_paid": active_paid,
                "active_24h_free": active_free,
                "active_24h_anonymous": active_anonymous,
                "new_users_in_range": new_users_in_range,
                "new_users_delta_pct": pct_delta(new_users_in_range, new_users_prev),
                "new_subs_in_range": new_subs_in_range,
                "new_subs_delta_pct": pct_delta(new_subs_in_range, new_subs_prev),
                "canceled_in_range": canceled_in_range,
                "canceled_delta_pct": pct_delta(canceled_in_range, canceled_prev),
                "churn_rate": round(churn_rate, 4),
                "mrr_cents": mrr_cents,
                "arr_cents": arr_cents,
                "arpu_cents": arpu_cents,
                "currency": settings.STRIPE_CURRENCY,
                "email_verified_count": email_verified_count,
                "onboarding_completed_count": onboarding_completed_count,
                "imported_count": imported_count,
                "has_dob_count": has_dob_count,
                "total_shows": total_shows,
                "total_follows": total_follows,
                "new_follows_in_range": new_follows_in_range,
                "total_minutes_listened": int(total_minutes),
                "total_plays": total_plays,
                "plays_in_range": plays_in_range,
                "plays_delta_pct": pct_delta(plays_in_range, plays_prev),
                "completions_in_range": completions_in_range,
                "listen_minutes_in_range": listen_minutes_in_range,
            },
            "series": {
                "labels": bucket_labels,
                "new_users": new_users_series,
                "cumulative_users": cumulative_users_series,
                "paid_users": paid_series,
                "free_users": free_series,
                "new_subs": new_subs_series,
                "canceled_subs": canceled_series,
                "new_follows": new_follows_series,
                "plays": plays_series,
                "completions": completions_series,
                "listen_minutes": listen_minutes_series,
            },
            "breakdowns": {
                "plan_mix": plan_mix,
                "age_distribution": age_buckets,
                "top_followed_podcasts": top_followed,
                "top_episodes_by_plays": top_episodes_by_plays,
                "top_episodes_by_listen_time": top_episodes_by_listen_time,
                "top_shows_by_plays": top_shows_by_plays,
                "top_shows_by_listen_time": top_shows_by_listen_time,
            },
        }
        return Response(payload)


# ──────────────────────────────────────────────────────────────────────
# DETAILED LIST ENDPOINTS
# ──────────────────────────────────────────────────────────────────────
#
# The /summary/ endpoint above intentionally only returns the top 10
# of each ranking — admins want to see the headlines without paying
# the bandwidth of every episode in the catalogue. These three
# endpoints exist so the admin dashboard can show full sortable
# tables (Shows, Episodes) and the audiobook-completion view without
# blowing up the summary payload.
#
# All three respect the same `?range=...` / `?start=&end=` semantics
# as /summary/, including the `all` sentinel for all-time.


def _follow_count_map(podcast_favs_qs, legacy_follows_qs) -> dict[int, int]:
    """Count follows per podcast across both source tables.

    Mirrors the merge logic from AnalyticsSummaryView so a show's
    "followers" number on the Shows endpoint matches the top-10
    leaderboard exactly. See the comment in the summary view for
    why both tables exist.
    """
    out: dict[int, int] = {}
    for row in podcast_favs_qs.values("object_id").annotate(n=Count("id")):
        out[row["object_id"]] = out.get(row["object_id"], 0) + row["n"]
    for row in legacy_follows_qs.values("podcast_id").annotate(n=Count("id")):
        out[row["podcast_id"]] = out.get(row["podcast_id"], 0) + row["n"]
    return out


class AnalyticsShowsView(APIView):
    """GET /api/analytics/shows/?range=30d

    Returns a row per show with plays, listen time and follower
    count — all range-aware. Powers the Shows table in the admin
    Leaderboards tab. Show count is small (low hundreds) so the
    full list is returned in a single payload; the frontend handles
    sorting + pagination locally for snappy UX.
    """

    permission_classes = [IsAuthenticated, IsStaffSuperuser]

    def get(self, request):
        start, end, range_label, is_all_time = _parse_range(request)

        play_events = PlaybackEvent.objects.filter(event="play")
        play_in_range = (
            play_events
            if is_all_time
            else play_events.filter(created_at__gte=start, created_at__lt=end)
        )
        listen_in_range = (
            ListeningHistory.objects
            if is_all_time
            else ListeningHistory.objects.filter(
                last_played__gte=start, last_played__lt=end
            )
        )

        # Plays per show (count) and listen seconds per show (sum)
        plays_by_show: dict[int, int] = {
            row["episode__podcast_id"]: row["n"]
            for row in play_in_range.values("episode__podcast_id").annotate(
                n=Count("id")
            )
            if row["episode__podcast_id"] is not None
        }
        seconds_by_show: dict[int, int] = {
            row["episode__podcast_id"]: row["seconds"] or 0
            for row in listen_in_range.values("episode__podcast_id").annotate(
                seconds=Sum("progress")
            )
            if row["episode__podcast_id"] is not None
        }

        # Follows per show — same source tables as the summary view's
        # top-followed leaderboard, so numbers match across pages.
        podcast_ct = ContentType.objects.get_for_model(Podcast)
        favs_qs = Favorite.objects.filter(content_type=podcast_ct)
        legacy_qs = PodcastFollowing.objects.all()
        if not is_all_time:
            favs_qs = favs_qs.filter(created_at__gte=start, created_at__lt=end)
            legacy_qs = legacy_qs.filter(created_at__gte=start, created_at__lt=end)
        follows_by_show = _follow_count_map(favs_qs, legacy_qs)

        # Episode counts per show (always all-time — the catalogue
        # size doesn't move with the analytics range).
        ep_counts: dict[int, int] = {
            row["podcast_id"]: row["n"]
            for row in Episode.objects.values("podcast_id").annotate(n=Count("id"))
            if row["podcast_id"] is not None
        }

        # Pull every show in one query — paginating ~hundreds of
        # rows would be over-engineering. The frontend sorts and
        # filters this client-side.
        shows = list(
            Podcast.objects.values(
                "id", "title", "slug", "is_exclusive", "cover_image"
            )
        )
        # Tag each show with its category set so the frontend can
        # mark audiobooks vs music vs regular podcasts without a
        # round trip — these flags are used to colour-code the table.
        cat_pairs = list(
            Podcast.categories.through.objects.values_list(
                "podcast_id", "category__name"
            )
        )
        cats_by_show: dict[int, list[str]] = {}
        for pid, name in cat_pairs:
            cats_by_show.setdefault(pid, []).append((name or "").lower())

        rows = []
        for s in shows:
            sid = s["id"]
            cats = cats_by_show.get(sid, [])
            is_audiobook = any("audiobook" in c for c in cats)
            is_music = any("music" == c for c in cats)
            kind = "audiobook" if is_audiobook else ("music" if is_music else "podcast")
            seconds = seconds_by_show.get(sid, 0)
            rows.append({
                "id": sid,
                "title": s["title"],
                "slug": s["slug"],
                "kind": kind,
                "is_exclusive": bool(s["is_exclusive"]),
                "cover_image": s["cover_image"] or "",
                "episode_count": ep_counts.get(sid, 0),
                "plays": plays_by_show.get(sid, 0),
                "listen_minutes": int(seconds // 60),
                "followers": follows_by_show.get(sid, 0),
            })

        return Response({
            "range": {
                "key": range_label,
                "start": start.isoformat(),
                "end": end.isoformat(),
            },
            "shows": rows,
        })


class AnalyticsEpisodesView(APIView):
    """GET /api/analytics/episodes/?range=30d&page=1&page_size=50&sort=plays&show_id=...&q=...

    Returns paginated, sortable episode-level stats. The catalogue
    is large enough (1,300+ episodes) that we paginate server-side
    rather than ship the whole list with every request. The
    frontend asks for one page at a time as the admin scrolls /
    changes sort.
    """

    permission_classes = [IsAuthenticated, IsStaffSuperuser]

    # Whitelist of allowed sort keys → SQL order-by clause.
    SORT_KEYS = {
        "plays": "-plays",
        "listen": "-listen_minutes",
        "completions": "-completions",
        "title": "title",
        "show": "podcast_title",
    }

    def get(self, request):
        start, end, range_label, is_all_time = _parse_range(request)

        try:
            page = max(1, int(request.query_params.get("page", 1)))
        except (TypeError, ValueError):
            page = 1
        try:
            page_size = int(request.query_params.get("page_size", 50))
        except (TypeError, ValueError):
            page_size = 50
        page_size = max(1, min(page_size, 200))

        sort_key = (request.query_params.get("sort") or "plays").lower()
        order_by = self.SORT_KEYS.get(sort_key, "-plays")

        show_id_param = request.query_params.get("show_id")
        query_param = (request.query_params.get("q") or "").strip()

        # Compute per-episode aggregates against the range-scoped
        # querysets — same logic as the summary view, just keyed by
        # episode_id and without a [:10] truncation. We do the
        # join + sort in Python because Django's reverse-relation
        # aggregation across two source tables (PlaybackEvent and
        # ListeningHistory) doesn't compose into a single SQL
        # ORDER BY without subqueries; doing it in memory keeps the
        # query plan simple at the cost of one extra Python loop
        # over O(episodes) rows.
        play_events = PlaybackEvent.objects.filter(event="play")
        play_in_range = (
            play_events
            if is_all_time
            else play_events.filter(created_at__gte=start, created_at__lt=end)
        )
        complete_events = PlaybackEvent.objects.filter(event="complete")
        complete_in_range = (
            complete_events
            if is_all_time
            else complete_events.filter(created_at__gte=start, created_at__lt=end)
        )
        listen_in_range = (
            ListeningHistory.objects
            if is_all_time
            else ListeningHistory.objects.filter(
                last_played__gte=start, last_played__lt=end
            )
        )

        plays_by_ep: dict[int, int] = {
            r["episode_id"]: r["n"]
            for r in play_in_range.values("episode_id").annotate(n=Count("id"))
        }
        completions_by_ep: dict[int, int] = {
            r["episode_id"]: r["n"]
            for r in complete_in_range.values("episode_id").annotate(n=Count("id"))
        }
        seconds_by_ep: dict[int, int] = {
            r["episode_id"]: r["seconds"] or 0
            for r in listen_in_range.values("episode_id").annotate(
                seconds=Sum("progress")
            )
        }

        episodes_qs = Episode.objects.select_related("podcast")
        if show_id_param:
            episodes_qs = episodes_qs.filter(podcast_id=show_id_param)
        if query_param:
            episodes_qs = episodes_qs.filter(title__icontains=query_param)

        rows = []
        # Episode model uses ``published_at`` for the public release
        # timestamp and ``created_at`` for the row insert time. The
        # admin table cares about release date — listeners see "newest
        # episode" by published_at — so we surface that as
        # ``published_at`` in the response. (A previous version of
        # this view referenced the non-existent ``created_date`` field
        # and 500'd on every call.)
        for ep in episodes_qs.values(
            "id", "title", "podcast_id", "podcast__title", "published_at"
        ):
            eid = ep["id"]
            seconds = seconds_by_ep.get(eid, 0)
            rows.append({
                "id": eid,
                "title": ep["title"],
                "podcast_id": ep["podcast_id"],
                "podcast_title": ep["podcast__title"] or "",
                "published_at": (
                    ep["published_at"].isoformat() if ep["published_at"] else None
                ),
                "plays": plays_by_ep.get(eid, 0),
                "completions": completions_by_ep.get(eid, 0),
                "listen_minutes": int(seconds // 60),
            })

        # Sort in Python on the already-flattened rows. Reverse for
        # any descending key (those are prefixed with "-" in
        # SORT_KEYS); fall back to title as a stable tiebreaker so
        # equal-stat rows don't shuffle between pages.
        descending = order_by.startswith("-")
        sort_field = order_by.lstrip("-")
        rows.sort(
            key=lambda r: (
                -(r.get(sort_field) or 0) if descending and isinstance(r.get(sort_field), (int, float))
                else r.get(sort_field) or "",
                r["title"] or "",
            )
        )
        # If the sort field is a string (title/show) the negation
        # trick above doesn't apply; fall back to a plain
        # alphabetical sort for those keys.
        if sort_field in ("title", "podcast_title"):
            rows.sort(key=lambda r: (r.get(sort_field) or "").lower())

        total = len(rows)
        offset = (page - 1) * page_size
        page_rows = rows[offset : offset + page_size]

        return Response({
            "range": {
                "key": range_label,
                "start": start.isoformat(),
                "end": end.isoformat(),
            },
            "page": page,
            "page_size": page_size,
            "total": total,
            "sort": sort_key,
            "episodes": page_rows,
        })


class AnalyticsEpisodeDetailView(APIView):
    """GET /api/analytics/episodes/<episode_id>/?range=30d

    Detailed stats for a single episode. Powers the click-through
    detail modal in the admin dashboard. Returns:

    * episode metadata (title, show, duration, release date)
    * aggregate stats — both range-scoped and all-time, so admins
      can compare "in the last 30 days" against the lifetime number
    * a daily plays time-series for the active range (buckets shaped
      identically to /summary/'s series so the same chart can render
      both)
    * a 20-bucket position-retention curve (always all-time) showing
      how far through the episode listeners typically get — a
      drop-off cliff at 60% means most people abandon at the
      two-thirds mark, etc.

    The retention curve is computed from ListeningHistory.progress
    relative to Episode.duration. Heartbeat-level position data
    would be more precise but the shape of the curve is the same
    either way, and ListeningHistory is already indexed and
    cheap to scan.
    """

    permission_classes = [IsAuthenticated, IsStaffSuperuser]

    # Number of buckets the position-retention curve is split into.
    # 20 buckets = 5% increments — granular enough to spot a real
    # drop-off cliff, coarse enough not to look noisy when the
    # listener count is small.
    POSITION_BUCKETS = 20

    def get(self, request, episode_id):
        start, end, range_label, is_all_time = _parse_range(request)
        buckets = _daily_buckets(start, end)
        bucket_labels = [d.isoformat() for d in buckets]

        try:
            # Episode model has no ``created_date`` column — the public
            # release timestamp is ``published_at`` and the row insert
            # timestamp is ``created_at``. Asking for ``created_date``
            # raised a FieldError that surfaced as a generic 500 in
            # the admin episode-detail modal.
            episode = (
                Episode.objects
                .select_related("podcast")
                .values(
                    "id", "title", "duration", "published_at",
                    "podcast_id", "podcast__title",
                )
                .get(id=episode_id)
            )
        except Episode.DoesNotExist:
            return Response(
                {"detail": "Episode not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        play_events = PlaybackEvent.objects.filter(episode_id=episode_id, event="play")
        complete_events = PlaybackEvent.objects.filter(
            episode_id=episode_id, event="complete"
        )
        listen_qs = ListeningHistory.objects.filter(episode_id=episode_id)

        # Range-scoped vs all-time aggregates so the modal can show
        # "X plays in the last 30 days · Y all-time" side by side.
        plays_in_range = (
            play_events.count()
            if is_all_time
            else play_events.filter(created_at__gte=start, created_at__lt=end).count()
        )
        completions_in_range = (
            complete_events.count()
            if is_all_time
            else complete_events.filter(created_at__gte=start, created_at__lt=end).count()
        )
        seconds_in_range = (
            listen_qs.aggregate(s=Sum("progress")).get("s") or 0
            if is_all_time
            else listen_qs.filter(last_played__gte=start, last_played__lt=end)
            .aggregate(s=Sum("progress")).get("s") or 0
        )
        listeners_in_range = (
            listen_qs.values("user_id").distinct().count()
            if is_all_time
            else listen_qs.filter(last_played__gte=start, last_played__lt=end)
            .values("user_id").distinct().count()
        )

        total_plays = play_events.count()
        total_completions = complete_events.count()
        total_seconds = listen_qs.aggregate(s=Sum("progress")).get("s") or 0
        total_listeners = listen_qs.values("user_id").distinct().count()

        # Daily plays time-series — same shape as the summary view's
        # series so the frontend's existing BarChart helper renders
        # it without modification.
        plays_series = _counts_per_day(
            play_events.filter(created_at__gte=start, created_at__lt=end)
            if not is_all_time else play_events,
            "created_at",
            buckets,
        )

        # ── Position-retention curve ────────────────────────────────
        # For each listener of this episode, compute the share of
        # the episode's runtime they got through, then bucket those
        # progress percentages into 20 bins. retention[i] is the
        # share of listeners whose progress >= bucket i's lower
        # bound — i.e. "how many people made it at least this far".
        #
        # If the episode has no duration on file (legacy data or a
        # podcast that publishes without it) we skip the curve
        # rather than compute against a zero divisor.
        duration = int(episode["duration"] or 0)
        retention = []
        if duration > 0 and total_listeners > 0:
            progresses = list(
                listen_qs.values_list("user_id", "progress")
            )
            # Per-user max progress (in case a single user/episode
            # row was somehow duplicated; safe-guard).
            by_user: dict[int, int] = {}
            for uid, p in progresses:
                cur = by_user.get(uid, 0)
                if (p or 0) > cur:
                    by_user[uid] = p or 0
            # Convert to fractions of duration, clamped to [0, 1].
            fractions = [
                min(1.0, max(0.0, p / duration)) for p in by_user.values() if p > 0
            ]
            n = len(fractions)
            if n > 0:
                bucket_count = self.POSITION_BUCKETS
                # For each bucket boundary i / bucket_count, count
                # how many listeners' fraction is >= that boundary.
                # i = 0 => everyone (>= 0%). i = bucket_count - 1 =>
                # listeners who reached the last 5% of the episode.
                retention = []
                for i in range(bucket_count):
                    threshold = i / bucket_count
                    reached = sum(1 for f in fractions if f >= threshold)
                    retention.append(round(reached / n, 4))

        completion_rate_in_range = (
            completions_in_range / listeners_in_range
            if listeners_in_range else 0.0
        )

        return Response({
            "id": episode["id"],
            "title": episode["title"],
            "podcast_id": episode["podcast_id"],
            "podcast_title": episode["podcast__title"] or "",
            "duration": duration,
            "published_at": (
                episode["published_at"].isoformat() if episode["published_at"] else None
            ),
            "range": {
                "key": range_label,
                "start": start.isoformat(),
                "end": end.isoformat(),
            },
            "in_range": {
                "plays": plays_in_range,
                "completions": completions_in_range,
                "listen_minutes": int(seconds_in_range // 60),
                "listeners": listeners_in_range,
                "completion_rate": round(completion_rate_in_range, 4),
            },
            "all_time": {
                "plays": total_plays,
                "completions": total_completions,
                "listen_minutes": int(total_seconds // 60),
                "listeners": total_listeners,
                "completion_rate": round(
                    total_completions / total_listeners, 4
                ) if total_listeners else 0.0,
            },
            "series": {
                "labels": bucket_labels,
                "plays": plays_series,
            },
            # 20 bins, 0..1, drawable as a smooth area curve. Always
            # all-time — a position-retention curve scoped to "the
            # last 30 days" tells you about a noisy subset, whereas
            # the all-time shape is the canonical "where do people
            # drop off?" answer.
            "position_retention": retention,
        })


class AnalyticsAudiobooksView(APIView):
    """GET /api/analytics/audiobooks/

    For each audiobook in the catalogue, returns:

    * ``id``, ``title``, ``cover_image``
    * ``total_chapters`` — number of episodes (chapters) in the book
    * ``listener_count`` — distinct users with any progress on it
    * ``completion_count`` — listeners who reached the final chapter
    * ``completion_rate`` — completion_count / listener_count
    * ``avg_chapter_reached`` — mean of each listener's deepest chapter
    * ``drop_off`` — array of length ``total_chapters`` where each
      entry is the share of listeners who reached AT LEAST that
      chapter. ``drop_off[0]`` is always 1.0 (everyone in the
      listener pool reached chapter 1 by definition); ``drop_off[N-1]``
      equals ``completion_rate``.

    The drop-off curve is what the frontend renders as a smooth
    AreaChart per book — at a glance it's obvious where listeners
    fall off (a steep cliff at chapter 4 means chapter 4 is where
    your audiobook loses its audience).

    All-time only — audiobook completion is fundamentally a "who
    finished it" question, and a 30-day window makes the curve
    noisy without telling you anything more useful than the all-time
    one.
    """

    permission_classes = [IsAuthenticated, IsStaffSuperuser]

    def get(self, request):
        # Identify audiobook podcasts. We match by category name (any
        # category with "audiobook" in it) so spelling variants
        # (audiobook / audiobooks / "audio book") all qualify.
        audiobook_ids = list(
            Podcast.categories.through.objects
            .filter(category__name__icontains="audiobook")
            .values_list("podcast_id", flat=True)
            .distinct()
        )
        if not audiobook_ids:
            return Response({"audiobooks": []})

        audiobooks = list(
            Podcast.objects
            .filter(id__in=audiobook_ids)
            .values("id", "title", "cover_image")
        )

        # Pull every chapter for every audiobook in one query, then
        # group + sort in Python. Sorting by published_at ASC gives
        # us the canonical chapter-1-first ordering (Episode's default
        # ordering is `-published_at`, so reversing it yields the
        # release order an audiobook listener expects). Falling back
        # to id keeps behaviour deterministic when two chapters happen
        # to share a published_at timestamp.
        chapter_rows = list(
            Episode.objects
            .filter(podcast_id__in=audiobook_ids)
            .values("id", "podcast_id", "published_at")
            .order_by("podcast_id", "published_at", "id")
        )
        chapters_by_book: dict[int, list[int]] = {}
        for row in chapter_rows:
            chapters_by_book.setdefault(row["podcast_id"], []).append(row["id"])

        # Pull every listening-history row that touches an
        # audiobook, then bucket by (book, user) → deepest chapter
        # index reached. We treat any row with progress>0 OR
        # completed=True as "this user reached this chapter".
        history_rows = list(
            ListeningHistory.objects
            .filter(episode__podcast_id__in=audiobook_ids)
            .values("user_id", "episode_id", "episode__podcast_id", "progress", "completed")
        )

        results = []
        for book in audiobooks:
            book_id = book["id"]
            chapters = chapters_by_book.get(book_id, [])
            total_chapters = len(chapters)
            if total_chapters == 0:
                # Empty audiobook (no episodes seeded yet) — skip.
                continue

            # Map each chapter id → its 0-based index for fast lookup
            chapter_index = {eid: idx for idx, eid in enumerate(chapters)}

            # For every listener of this book, find the deepest
            # chapter index they touched (any progress > 0 counts).
            deepest_by_user: dict[int, int] = {}
            for h in history_rows:
                if h["episode__podcast_id"] != book_id:
                    continue
                if (h["progress"] or 0) <= 0 and not h["completed"]:
                    continue
                idx = chapter_index.get(h["episode_id"])
                if idx is None:
                    continue
                prev = deepest_by_user.get(h["user_id"], -1)
                if idx > prev:
                    deepest_by_user[h["user_id"]] = idx

            listener_count = len(deepest_by_user)
            if listener_count == 0:
                results.append({
                    "id": book_id,
                    "title": book["title"],
                    "cover_image": book["cover_image"] or "",
                    "total_chapters": total_chapters,
                    "listener_count": 0,
                    "completion_count": 0,
                    "completion_rate": 0.0,
                    "avg_chapter_reached": 0.0,
                    # Empty-state curve: zero retention everywhere.
                    "drop_off": [0.0] * total_chapters,
                })
                continue

            # Histogram: how many listeners stopped AT each chapter
            # (i.e. their deepest = N). Used to derive the cumulative
            # "share who reached chapter N or later" curve.
            stopped_at = [0] * total_chapters
            for deepest in deepest_by_user.values():
                if 0 <= deepest < total_chapters:
                    stopped_at[deepest] += 1

            # Build the cumulative drop-off curve. drop_off[i] = share
            # of listeners whose deepest chapter index >= i. This is
            # the canonical "retention at chapter N" curve.
            drop_off = [0.0] * total_chapters
            running = listener_count
            for i in range(total_chapters):
                drop_off[i] = round(running / listener_count, 4)
                running -= stopped_at[i]

            completion_count = stopped_at[total_chapters - 1]
            avg_chapter_reached = (
                sum(deepest_by_user.values()) / listener_count
            )

            results.append({
                "id": book_id,
                "title": book["title"],
                "cover_image": book["cover_image"] or "",
                "total_chapters": total_chapters,
                "listener_count": listener_count,
                "completion_count": completion_count,
                "completion_rate": round(completion_count / listener_count, 4),
                # 1-indexed for human readability — chapter 3.4
                # reads more naturally than "chapter index 2.4".
                "avg_chapter_reached": round(avg_chapter_reached + 1, 2),
                "drop_off": drop_off,
            })

        # Sort by listener_count desc so the most-listened audiobooks
        # surface first — that's what an admin opening this tab
        # almost always wants to see.
        results.sort(key=lambda r: r["listener_count"], reverse=True)

        return Response({"audiobooks": results})
