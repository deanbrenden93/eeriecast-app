from __future__ import annotations

import logging
import traceback
from pathlib import Path
from typing import Any

try:
    from celery import shared_task
except ModuleNotFoundError:  # pragma: no cover
    # Allow running the app/test suite in environments where Celery isn't installed.
    def shared_task(*dargs, **dkwargs):
        def _decorator(fn):
            return fn

        # Support both @shared_task and @shared_task(...)
        if dargs and callable(dargs[0]) and not dkwargs:
            return dargs[0]
        return _decorator
from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.db import IntegrityError, transaction
from django.utils import timezone
from django.utils.html import strip_tags
from django.utils.html import escape

from .models import EmailEvent, CeleryTaskLog
from .theme import get_email_theme

logger = logging.getLogger(__name__)


def _get_email_server_details() -> dict[str, Any]:
    backend = getattr(settings, "EMAIL_BACKEND", "django.core.mail.backends.smtp.EmailBackend")
    host = getattr(settings, "EMAIL_HOST", "")
    port: int | None
    raw_port = getattr(settings, "EMAIL_PORT", None)
    try:
        port = int(raw_port) if raw_port is not None and str(raw_port).strip() != "" else None
    except (TypeError, ValueError):
        port = None

    return {
        "email_backend": backend or "",
        "email_host": host or "",
        "email_port": port,
        "email_host_user": getattr(settings, "EMAIL_HOST_USER", "") or "",
        "email_use_tls": getattr(settings, "EMAIL_USE_TLS", None),
        "email_use_ssl": getattr(settings, "EMAIL_USE_SSL", None),
    }


def _render_html_template(template_name: str, context: dict[str, Any]) -> str:
    """Render a very small, HTML-only template.

    We intentionally avoid Django template syntax in these files to keep them
    as plain HTML, and we substitute using __KEY__ tokens.
    """
    templates_root = Path(__file__).resolve().parent / "templates"
    template_path = templates_root / template_name
    raw = template_path.read_text(encoding="utf-8")

    safe_ctx: dict[str, str] = {}
    for k, v in (context or {}).items():
        if v is None:
            safe_ctx[k] = ""
        else:
            safe_ctx[k] = escape(str(v))

    # Replace __KEY__ tokens with values. Tokens are chosen to be valid HTML/CSS.
    rendered = raw
    for k, v in safe_ctx.items():
        token = f"__{k.upper()}__"
        rendered = rendered.replace(token, v)
    return rendered


