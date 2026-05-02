"""Library signal handlers.

Currently wires recommendation-profile cache invalidation. The For You
ranker caches a per-user profile (follows + favorites + engagement-
weighted history + derived category/creator preferences) for a few
minutes; whenever a write lands that materially changes that profile,
we bust the cached copy so the next feed request sees fresh signals.

Heartbeat updates to ``ListeningHistory`` (every few seconds while
playing) are intentionally NOT a bust trigger — they re-save the row
to bump ``last_played`` but don't materially change the profile, and
busting on each would defeat the cache. We bust only on:

  * Brand-new history rows (``created=True``) — a previously-untouched
    episode entered the user's listening graph.
  * Completion (``completed=True``) — the engagement weight for that
    episode jumps from a fractional value to a full 1.0.
  * Any follow / unfollow / favorite / unfavorite — explicit
    user-driven taste signals that should reflect immediately.
"""
from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from apps.episodes.views import bust_reco_profile_cache

from .models import Favorite, ListeningHistory, PodcastFollowing


@receiver(post_save, sender=PodcastFollowing)
def _bust_on_follow(sender, instance, **kwargs):
    bust_reco_profile_cache(instance.user_id)


@receiver(post_delete, sender=PodcastFollowing)
def _bust_on_unfollow(sender, instance, **kwargs):
    bust_reco_profile_cache(instance.user_id)


@receiver(post_save, sender=Favorite)
def _bust_on_favorite(sender, instance, **kwargs):
    bust_reco_profile_cache(instance.user_id)


@receiver(post_delete, sender=Favorite)
def _bust_on_unfavorite(sender, instance, **kwargs):
    bust_reco_profile_cache(instance.user_id)


@receiver(post_save, sender=ListeningHistory)
def _bust_on_listening_event(sender, instance, created, **kwargs):
    if created or instance.completed:
        bust_reco_profile_cache(instance.user_id)
