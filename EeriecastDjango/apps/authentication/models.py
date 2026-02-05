from django.contrib.auth.models import AbstractUser
from django.db import models

class User(AbstractUser):
    email = models.EmailField(unique=True)
    avatar = models.URLField(blank=True, null=True)
    bio = models.TextField(blank=True)
    is_premium = models.BooleanField(default=False)
    minutes_listened = models.IntegerField(default=0)
    subscription_expires = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username']

    def is_premium_member(self) -> bool:
        """
        Return True if this user has any active subscription record.
        This checks the billing.Subscription.is_active property rather than the cached is_premium flag.
        """
        try:
            # Lazy import to avoid circular imports at import time
            from apps.billing.models import Subscription
        except Exception:
            # If billing app is not installed, fall back to the stored flag
            return bool(getattr(self, 'is_premium', False))

        qs = Subscription.objects.filter(user=self)
        for sub in qs:
            if getattr(sub, 'is_active', False):
                return True
        return False
