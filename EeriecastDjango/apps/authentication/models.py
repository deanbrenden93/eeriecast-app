from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone

class User(AbstractUser):
    email = models.EmailField(unique=True)
    avatar = models.URLField(blank=True, null=True)
    bio = models.TextField(blank=True)
    is_premium = models.BooleanField(default=False)
    is_imported_from_memberful = models.BooleanField(default=False)
    memberful_plan_type = models.CharField(max_length=20, blank=True, null=True) # "monthly" or "yearly"
    stripe_customer_id = models.CharField(max_length=255, blank=True, null=True)
    minutes_listened = models.IntegerField(default=0)
    subscription_expires = models.DateTimeField(blank=True, null=True)

    # Legacy free trial fields for migrated Memberful users
    is_legacy_free_trial = models.BooleanField(default=False)
    free_trial_ends = models.DateTimeField(blank=True, null=True)

    # Date of birth for age verification
    date_of_birth = models.DateField(blank=True, null=True)

    # Mature content preference (only effective if user is 18+)
    allow_mature_content = models.BooleanField(default=False)

    # Onboarding completion flag
    onboarding_completed = models.BooleanField(default=False)

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
        Checks for:
        1. Active legacy free trial (migrated Memberful users)
        2. Active Subscription record
        3. is_premium boolean flag on the user model
        """
        # Check if user is on active legacy free trial
        if self.is_on_legacy_trial():
            return True

        # Check the stored flag (set via admin, test toggle, etc.)
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

    def is_on_legacy_trial(self) -> bool:
        """
        Return True if this user is currently on an active legacy free trial.
        """
        if not self.is_legacy_free_trial:
            return False
        if not self.free_trial_ends:
            return False
        return timezone.now() < self.free_trial_ends

    def legacy_trial_days_remaining(self) -> int:
        """
        Return the number of days remaining in the legacy free trial.
        Returns 0 if not on trial or trial has expired.
        """
        if not self.is_on_legacy_trial():
            return 0
        delta = self.free_trial_ends - timezone.now()
        return max(0, delta.days)
