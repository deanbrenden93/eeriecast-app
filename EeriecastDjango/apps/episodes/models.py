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
    duration = models.IntegerField()  # in seconds
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

    def get_computed_audio_url(self, user=None) -> str:
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
