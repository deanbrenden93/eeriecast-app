"""DRF views for admin outreach endpoints.

All gated by ``IsStaffSuperuser`` (the project's strongest admin
gate — used by analytics for the same reason: revenue + PII). The
project's REST_FRAMEWORK default is AllowAny, so every view here MUST
explicitly declare ``permission_classes``.
"""
from __future__ import annotations

import csv
from datetime import datetime

from django.contrib.auth import get_user_model
from django.http import StreamingHttpResponse
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.analytics.permissions import IsStaffSuperuser

from .serializers import NotificationBroadcastSerializer
from .tasks import broadcast_notification_task, _broadcast_audience_qs

User = get_user_model()


# ── Email export ──────────────────────────────────────────────────


def _email_audience_qs(verified_only: bool):
    """Single source of truth for "who lands in the email export".

    Always excludes soft-deleted and inactive accounts. ``verified_only``
    additionally requires ``email_verified=True`` — the safe default
    for any external email tool, since unverified addresses bounce and
    bounces hurt the sending domain's reputation.
    """
    qs = User.objects.filter(is_active=True, is_deleted=False)
    if verified_only:
        qs = qs.filter(email_verified=True)
    return qs


def _parse_bool(raw: str | None, default: bool = True) -> bool:
    """Parse the ``verified_only`` query param leniently.

    DRF doesn't auto-coerce GET params, and the frontend stringifies
    "true"/"false" — accept the obvious truthy spellings so an admin
    typing the URL by hand also gets the expected behavior.
    """
    if raw is None:
        return default
    return str(raw).strip().lower() in ("1", "true", "yes", "y", "on")


class _CSVEcho:
    """File-like object whose ``write`` returns its argument.

    Required by ``csv.writer`` when paired with Django's
    ``StreamingHttpResponse`` — the writer expects a file with a
    ``write()`` method, but the streaming response wants each ``write``
    return value to be the row to ship out.
    """

    def write(self, value):
        return value


class EmailAudienceView(APIView):
    """``GET /api/admin/emails/audience/?verified_only=true``

    Returns ``{count}`` so the admin UI can show a live recipient count
    next to the verified-only toggle. Cheap COUNT(*); ms-scale.
    """

    permission_classes = [IsAuthenticated, IsStaffSuperuser]

    def get(self, request):
        verified_only = _parse_bool(request.query_params.get("verified_only"), default=True)
        count = _email_audience_qs(verified_only).count()
        return Response({"count": count, "verified_only": verified_only})


class EmailExportView(APIView):
    """``GET /api/admin/emails/export/?verified_only=true``

    Streams a CSV with columns:
    ``email, first_name, last_name, email_verified, is_premium, date_joined``.

    Streaming (rather than building the whole CSV in memory) means this
    works fine even with hundreds of thousands of rows. The
    ``Content-Disposition`` header sets a date-stamped filename so the
    download lands as ``eeriecast-emails-2026-05-03.csv`` instead of a
    generic ``export.csv``.
    """

    permission_classes = [IsAuthenticated, IsStaffSuperuser]

    COLUMNS = ("email", "first_name", "last_name", "email_verified", "is_premium", "date_joined")

    def get(self, request):
        verified_only = _parse_bool(request.query_params.get("verified_only"), default=True)
        qs = (
            _email_audience_qs(verified_only)
            .only(*self.COLUMNS)
            .order_by("date_joined")
        )

        writer = csv.writer(_CSVEcho())

        def row_iter():
            yield writer.writerow(self.COLUMNS)
            for u in qs.iterator(chunk_size=2000):
                yield writer.writerow([
                    u.email or "",
                    u.first_name or "",
                    u.last_name or "",
                    "true" if u.email_verified else "false",
                    "true" if u.is_premium else "false",
                    u.date_joined.isoformat() if u.date_joined else "",
                ])

        stamp = datetime.utcnow().strftime("%Y-%m-%d")
        filename = (
            f"eeriecast-verified-emails-{stamp}.csv"
            if verified_only
            else f"eeriecast-all-emails-{stamp}.csv"
        )

        response = StreamingHttpResponse(row_iter(), content_type="text/csv; charset=utf-8")
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        # Prevent caches/proxies from saving a copy of a list of every
        # user's email address. Belt and suspenders alongside the
        # admin-only auth gate above.
        response["Cache-Control"] = "private, no-store, max-age=0"
        return response


# ── Notification broadcast ────────────────────────────────────────


class NotificationAudienceView(APIView):
    """``GET /api/admin/notifications/audience/``

    Returns ``{count}`` for the broadcast UI. Filters identically to
    ``broadcast_notification_task`` (active + non-deleted) so the count
    the admin sees is the count that will actually receive a row.
    """

    permission_classes = [IsAuthenticated, IsStaffSuperuser]

    def get(self, request):
        return Response({"count": _broadcast_audience_qs().count()})


class NotificationBroadcastView(APIView):
    """``POST /api/admin/notifications/broadcast/``

    Body: ``{title, body, url?}``. Validates via
    ``NotificationBroadcastSerializer``, enqueues the Celery fan-out
    task, returns the task id and the queued recipient count
    immediately so the UI can show a "Sent to N users" toast without
    waiting on the task.
    """

    permission_classes = [IsAuthenticated, IsStaffSuperuser]

    def post(self, request):
        serializer = NotificationBroadcastSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        # Snapshot the audience size at enqueue time so the UI can
        # display a number immediately. The actual recipient count
        # written by the task is reported separately in CeleryTaskLog.
        recipient_count = _broadcast_audience_qs().count()

        task = broadcast_notification_task.delay(
            title=data["title"],
            body=data["body"],
            url=data["url"],
        )

        return Response(
            {
                "task_id": getattr(task, "id", None),
                "queued_recipients": recipient_count,
            },
            status=202,
        )
