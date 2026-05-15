from django.db import models
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.conf import settings

class Episode(models.Model):
    podcast = models.ForeignKey('podcasts.Podcast', on_delete=models.CASCADE, related_name='episodes')
    title = models.TextField(blank=True, default="")
    slug = models.TextField()  # Increased from default 50 to 200
    description = models.TextField()
    audio_url = models.TextField()  # was URLField(max_length=200) -> TextField to allow long URLs
    ad_supported_audio_url = models.TextField(blank=True, null=True)  # was URLField
    ad_free_audio_url = models.TextField(blank=True, null=True)  # was URLField
    duration = models.IntegerField()  # in seconds — ad-supported / public runtime
    # Ad-free runtime is slightly shorter than the ad-supported runtime
    # because the premium feed strips out mid-rolls. We store both so card
    # UIs can show the runtime the user will actually hear without having
    # to wait for an audio element to load and report ``audio.duration``.
    # Populated by ``sync_rss`` from the ``itunes:duration`` tag on the
    # ad-free feed variant. Nullable because older episodes (and any podcast
    # without a separate ad-free feed) never get a value here.
    ad_free_duration = models.IntegerField(blank=True, null=True)
    episode_number = models.IntegerField(null=True, blank=True)
    season_number = models.IntegerField(null=True, blank=True)
    is_premium = models.BooleanField(default=False)
    transcript = models.TextField(blank=True)
    cover_image = models.TextField(blank=True, null=True)
    play_count = models.IntegerField(default=0)
    published_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['podcast', 'slug']
        ordering = ['-published_at']

    def __str__(self):
        return f"{self.podcast.title} - {self.title}"

    def get_computed_duration(self, user=None, is_premium=None) -> int:
        """Return the runtime the given user will actually experience.

        Mirrors ``get_computed_audio_url``: premium users get the ad-free
        runtime when available, everyone else gets the ad-supported
        runtime. Falls back to ``duration`` whenever ``ad_free_duration``
        hasn't been populated yet (legacy episodes, or feeds that don't
        ship a separate ad-free variant).

        ``is_premium`` may be passed in by callers that have already
        resolved it for the current request to avoid one
        ``User.is_premium_member`` call per episode in list responses.
        """
        if is_premium is None:
            is_premium = False
            if user is not None and getattr(user, 'is_authenticated', False):
                is_premium = bool(getattr(user, 'is_premium_member', lambda: getattr(user, 'is_premium', False))())
        if is_premium:
            ad_free = getattr(self, 'ad_free_duration', None)
            if ad_free:
                return int(ad_free)
        return int(self.duration or 0)

    def get_computed_audio_url(self, user=None, is_premium=None) -> str:
        # ``is_premium`` may be passed in by callers that have already
        # resolved it for the current request (e.g. a list serializer
        # rendering many episodes). That is the preferred path — it
        # avoids re-running ``User.is_premium_member`` per episode, which
        # otherwise becomes an N+1 query against the Subscription table
        # for any user whose cached premium flag is unset.
        if is_premium is None:
            is_premium = False
            if user is not None and getattr(user, 'is_authenticated', False):
                # Prefer the live method if present, else fall back to boolean flag
                is_premium = bool(getattr(user, 'is_premium_member', lambda: getattr(user, 'is_premium', False))())
        # Prefer ad-free if premium and available
        if is_premium and getattr(self, 'ad_free_audio_url', None):
            return self.ad_free_audio_url
        # Otherwise prefer ad-supported if available
        if getattr(self, 'ad_supported_audio_url', None):
            return self.ad_supported_audio_url
        # Fall back to raw audio_url
        raw = getattr(self, 'audio_url', None)
        if raw:
            return raw
        # Last resort: use ad-free URL even for non-premium users so free
        # sample episodes from ad-free-only feeds are still playable.
        return getattr(self, 'ad_free_audio_url', None) or ''


# Notification signal: when a new Episode is created, notify users who favorited the podcast
try:
    from django.contrib.contenttypes.models import ContentType
    from apps.library.models import Favorite, Notification
    from apps.podcasts.models import Podcast

    @receiver(post_save, sender=Episode)
    def create_episode_notifications(sender, instance: 'Episode', created: bool, **kwargs):
        if not created:
            return
        # Find all users who favorited this podcast
        ct_podcast = ContentType.objects.get_for_model(Podcast)
        favs = Favorite.objects.filter(content_type=ct_podcast, object_id=instance.podcast_id).select_related('user')
        if not favs.exists():
            return
        message = f"New episode in {instance.podcast.title}: {instance.title}"
        notifications = [
            Notification(
                user=f.user,
                podcast_id=instance.podcast_id,
                episode=instance,
                message=message,
            )
            for f in favs
        ]
        # Bulk create for efficiency
        Notification.objects.bulk_create(notifications)
except Exception:
    # During migrations or import-time issues, skip wiring the signal
    pass
