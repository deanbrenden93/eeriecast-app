from celery import shared_task
from django.core.management import call_command
import logging

logger = logging.getLogger(__name__)

@shared_task(bind=True, name="podcasts.sync_all_feeds")
def sync_all_feeds_task(self):
    logger.info("[Celery] Starting daily feed sync (task_id=%s)", getattr(self.request, 'id', 'unknown'))
    try:
        call_command("sync_feeds")
        logger.info("[Celery] Completed daily feed sync (task_id=%s)", getattr(self.request, 'id', 'unknown'))
    except Exception as e:
        logger.exception("[Celery] Feed sync failed (task_id=%s): %s", getattr(self.request, 'id', 'unknown'), e)
        raise
