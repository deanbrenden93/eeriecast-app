from django.db import models
from django.contrib.auth import get_user_model
from django.contrib.contenttypes.models import ContentType
from django.contrib.contenttypes.fields import GenericForeignKey
from django.db.models.signals import m2m_changed
from django.dispatch import receiver

User = get_user_model()

class Favorite(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.PositiveIntegerField()
    content_object = GenericForeignKey('content_type', 'object_id')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['user', 'content_type', 'object_id']

class Following(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='following')
    creator = models.ForeignKey('creators.Creator', on_delete=models.CASCADE, related_name='followers')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['user', 'creator']

class PodcastFollowing(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='podcast_followings')
    podcast = models.ForeignKey('podcasts.Podcast', on_delete=models.CASCADE, related_name='followers')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['user', 'podcast']
        ordering = ['-created_at']

class ListeningHistory(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    episode = models.ForeignKey('episodes.Episode', on_delete=models.CASCADE)
    progress = models.IntegerField(default=0)  # in seconds
    duration = models.IntegerField(default=0)  # in seconds, optional snapshot for completion threshold
    playback_rate = models.DecimalField(max_digits=3, decimal_places=2, default=1.0)
    source = models.CharField(max_length=20, blank=True, default="")  # web/ios/android
    device_id = models.CharField(max_length=64, blank=True, default="")
    completed = models.BooleanField(default=False)
    completed_at = models.DateTimeField(null=True, blank=True)
    last_played = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['user', 'episode']
        verbose_name_plural = 'Listening History'
        indexes = [
            models.Index(fields=["user", "last_played"]),
            models.Index(fields=["user", "episode"]),
        ]

    @property
    def percent_complete(self) -> float:
        if not self.duration or self.duration <= 0:
            return 0.0
        if self.progress <= 0:
            return 0.0
        return min(100.0, round((self.progress / max(1, self.duration)) * 100.0, 2))

class PlaybackEvent(models.Model):
    EVENT_CHOICES = (
        ("play", "Play"),
        ("pause", "Pause"),
        ("seek", "Seek"),
        ("heartbeat", "Heartbeat"),
        ("complete", "Complete"),
    )
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    episode = models.ForeignKey('episodes.Episode', on_delete=models.CASCADE)
    event = models.CharField(max_length=20, choices=EVENT_CHOICES)
    position = models.IntegerField(default=0)
    duration = models.IntegerField(default=0)
    playback_rate = models.DecimalField(max_digits=3, decimal_places=2, default=1.0)
    source = models.CharField(max_length=20, blank=True, default="")
    device_id = models.CharField(max_length=64, blank=True, default="")
    client_time = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["user", "created_at"]),
            models.Index(fields=["episode", "created_at"]),
        ]


class Playlist(models.Model):
    """A user-created collection of episodes."""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='playlists')
    name = models.CharField(max_length=255)
    episodes = models.ManyToManyField('episodes.Episode', related_name='playlists', blank=True)
    approximate_length_minutes = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('user', 'name')
        ordering = ['-updated_at']

    def __str__(self):
        return f"{self.name} ({self.user})"

    def recalculate_length(self):
        # Sum episode durations (seconds) and convert to minutes
        total_seconds = self.episodes.aggregate(total=models.Sum('duration'))['total'] or 0
        self.approximate_length_minutes = int(round(total_seconds / 60))
        # Avoid recursive save on m2m signal callers; only save the field
        Playlist.objects.filter(pk=self.pk).update(approximate_length_minutes=self.approximate_length_minutes, updated_at=models.F('updated_at'))


@receiver(m2m_changed, sender=Playlist.episodes.through)
def playlist_episodes_changed(sender, instance: 'Playlist', action, **kwargs):
    if action in {"post_add", "post_remove", "post_clear"}:
        instance.recalculate_length()


class Notification(models.Model):
    """User notifications, e.g., when a followed podcast publishes a new episode."""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notifications')
    podcast = models.ForeignKey('podcasts.Podcast', on_delete=models.CASCADE, related_name='notifications')
    episode = models.ForeignKey('episodes.Episode', on_delete=models.CASCADE, related_name='notifications')
    message = models.TextField()
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["user", "is_read", "created_at"]),
            models.Index(fields=["podcast", "created_at"]),
        ]
        ordering = ['-created_at']
