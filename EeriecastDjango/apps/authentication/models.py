from django.contrib.auth.models import AbstractUser
from django.db import models

class User(AbstractUser):
    email = models.EmailField(unique=True)
    avatar = models.URLField(blank=True, null=True)
    bio = models.TextField(blank=True)
    is_premium = models.BooleanField(default=False)
    is_imported_from_memberful = models.BooleanField(default=False)
    stripe_customer_id = models.CharField(max_length=255, blank=True, null=True)
    minutes_listened = models.IntegerField(default=0)
    subscription_expires = models.DateTimeField(blank=True, null=True)

    # Email verification (not enforced yet)
    email_verified = models.BooleanField(default=False)
    email_verified_at = models.DateTimeField(blank=True, null=True)
    pending_email = models.EmailField(blank=True, null=True)
    pending_email_requested_at = models.DateTimeField(blank=True, null=True)

    # Soft delete
    is_deleted = models.BooleanField(default=False)
    deleted_at = models.DateTimeField(blank=True, null=True)
    email_at_deletion = models.EmailField(blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username']

    def is_premium_member(self) -> bool:
        """
        Return True if this user should be treated as a premium member.
        Checks for an active Subscription record first, then falls back
        to the is_premium boolean flag on the user model.
        """
        # Check the stored flag first (set via admin, test toggle, etc.)
        if bool(getattr(self, 'is_premium', False)):
            return True

        try:
            # Lazy import to avoid circular imports at import time
            from apps.billing.models import Subscription
        except Exception:
            return False

        qs = Subscription.objects.filter(user=self)
        for sub in qs:
            if getattr(sub, 'is_active', False):
                return True
        return False
