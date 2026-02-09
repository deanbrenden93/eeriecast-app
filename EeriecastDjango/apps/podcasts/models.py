from django.db import models
from django.contrib.auth import get_user_model

User = get_user_model()

class Podcast(models.Model):
    title = models.TextField()
    slug = models.SlugField(unique=True)
    description = models.TextField()
    creator = models.ForeignKey('creators.Creator', on_delete=models.CASCADE, related_name='podcasts')
    categories = models.ManyToManyField('categories.Category', blank=True, related_name='podcasts')
    cover_image = models.TextField()
    status = models.CharField(max_length=20, choices=[
        ('active', 'Active'),
        ('inactive', 'Inactive'),
        ('draft', 'Draft')
    ], default='active')
    is_trending = models.BooleanField(default=False)
    is_exclusive = models.BooleanField(default=False)
    free_sample_episode = models.ForeignKey(
        'episodes.Episode',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='+',
        help_text='The episode non-premium users can listen to for free on members-only shows.',
    )
    rating = models.DecimalField(max_digits=3, decimal_places=2, default=0.0)
    total_episodes = models.IntegerField(default=0)
    total_duration = models.IntegerField(default=0)  # in minutes
    language = models.CharField(max_length=10, default='en')
    tags = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.title


class FeedSource(models.Model):
    VARIANT_CHOICES = (
        ('ad_supported', 'Ad-Supported'),
        ('ad_free', 'Ad-Free'),
    )

    podcast = models.ForeignKey('podcasts.Podcast', on_delete=models.SET_NULL, null=True, blank=True, related_name='feed_sources')
    feed_url = models.URLField(unique=True, max_length=500)
    variant = models.CharField(max_length=20, choices=VARIANT_CHOICES, default='ad_supported')
    # Defaults/config used by sync command when CLI args are omitted
    creator = models.ForeignKey('creators.Creator', on_delete=models.SET_NULL, null=True, blank=True, help_text="Used when creating a Podcast if not already linked")
    category = models.ForeignKey('categories.Category', on_delete=models.SET_NULL, null=True, blank=True)
    language = models.CharField(max_length=10, null=True, blank=True, help_text="Override language on Podcast")
    update_only = models.BooleanField(default=False, help_text="If true, do not create Podcast if missing")
    limit = models.IntegerField(null=True, blank=True, help_text="Process only first N entries (testing)")
    notes = models.TextField(blank=True, default="")

    etag = models.TextField(null=True, blank=True)
    last_modified = models.TextField(null=True, blank=True)
    last_checked = models.DateTimeField(null=True, blank=True)
    active = models.BooleanField(default=True)
    last_error = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']

    def __str__(self):
        return self.feed_url
