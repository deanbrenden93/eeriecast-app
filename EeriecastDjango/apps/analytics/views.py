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
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.billing.models import Subscription
from apps.episodes.models import Episode
from apps.library.models import Favorite, ListeningHistory, PlaybackEvent, PodcastFollowing
from apps.podcasts.models import Podcast

from .permissions import IsStaffSuperuser

User = get_user_model()

RANGE_CHOICES = {
    "24h": timedelta(hours=24),
    "7d": timedelta(days=7),
    "30d": timedelta(days=30),
    "90d": timedelta(days=90),
    "1y": timedelta(days=365),
}


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


def _parse_range(request) -> tuple[datetime, datetime, str]:
    """Resolve `?range=` or `?start=&end=` into an (inclusive-start, exclusive-end) pair.

    Returns (start, end, label). `label` is one of the RANGE_CHOICES
    keys or 'custom'.
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
        return start, end, "custom"

    delta = RANGE_CHOICES.get(range_key, RANGE_CHOICES["30d"])
    return now - delta, now, range_key if range_key in RANGE_CHOICES else "30d"


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
        start, end, range_label = _parse_range(request)
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

        # Churn % over the range: cancellations / (active at start)
        active_at_start = all_subs.filter(
            created_at__lt=start,
        ).filter(
            Q(canceled_at__isnull=True) | Q(canceled_at__gte=start)
        ).count()
        churn_rate = (canceled_in_range / active_at_start) if active_at_start else 0.0

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
        fav_counts: dict[int, int] = {
            row["object_id"]: row["n"]
            for row in podcast_favs.values("object_id").annotate(n=Count("id"))
        }
        legacy_counts: dict[int, int] = {
            row["podcast_id"]: row["n"]
            for row in legacy_follows.values("podcast_id").annotate(n=Count("id"))
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

        # Top 10 episodes by plays & by listen time.
        top_ep_plays_rows = list(
            play_events
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
            ListeningHistory.objects
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
        # episodes of the show.
        top_show_plays_rows = list(
            play_events
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
            ListeningHistory.objects
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
