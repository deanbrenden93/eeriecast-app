from django.core.management.base import BaseCommand
from django.db import transaction
from django.db.models import Count
from django.contrib.contenttypes.models import ContentType

from apps.episodes.models import Episode
from apps.library.models import ListeningHistory, PlaybackEvent, Notification, Playlist, Favorite

import logging

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = (
        "Find duplicate Episodes (same podcast + exact same title), merge their data "
        "(ad_free_audio_url/ad_supported_audio_url, play_count, missing fields), reassign related objects, and delete duplicates."
    )

    def add_arguments(self, parser):
        parser.add_argument("--podcast-id", type=int, default=None, help="Limit to a specific podcast id")
        parser.add_argument("--dry-run", action="store_true", help="Only print what would change; make no DB changes")
        parser.add_argument("--limit", type=int, default=None, help="Stop after merging N duplicate groups")

    def handle(self, *args, **options):
        podcast_id = options.get("podcast_id")
        dry_run = options.get("dry_run", False)
        limit = options.get("limit")

        dup_qs = (
            Episode.objects.values("podcast_id", "title")
            .annotate(cnt=Count("id"))
            .filter(cnt__gt=1)
        )
        if podcast_id:
            dup_qs = dup_qs.filter(podcast_id=podcast_id)

        groups = list(dup_qs)
        self.stdout.write(self.style.NOTICE(f"Found {len(groups)} duplicate title group(s)") )

        processed = 0
        for grp in groups:
            if limit is not None and processed >= limit:
                break
            self._merge_group(grp["podcast_id"], grp["title"], dry_run)
            processed += 1

        self.stdout.write(self.style.SUCCESS(f"Processed {processed} group(s)"))

    def _choose_canonical(self, episodes):
        """
        Choose a canonical Episode to keep using a deterministic preference:
        - Prefer one that already has both ad_free_audio_url and ad_supported_audio_url
        - Else prefer one with ad_free_audio_url
        - Else prefer one with ad_supported_audio_url
        - Else prefer the most recently published; tie-breaker by lowest id
        """
        def score(ep: Episode):
            has_free = bool(ep.ad_free_audio_url)
            has_ad = bool(ep.ad_supported_audio_url)
            both = 2 if (has_free and has_ad) else 0
            only_free = 1 if (has_free and not has_ad) else 0
            only_ad = 1 if (has_ad and not has_free) else 0
            return (both, only_free, only_ad, ep.published_at or ep.created_at, -ep.id)

        episodes_sorted = sorted(episodes, key=score, reverse=True)
        return episodes_sorted[0]

    def _merge_group(self, podcast_id: int, title: str, dry_run: bool):
        eps = list(Episode.objects.filter(podcast_id=podcast_id, title=title).order_by("-published_at", "id"))
        if len(eps) < 2:
            return
        keep = self._choose_canonical(eps)
        to_merge = [e for e in eps if e.id != keep.id]

        self.stdout.write(f"Merging {len(to_merge)} duplicate(s) into Episode#{keep.id} for podcast={podcast_id} title='{title}'")

        if dry_run:
            for e in to_merge:
                self.stdout.write(f"  - would delete Episode#{e.id}")
            return

        with transaction.atomic():
            # Merge fields into 'keep' without overwriting existing non-empty values
            updates = {}

            if not keep.ad_free_audio_url:
                for e in to_merge:
                    if e.ad_free_audio_url:
                        updates["ad_free_audio_url"] = e.ad_free_audio_url
                        break

            if not keep.ad_supported_audio_url:
                for e in to_merge:
                    if e.ad_supported_audio_url:
                        updates["ad_supported_audio_url"] = e.ad_supported_audio_url
                        break

            # Optionally fill other empty fields from duplicates
            for field in ("cover_image", "transcript", "description"):
                if not getattr(keep, field):
                    for e in to_merge:
                        val = getattr(e, field)
                        if val:
                            updates[field] = val
                            break

            # Sum play_count
            total_play_count = keep.play_count + sum((e.play_count or 0) for e in to_merge)
            if total_play_count != keep.play_count:
                updates["play_count"] = total_play_count

            if updates:
                Episode.objects.filter(pk=keep.pk).update(**updates)
                for k, v in updates.items():
                    setattr(keep, k, v)

            # Reassign related objects to 'keep'
            self._reassign_related(keep, to_merge)

            # Finally, delete the duplicates
            Episode.objects.filter(id__in=[e.id for e in to_merge]).delete()

    def _reassign_related(self, keep: Episode, duplicates):
        dup_ids = [e.id for e in duplicates]

        # ListeningHistory (unique_together user+episode) -> may collide; resolve by merge
        for lh in ListeningHistory.objects.filter(episode_id__in=dup_ids):
            exists = ListeningHistory.objects.filter(user_id=lh.user_id, episode_id=keep.id).first()
            if exists:
                # merge progress heuristically: take max progress/duration and completed flag
                merged_progress = max(exists.progress, lh.progress)
                merged_duration = max(exists.duration, lh.duration)
                merged_completed = exists.completed or lh.completed
                ListeningHistory.objects.filter(pk=exists.pk).update(
                    progress=merged_progress,
                    duration=merged_duration,
                    completed=merged_completed,
                )
                lh.delete()
            else:
                ListeningHistory.objects.filter(pk=lh.pk).update(episode_id=keep.id)

        # PlaybackEvent: just repoint
        PlaybackEvent.objects.filter(episode_id__in=dup_ids).update(episode_id=keep.id)

        # Notification: repoint; dedupe not expected here
        Notification.objects.filter(episode_id__in=dup_ids).update(episode_id=keep.id)

        # Favorites for Episode via GenericForeignKey
        ct_episode = ContentType.objects.get_for_model(Episode)
        for fav in Favorite.objects.filter(content_type=ct_episode, object_id__in=dup_ids):
            exists = Favorite.objects.filter(user_id=fav.user_id, content_type=ct_episode, object_id=keep.id).exists()
            if exists:
                fav.delete()
            else:
                Favorite.objects.filter(pk=fav.pk).update(object_id=keep.id)

        # Playlists m2m: update through table carefully to avoid unique collisions
        Through = Playlist.episodes.through
        through_rows = list(Through.objects.filter(episode_id__in=dup_ids))
        for row in through_rows:
            # if the playlist already contains 'keep', drop this row
            if Through.objects.filter(playlist_id=row.playlist_id, episode_id=keep.id).exists():
                row.delete()
            else:
                Through.objects.filter(pk=row.pk).update(episode_id=keep.id)

