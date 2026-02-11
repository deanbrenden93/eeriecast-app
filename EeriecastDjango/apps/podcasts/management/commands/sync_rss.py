from typing import Optional

from django.core.management.base import BaseCommand, CommandError
from django.utils.text import slugify
from django.utils import timezone
from django.db import models
from django.core.management import call_command

import feedparser
import requests  # added

from apps.podcasts.models import Podcast, FeedSource
from apps.episodes.models import Episode


class Command(BaseCommand):
    help = "Sync a podcast RSS feed into Podcast and Episode models using FeedSource DB state."

    def add_arguments(self, parser):
        parser.add_argument("--feed-url", required=True, help="RSS feed URL to sync (or create a FeedSource if missing)")
        parser.add_argument("--podcast-slug", help="Existing podcast slug to sync into; if not found, will create if creator supplied")
        parser.add_argument("--creator-id", type=int, help="Creator ID to assign if creating a new Podcast")
        parser.add_argument("--category-id", type=int, help="Category ID to assign if creating/updating")
        parser.add_argument("--language", default=None, help="Override language on Podcast")
        parser.add_argument("--update-only", action="store_true", help="Do not create Podcast if missing")
        parser.add_argument("--limit", type=int, default=None, help="Process only first N entries (for testing)")
        # New: optional de-duplication run after syncing this feed
        parser.add_argument("--dedupe-after", action="store_true", help="Run de-duplication (merge duplicate episodes) after syncing")

    def handle(self, *args, **options):
        feed_url: str = options["feed_url"].strip()
        podcast_slug: Optional[str] = options.get("podcast_slug")
        creator_id: Optional[int] = options.get("creator_id")
        category_id: Optional[int] = options.get("category_id")
        language_override: Optional[str] = options.get("language")
        update_only: bool = options.get("update_only", False)
        limit: Optional[int] = options.get("limit")
        run_dedupe: bool = options.get("dedupe_after", False)

        # Load or create FeedSource
        feed_source, _created = FeedSource.objects.get_or_create(feed_url=feed_url)
        if _created:
            self.stdout.write(self.style.NOTICE(f"Created FeedSource for {feed_url}"))
        if not feed_source.active:
            self.stdout.write(self.style.WARNING("FeedSource is marked inactive; continuing anyway."))

        variant = getattr(feed_source, 'variant', 'ad_supported')

        # Fill in defaults from FeedSource config if CLI args not provided
        if not creator_id and getattr(feed_source, "creator_id", None):
            creator_id = feed_source.creator_id
        if not category_id and getattr(feed_source, "category_id", None):
            category_id = feed_source.category_id
        if language_override is None and getattr(feed_source, "language", None):
            language_override = feed_source.language
        if not options.get("update_only", None):
            update_only = bool(getattr(feed_source, "update_only", False))
        if limit is None and getattr(feed_source, "limit", None) is not None:
            limit = feed_source.limit

        # Resolve or create Podcast target
        podcast = None
        if feed_source.podcast_id:
            podcast = feed_source.podcast
        elif podcast_slug:
            podcast = Podcast.objects.filter(slug=podcast_slug).first()
            if not podcast and update_only:
                feed_source.last_error = f"Podcast with slug '{podcast_slug}' not found and update-only set."
                feed_source.save(update_fields=["last_checked", "etag", "last_modified", "last_error"]) if feed_source.id else None
                raise CommandError(f"Podcast with slug '{podcast_slug}' not found and --update-only set.")

        # Fetch feed with requests (timeout + custom headers)
        self.stdout.write(self.style.NOTICE(f"Fetching feed: {feed_url} (variant={variant})"))
        headers = {
            "User-Agent": "EeriecastFeedSync/1.0 (+https://eeriecast.example)",
            "Accept": "application/rss+xml, application/xml;q=0.9, */*;q=0.8",
        }
        if feed_source.etag:
            headers["If-None-Match"] = feed_source.etag
        if feed_source.last_modified:
            headers["If-Modified-Since"] = feed_source.last_modified

        try:
            resp = requests.get(feed_url, headers=headers, timeout=20)
        except requests.exceptions.RequestException as e:
            feed_source.last_checked = timezone.now()
            feed_source.last_error = f"Network error: {e}"[:2000]
            feed_source.save(update_fields=["last_checked", "last_error"])
            raise CommandError(f"Failed to fetch feed: {e}")

        status_code = resp.status_code
        feed_source.last_checked = timezone.now()

        # Conditional not modified
        if status_code == 304:
            feed_source.last_error = ""
            feed_source.save(update_fields=["last_checked", "last_error"])
            self.stdout.write(self.style.NOTICE("Feed not modified (HTTP 304). Skipping."))
            return

        if status_code >= 400:
            feed_source.last_error = f"HTTP {status_code} error"[:500]
            feed_source.save(update_fields=["last_checked", "last_error"])
            raise CommandError(f"Feed returned HTTP {status_code}")

        # Parse feed content
        parsed = feedparser.parse(resp.content)

        # Update etag / last_modified from response headers if present
        new_etag = resp.headers.get("ETag") or getattr(parsed, "etag", None)
        new_last_modified = resp.headers.get("Last-Modified") or getattr(parsed, "modified", None)
        if new_etag:
            feed_source.etag = new_etag
        if new_last_modified:
            feed_source.last_modified = new_last_modified

        feed = parsed.feed or {}
        entries = list(parsed.entries or [])
        if limit is not None:
            entries = entries[:limit]

        # Attempt to associate with an existing podcast by feed title slug if none provided
        if not podcast:
            feed_title = feed.get("title") or feed_url
            title_slug = slugify(feed_title)[:50]
            existing = Podcast.objects.filter(slug=title_slug).first()
            if existing:
                podcast = existing
                self.stdout.write(self.style.NOTICE(f"Linked to existing podcast by title slug: {title_slug}"))

        # Ensure podcast exists; create if needed
        if not podcast:
            if update_only:
                feed_source.last_error = "Podcast missing and update-only set; skipping creation."
                feed_source.save(update_fields=["last_checked", "etag", "last_modified", "last_error"])
                raise CommandError("Podcast missing and update-only set.")
            if not creator_id:
                feed_source.last_error = "Missing creator for new podcast creation (pass --creator-id or set on FeedSource)"
                feed_source.save(update_fields=["last_checked", "etag", "last_modified", "last_error"])
                raise CommandError("Creating a new podcast requires --creator-id.")
            from apps.creators.models import Creator
            creator = Creator.objects.filter(id=creator_id).first()
            if not creator:
                feed_source.last_error = f"Creator id {creator_id} not found"
                feed_source.save(update_fields=["last_checked", "etag", "last_modified", "last_error"])
                raise CommandError(f"Creator id {creator_id} not found.")

            base_slug = slugify(feed.get("title") or feed_url)[:50]
            unique_slug = base_slug
            i = 2
            while Podcast.objects.filter(slug=unique_slug).exists():
                unique_slug = f"{base_slug}-{i}"[:50]
                i += 1

            podcast = Podcast.objects.create(
                title=feed.get("title") or "Untitled Podcast",
                slug=unique_slug,
                description=feed.get("subtitle") or feed.get("summary") or "",
                creator=creator,
                cover_image=(feed.get("image", {}) or {}).get("href") or (feed.get("image", {}) or {}).get("url") or "",
                language=language_override or feed.get("language") or "en",
                status="active",
                tags=[],
            )
            # Assign category to M2M if provided (from CLI or FeedSource)
            if category_id:
                podcast.categories.add(category_id)
            elif getattr(feed_source, 'category_id', None):
                podcast.categories.add(feed_source.category_id)
            self.stdout.write(self.style.SUCCESS(f"Created podcast '{podcast.title}' (slug={podcast.slug})."))
        else:
            # Update metadata
            changed = False
            title = feed.get("title")
            if title and title != podcast.title:
                podcast.title = title
                changed = True
            desc = feed.get("subtitle") or feed.get("summary")
            if desc and desc != podcast.description:
                podcast.description = desc
                changed = True
            img = (feed.get("image", {}) or {}).get("href") or (feed.get("image", {}) or {}).get("url")
            if img and img != podcast.cover_image:
                podcast.cover_image = img
                changed = True
            if language_override:
                if podcast.language != language_override:
                    podcast.language = language_override
                    changed = True
            elif feed.get("language") and podcast.language != feed.get("language"):
                podcast.language = feed.get("language")
                changed = True
            # For M2M categories: add category if provided
            if category_id:
                try:
                    if not podcast.categories.filter(id=category_id).exists():
                        podcast.categories.add(category_id)
                except Exception:
                    pass
            if changed:
                podcast.save(update_fields=["title", "description", "cover_image", "language"])
                self.stdout.write(self.style.NOTICE("Updated podcast metadata."))

        if not feed_source.podcast_id:
            feed_source.podcast = podcast

        # Upsert Episodes (title-first to avoid dupes across variants)
        created_count = 0
        updated_count = 0
        for e in entries:
            guid = e.get("id") or e.get("guid") or e.get("link") or e.get("title")
            raw_title = e.get("title") or "Untitled Episode"

            description = e.get("summary") or e.get("description") or ""
            audio_url = None
            enclosures = e.get("enclosures") or []
            if enclosures:
                audio_url = enclosures[0].get("href")
            if not audio_url:
                for link in e.get("links", []) or []:
                    if link.get("rel") == "enclosure" and link.get("href"):
                        audio_url = link.get("href")
                        break
            if not audio_url:
                audio_url = e.get("link") or ""

            def parse_duration(val: Optional[str]) -> int:
                if not val:
                    return 0
                try:
                    if isinstance(val, (int, float)):
                        return int(val)
                    s = str(val).strip()
                    if s.isdigit():
                        return int(s)
                    parts = [int(p) for p in s.split(":")]
                    if len(parts) == 3:
                        h, m, sec = parts
                        return h * 3600 + m * 60 + sec
                    if len(parts) == 2:
                        m, sec = parts
                        return m * 60 + sec
                except Exception:
                    return 0
                return 0

            duration = parse_duration(e.get("itunes_duration"))

            image = None
            if isinstance(e.get("image"), dict):
                image = e["image"].get("href")
            if not image and isinstance(e.get("itunes_image"), dict):
                image = e["itunes_image"].get("href")
            thumbs = e.get("media_thumbnail") or []
            if not image and thumbs and isinstance(thumbs[0], dict):
                image = thumbs[0].get("url")

            published_at = None
            try:
                if e.get("published_parsed"):
                    import datetime
                    published_at = datetime.datetime(*e.published_parsed[:6], tzinfo=datetime.timezone.utc)
                elif e.get("updated_parsed"):
                    import datetime
                    published_at = datetime.datetime(*e.updated_parsed[:6], tzinfo=datetime.timezone.utc)
            except Exception:
                published_at = None
            if not published_at:
                published_at = timezone.now()

            # Prefer title-based slug to unify variants; fallback to GUID if no title
            candidate_slug = slugify(raw_title)[:200] or slugify(guid or "")[:200] or f"episode-{podcast.id}"

            defaults = {
                "title": raw_title,
                "description": description,
                "duration": duration,
                "cover_image": image or None,
                "published_at": published_at,
                # Always populate audio_url as a fallback so episodes are
                # playable even if no ad-supported variant exists yet.
                "audio_url": audio_url or "",
            }

            # 1) Try to find an existing episode by exact title (case-insensitive) in this podcast
            ep = Episode.objects.filter(podcast=podcast, title__iexact=raw_title).order_by('-published_at', 'id').first()
            created = False
            changed = False

            # 2) If not found, try by slug (could match historic GUID-based slug)
            if not ep:
                ep = Episode.objects.filter(podcast=podcast, slug=candidate_slug).first()

            # 3) Create if still missing, ensuring slug uniqueness within the podcast
            if not ep:
                unique_slug = candidate_slug
                # ensure unique slug
                if Episode.objects.filter(podcast=podcast, slug=unique_slug).exists():
                    base = unique_slug[:195] or f"episode-{podcast.id}"
                    # Try to append published timestamp, otherwise incrementing counter
                    suffix = published_at.strftime('%Y%m%d%H%M%S') if published_at else (slugify(guid or "")[:8] or "1")
                    trial = f"{base}-{suffix}"[:200]
                    i = 2
                    while Episode.objects.filter(podcast=podcast, slug=trial).exists():
                        trial = f"{base}-{i}"[:200]
                        i += 1
                    unique_slug = trial
                ep = Episode.objects.create(podcast=podcast, slug=unique_slug, **defaults)
                created = True

            # Update/merge fields
            if not created:
                if ep.title != raw_title:
                    ep.title = raw_title
                    changed = True
                if ep.description != description:
                    ep.description = description
                    changed = True
                if (image or None) != ep.cover_image:
                    ep.cover_image = image or None
                    changed = True
                if duration and ep.duration != duration:
                    ep.duration = duration
                    changed = True
                if published_at and ep.published_at != published_at:
                    ep.published_at = published_at
                    changed = True

            # Merge audio URLs by variant
            if variant == 'ad_supported':
                if ep.ad_supported_audio_url != (audio_url or ""):
                    ep.ad_supported_audio_url = audio_url or ""
                    changed = True
                if ep.audio_url != (audio_url or ""):
                    ep.audio_url = audio_url or ""
                    changed = True
            else:
                if ep.ad_free_audio_url != (audio_url or ""):
                    ep.ad_free_audio_url = audio_url or ""
                    changed = True
                # Backfill audio_url if it's empty, so the episode is always
                # playable regardless of user premium status.
                if not ep.audio_url and audio_url:
                    ep.audio_url = audio_url
                    changed = True

            if created:
                created_count += 1
            elif changed:
                ep.save()
                updated_count += 1

        agg = podcast.episodes.aggregate(
            total=models.Count("id"),
            seconds=models.Sum("duration"),
        )
        podcast.total_episodes = agg.get("total") or 0
        seconds = agg.get("seconds") or 0
        podcast.total_duration = int(seconds // 60) if seconds else 0
        podcast.save(update_fields=["total_episodes", "total_duration"])

        # Persist FeedSource
        feed_source.last_error = ""
        feed_source.podcast = podcast
        feed_source.save(update_fields=["podcast", "last_checked", "etag", "last_modified", "last_error"])

        # Optional de-duplication pass for this podcast
        if run_dedupe:
            try:
                call_command("merge_duplicate_episodes", podcast_id=podcast.id)
            except Exception as e:
                self.stderr.write(self.style.WARNING(f"Dedupe pass failed: {e}"))

        self.stdout.write(
            self.style.SUCCESS(
                f"Sync complete (variant={variant}). Episodes created: {created_count}, updated: {updated_count}. "
                f"Totals -> episodes: {podcast.total_episodes}, duration(min): {podcast.total_duration}"
            )
        )
