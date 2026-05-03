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
    """User notifications.

    There are two `kind`s:

      • ``episode`` — system-generated when a followed podcast publishes
        a new episode. Carries `podcast` + `episode` FKs and renders a
        deep-link to the show page in the popover.
      • ``announcement`` — admin-broadcasted from the admin panel
        (apps/admin_tools). Carries a free-form `title`, `message`, and
        an optional `url` (internal path or absolute https://...). The
        `podcast`/`episode` FKs are null for these.

    The shared shape (one model, nullable FKs) keeps the existing
    list/read endpoints + the frontend popover working unchanged —
    `kind` is the discriminator the UI can branch on if it ever needs
    to render the two flavors differently.
    """

    KIND_EPISODE = 'episode'
    KIND_ANNOUNCEMENT = 'announcement'
    KIND_CHOICES = (
        (KIND_EPISODE, 'New episode'),
        (KIND_ANNOUNCEMENT, 'Announcement'),
    )

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notifications')
    # Nullable for announcement broadcasts. The episode-notification
    # signal (apps/episodes/models.py) keeps populating both FKs, so
    # nothing about the existing flow changes — only the schema gains
    # the ability to express "this notification has no podcast/episode."
    podcast = models.ForeignKey(
        'podcasts.Podcast',
        on_delete=models.CASCADE,
        related_name='notifications',
        null=True,
        blank=True,
    )
    episode = models.ForeignKey(
        'episodes.Episode',
        on_delete=models.CASCADE,
        related_name='notifications',
        null=True,
        blank=True,
    )
    kind = models.CharField(max_length=20, choices=KIND_CHOICES, default=KIND_EPISODE)
    # Optional bold lead-in shown above the message in the popover.
    # Episode notifications today don't set this (the message itself
    # already starts with "New episode in {show}: ..."), so the field
    # stays blank for legacy rows.
    title = models.CharField(max_length=120, blank=True, default='')
    message = models.TextField()
    # Optional click target. Internal paths (`/Library`, `/Episodes?id=42`)
    # go through react-router; absolute URLs (`https://eeriecast.com/lore`)
    # open via window.location. Validation happens at the serializer
    # layer in apps/admin_tools so the model itself stays permissive.
    url = models.CharField(max_length=500, blank=True, default='')
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["user", "is_read", "created_at"]),
            models.Index(fields=["podcast", "created_at"]),
            # Lets admin tooling efficiently page through past
            # broadcasts without scanning every episode-notification.
            models.Index(fields=["kind", "created_at"]),
        ]
        ordering = ['-created_at']
