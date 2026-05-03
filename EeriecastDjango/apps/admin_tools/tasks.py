"""Celery tasks for admin outreach.

Currently just one — ``broadcast_notification_task`` — which fans a
single admin-composed announcement out to a row in every active user's
notification feed. We do this in a task (rather than inline in the
request) so:

  • The HTTP request returns immediately, even with hundreds of
    thousands of users on the platform. The admin sees a "Sending to N
    users" toast within ~50ms.
  • Failures don't take the request down with them. The Celery
    ``CeleryTaskLog`` row gives admins a paper trail and a place to
    inspect tracebacks.
  • Bulk-create can chunk through the user table without holding a
    web worker hostage.

The fan-out itself is one ``bulk_create`` per chunk — fast enough that
the whole task usually finishes in a few seconds even for large user
counts.
"""
from __future__ import annotations

import logging
import traceback

try:
    from celery import shared_task
except ModuleNotFoundError:  # pragma: no cover
    # Mirror of the shim in apps/authentication/tasks.py — lets the
    # test suite run in environments where Celery isn't installed.
    def shared_task(*dargs, **dkwargs):
        def _decorator(fn):
            return fn

        if dargs and callable(dargs[0]) and not dkwargs:
            return dargs[0]
        return _decorator

from django.contrib.auth import get_user_model
from django.utils import timezone

logger = logging.getLogger(__name__)

User = get_user_model()

# Tune for your DB. Postgres handles 1k row inserts at a time with
# negligible overhead; bigger chunks risk running into max_packet
# / parameter limits under heavy load.
BULK_INSERT_CHUNK = 1000


def _broadcast_audience_qs():
    """Centralized definition of "who receives a broadcast".

    Active, non-deleted accounts. Email verification is intentionally
    NOT required: notifications are an in-app channel, separate from
    marketing email, and unverified users still see the popover.
    """
    return User.objects.filter(is_active=True, is_deleted=False)


@shared_task(bind=True, name="admin_tools.broadcast_notification")
def broadcast_notification_task(self, *, title: str, body: str, url: str = "") -> dict:
    """Create one ``Notification`` row per active user.

    Idempotency note: this task is NOT idempotent — re-running it
    creates a second batch of notifications. The admin endpoint that
    enqueues it always wraps the call in a confirmation dialog
    (frontend) and a serializer-validated POST (backend), so accidental
    double-fires are rare. If we ever need true idempotency, attach an
    ``external_id`` (UUID per request) and unique it on insert.
    """
    from apps.emails.models import CeleryTaskLog
    from apps.library.models import Notification

    task_log = CeleryTaskLog.objects.create(
        task_name=self.name,
        task_id=getattr(self.request, "id", None),
        args=list(getattr(self.request, "args", None) or []),
        kwargs=dict(getattr(self.request, "kwargs", None) or {}),
        worker=getattr(self.request, "hostname", None),
        status=CeleryTaskLog.STATUS_PENDING,
    )

    logger.info(
        "[admin_tools] Starting broadcast (task_id=%s, title=%r)",
        getattr(self.request, "id", "unknown"),
        title,
    )

    try:
        audience = _broadcast_audience_qs().only("id")
        total = 0

        # Iterate in chunks so we never load the whole user table into
        # memory at once. ``iterator(chunk_size=...)`` keeps memory
        # bounded; the per-chunk ``bulk_create`` keeps the DB chatter
        # bounded too.
        buffer: list[Notification] = []
        for user_id in audience.values_list("id", flat=True).iterator(chunk_size=BULK_INSERT_CHUNK):
            buffer.append(
                Notification(
                    user_id=user_id,
                    kind=Notification.KIND_ANNOUNCEMENT,
                    title=title or "",
                    message=body or "",
                    url=url or "",
                )
            )
            if len(buffer) >= BULK_INSERT_CHUNK:
                Notification.objects.bulk_create(buffer)
                total += len(buffer)
                buffer.clear()
        if buffer:
            Notification.objects.bulk_create(buffer)
            total += len(buffer)
            buffer.clear()

        logger.info(
            "[admin_tools] Broadcast complete (task_id=%s, recipients=%d)",
            getattr(self.request, "id", "unknown"),
            total,
        )

        task_log.status = CeleryTaskLog.STATUS_SUCCESS
        task_log.result = {"recipients": total, "title": title}
        task_log.finished_at = timezone.now()
        task_log.save(update_fields=["status", "result", "finished_at"])

        return {"success": True, "recipients": total}

    except Exception as e:
        logger.exception(
            "[admin_tools] Broadcast failed (task_id=%s): %s",
            getattr(self.request, "id", "unknown"),
            e,
        )
        task_log.status = CeleryTaskLog.STATUS_FAILURE
        task_log.error = str(e)
        task_log.stack_trace = traceback.format_exc()
        task_log.finished_at = timezone.now()
        task_log.save(update_fields=["status", "error", "stack_trace", "finished_at"])
        raise
