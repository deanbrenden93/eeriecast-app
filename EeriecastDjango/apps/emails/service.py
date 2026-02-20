from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from django.conf import settings

from .tasks import send_event_email_task


@dataclass(frozen=True)
class EmailMessageSpec:
    subject: str
    template_name: str
    context: dict[str, Any]


def enqueue_event_email(
    *,
    event_type: str,
    to_email: str,
    external_id: str,
    subject: str,
    template_name: str,
    context: dict[str, Any] | None = None,
    user_id: int | None = None,
):
    """Queue an event email.

    This is intentionally thin; the Celery task owns idempotency and sending.
    """
    payload = dict(
        event_type=event_type,
        to_email=to_email,
        external_id=external_id,
        subject=subject,
        template_name=template_name,
        context=context or {},
        user_id=user_id,
    )

    # In tests (and other eager environments), avoid contacting the broker/result backend.
    if bool(getattr(settings, "CELERY_TASK_ALWAYS_EAGER", False)):
        # send_event_email_task is a Celery Task when Celery is installed.
        run = getattr(send_event_email_task, "run", None)
        if callable(run):
            run(**payload)
            return
        # Fallback: if Celery isn't installed, shared_task shim returns a plain function.
        send_event_email_task(None, **payload)  # type: ignore[arg-type]
        return

    delay = getattr(send_event_email_task, "delay", None)
    if callable(delay):
        delay(**payload)
        return

    # No Celery available; run synchronously.
    send_event_email_task(None, **payload)  # type: ignore[arg-type]


def make_app_url(path: str) -> str:
    base = getattr(settings, "REACT_BASE_URL", "") or ""
    if base.endswith("/"):
        base = base[:-1]
    if not path.startswith("/"):
        path = "/" + path
    return base + path