@shared_task(bind=True)
def send_event_email_task(
    self,
    *,
    event_type: str,
    to_email: str,
    external_id: str,
    subject: str,
    template_name: str,
    context: dict[str, Any],
    user_id: int | None = None,
):
    """Idempotently send an event email.

    Idempotency is enforced via EmailEvent.external_id being unique.
    """
    server_details = _get_email_server_details()

    # Create-or-get the event record first, so webhook retries don't duplicate mail.
    try:
        with transaction.atomic():
            email_event = EmailEvent.objects.create(
                user_id=user_id,
                event_type=event_type,
                to_email=to_email,
                **server_details,
                external_id=external_id,
                status=EmailEvent.STATUS_PENDING,
            )
    except IntegrityError:
        email_event = EmailEvent.objects.filter(external_id=external_id).first()
        if not email_event:
            raise
        # Best-effort backfill for older rows created before server detail fields existed.
        update_fields: list[str] = []
        for k, v in server_details.items():
            if hasattr(email_event, k) and not getattr(email_event, k, None) and v is not None:
                setattr(email_event, k, v)
                update_fields.append(k)
        if update_fields:
            email_event.save(update_fields=[*update_fields, "updated_at"])
        if email_event.status == EmailEvent.STATUS_SENT:
            return

    theme = get_email_theme()
    render_ctx = {
        **(context or {}),
        "subject": subject,
        "app_name": getattr(settings, "EMAIL_APP_NAME", "Eeriecast"),
        "support_email": getattr(settings, "EMAIL_SUPPORT", ""),
        "background": theme.background,
        "card_background": theme.card_background,
        "text": theme.text,
        "subtle_text": theme.subtle_text,
        "border": theme.border,
        "primary": theme.primary,
        "button_text": theme.button_text,
    }

    task_log = CeleryTaskLog.objects.create(
        task_name=self.name,
        task_id=self.request.id,
        args=list(self.request.args or []),
        kwargs=dict(self.request.kwargs or {}),
        worker=getattr(self.request, "hostname", None),
        status=CeleryTaskLog.STATUS_PENDING,
    )

    try:
        html_body = _render_html_template(template_name, render_ctx)
        text_body = strip_tags(html_body)
        from_email = getattr(settings, "DEFAULT_FROM_EMAIL", None) or "no-reply@eeriecast.com"

        redirect_to = (getattr(settings, "EMAIL_REDIRECT_ALL_TO", "") or "").strip()
        actual_to_email = redirect_to or to_email
        actual_subject = subject
        if redirect_to:
            actual_subject = f"[REDIRECTED to {redirect_to}] {subject}"

        msg = EmailMultiAlternatives(
            subject=actual_subject,
            body=text_body,
            from_email=from_email,
            to=[actual_to_email],
        )
        msg.attach_alternative(html_body, "text/html")
        msg.send(fail_silently=False)

        email_event.status = EmailEvent.STATUS_SENT
        email_event.sent_at = timezone.now()
        email_event.error = ""
        email_event.save(update_fields=["status", "sent_at", "error", "updated_at"])

        task_log.status = CeleryTaskLog.STATUS_SUCCESS
        task_log.finished_at = timezone.now()
        task_log.save(update_fields=["status", "finished_at"])
    except Exception as e:
        logger.exception("Failed sending email event %s to %s", event_type, to_email)
        email_event.status = EmailEvent.STATUS_FAILED
        email_event.error = str(e)
        email_event.save(update_fields=["status", "error", "updated_at"])

        task_log.status = CeleryTaskLog.STATUS_FAILURE
        task_log.error = str(e)
        task_log.stack_trace = traceback.format_exc()
        task_log.finished_at = timezone.now()
        task_log.save(update_fields=["status", "error", "stack_trace", "finished_at"])
        raise


@shared_task(bind=True)
def send_renewal_reminder_7_days(self):
    """Send renewal reminders 7 days before current_period_end.

    Suppresses reminders if cancel_at_period_end=True.
    """
    from datetime import timedelta

    from apps.billing.models import Subscription
    from apps.emails import events as email_events

    task_log = CeleryTaskLog.objects.create(
        task_name=self.name,
        task_id=self.request.id,
        args=list(self.request.args or []),
        kwargs=dict(self.request.kwargs or {}),
        worker=getattr(self.request, "hostname", None),
        status=CeleryTaskLog.STATUS_PENDING,
    )

    try:
        now = timezone.now()
        start = now + timedelta(days=7)
        end = start + timedelta(days=1)

        qs = Subscription.objects.select_related('user').filter(
            current_period_end__gte=start,
            current_period_end__lt=end,
            cancel_at_period_end=False,
        )

        sent = 0
        for sub in qs:
            user = getattr(sub, 'user', None)
            if not user or getattr(user, 'is_deleted', False) or not getattr(user, 'is_active', True):
                continue
            if not sub.is_active:
                continue

            period_end = sub.current_period_end
            external_id = f"renewal:{sub.stripe_subscription_id}:{period_end.date().isoformat()}"
            manage_billing_url = f"{settings.REACT_BASE_URL.rstrip('/')}/billing"
            try:
                email_events.send_renewal_reminder_7_days(
                    user_id=user.id,
                    to_email=user.email,
                    external_id=external_id,
                    renewal_date=period_end.date().isoformat(),
                    manage_billing_url=manage_billing_url,
                )
                sent += 1
            except Exception:
                continue

        task_log.status = CeleryTaskLog.STATUS_SUCCESS
        task_log.result = {"sent_count": sent}
        task_log.finished_at = timezone.now()
        task_log.save(update_fields=["status", "result", "finished_at"])
        return sent
    except Exception as e:
        task_log.status = CeleryTaskLog.STATUS_FAILURE
        task_log.error = str(e)
        task_log.stack_trace = traceback.format_exc()
        task_log.finished_at = timezone.now()
        task_log.save(update_fields=["status", "error", "stack_trace", "finished_at"])
        raise
