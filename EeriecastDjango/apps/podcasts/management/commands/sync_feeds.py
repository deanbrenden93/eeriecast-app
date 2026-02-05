from django.core.management.base import BaseCommand
from django.core.management import call_command
from django.utils import timezone
import logging

from apps.podcasts.models import FeedSource

logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = "Sync all active podcast feeds defined in FeedSource table."

    def add_arguments(self, parser):
        parser.add_argument("--only-feed-url", action="append", help="Sync only specified feed URL(s). Can be passed multiple times.")
        parser.add_argument("--inactive", action="store_true", help="Include inactive feeds as well.")
        parser.add_argument("--limit", type=int, default=None, help="Override per-feed entry limit for this run.")
        parser.add_argument("--update-only", action="store_true", help="Force update-only mode for this run.")
        parser.add_argument("--dry-run", action="store_true", help="List which feeds would be synced without doing it.")
        parser.add_argument("--dedupe-after", action="store_true", help="Run duplicate episode merge after each feed sync")

    def handle(self, *args, **options):
        only_urls = options.get("only_feed_url") or []
        include_inactive = options.get("inactive", False)
        override_limit = options.get("limit")
        force_update_only = options.get("update_only", False)
        dry_run = options.get("dry_run", False)
        dedupe_after = options.get("dedupe_after", False)

        qs = FeedSource.objects.all()
        if not include_inactive:
            qs = qs.filter(active=True)
        if only_urls:
            qs = qs.filter(feed_url__in=only_urls)

        count = qs.count()
        start_ts = timezone.now().isoformat()
        logger.info("[SyncFeeds] Starting run at %s; feeds=%d", start_ts, count)
        self.stdout.write(self.style.NOTICE(f"Starting sync for {count} feed(s) at {start_ts}"))

        if count == 0:
            logger.info("[SyncFeeds] No feeds matched. Exiting.")
            self.stdout.write(self.style.WARNING("No FeedSource rows matched criteria."))
            return

        for fs in qs.iterator():
            if dry_run:
                logger.info("[SyncFeeds] DRY RUN -> %s", fs.feed_url)
                self.stdout.write(f"[DRY RUN] Would sync: {fs.feed_url}")
                continue
            logger.info("[SyncFeeds] Syncing %s", fs.feed_url)
            try:
                cmd_kwargs = {"feed_url": fs.feed_url}
                # Let sync_rss pick up other defaults from FeedSource row
                if override_limit is not None:
                    cmd_kwargs["limit"] = override_limit
                if force_update_only:
                    cmd_kwargs["update_only"] = True
                if dedupe_after:
                    cmd_kwargs["dedupe_after"] = True
                call_command("sync_rss", **cmd_kwargs)
                logger.info("[SyncFeeds] OK %s", fs.feed_url)
            except Exception as e:
                # Record error but continue
                fs.last_error = str(e)
                fs.last_checked = timezone.now()
                fs.save(update_fields=["last_error", "last_checked"])
                logger.exception("[SyncFeeds] FAIL %s: %s", fs.feed_url, e)
                self.stderr.write(self.style.ERROR(f"Failed to sync {fs.feed_url}: {e}"))

        logger.info("[SyncFeeds] Completed run at %s", timezone.now().isoformat())
        self.stdout.write(self.style.SUCCESS("All feeds processed."))
