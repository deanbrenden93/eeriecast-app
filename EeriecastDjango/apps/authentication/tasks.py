from __future__ import annotations

import logging
import traceback
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

from django.core.management import call_command
from django.utils import timezone

logger = logging.getLogger(__name__)


@shared_task(bind=True, name="authentication.check_legacy_trial_expiration")
def check_legacy_trial_expiration(self):
    """Check for expired legacy free trials and revoke premium access.

    Runs daily to find migrated Memberful users whose trial period has ended
    and removes their premium access. Users will need to subscribe to regain access.
    """
    from apps.emails.models import CeleryTaskLog

    task_log = CeleryTaskLog.objects.create(
        task_name=self.name,
        task_id=self.request.id,
        args=list(self.request.args or []),
        kwargs=dict(self.request.kwargs or {}),
        worker=getattr(self.request, "hostname", None),
        status=CeleryTaskLog.STATUS_PENDING,
    )

    logger.info(
        "[Celery] Starting legacy trial expiration check (task_id=%s)",
        getattr(self.request, 'id', 'unknown')
    )

    try:
        # Use StringIO to capture command output
        from io import StringIO
        out = StringIO()

        # Call the management command
        call_command('check_expired_trials', stdout=out)

        output = out.getvalue()
        logger.info(
            "[Celery] Completed legacy trial expiration check (task_id=%s): %s",
            getattr(self.request, 'id', 'unknown'),
            output.strip()
        )

        task_log.status = CeleryTaskLog.STATUS_SUCCESS
        task_log.result = {"output": output.strip()}
        task_log.finished_at = timezone.now()
        task_log.save(update_fields=["status", "result", "finished_at"])

        return {"success": True, "output": output.strip()}

    except Exception as e:
        logger.exception(
            "[Celery] Legacy trial expiration check failed (task_id=%s): %s",
            getattr(self.request, 'id', 'unknown'),
            e
        )

        task_log.status = CeleryTaskLog.STATUS_FAILURE
        task_log.error = str(e)
        task_log.stack_trace = traceback.format_exc()
        task_log.finished_at = timezone.now()
        task_log.save(update_fields=["status", "error", "stack_trace", "finished_at"])

        raise
