from django.db import models
from django.contrib.auth import get_user_model

User = get_user_model()

class Creator(models.Model):
    display_name = models.CharField(max_length=100)
    bio = models.TextField(blank=True)
    avatar = models.URLField(blank=True, null=True)
    cover_image = models.ImageField(blank=True, null=True)
    website = models.URLField(blank=True, null=True)
    social_links = models.JSONField(default=dict, blank=True)
    is_verified = models.BooleanField(default=False)
    is_featured = models.BooleanField(default=False)
    follower_count = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.display_name
