from django.conf import settings
from django.db import models
from django.utils import timezone
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver


class Subscription(models.Model):
    STATUS_CHOICES = [
        ("trialing", "trialing"),
        ("active", "active"),
        ("past_due", "past_due"),
        ("canceled", "canceled"),
        ("unpaid", "unpaid"),
        ("incomplete", "incomplete"),
        ("incomplete_expired", "incomplete_expired"),
        ("paused", "paused"),
    ]

    user = models.ForeignKey(settings.AUTH_USER_MODEL, related_name="subscriptions", on_delete=models.CASCADE)
    stripe_subscription_id = models.CharField(max_length=255, unique=True)
    stripe_customer_id = models.CharField(max_length=255, blank=True, null=True)

    plan_id = models.CharField(max_length=255, blank=True, null=True)
    plan_nickname = models.CharField(max_length=255, blank=True, null=True)

    status = models.CharField(max_length=32, choices=STATUS_CHOICES)
    cancel_at_period_end = models.BooleanField(default=False)

    current_period_start = models.DateTimeField(blank=True, null=True)
    current_period_end = models.DateTimeField(blank=True, null=True)
    canceled_at = models.DateTimeField(blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Subscription {self.stripe_subscription_id} ({self.status}) for {getattr(self.user, 'email', self.user.pk)}"

    @property
    def is_active(self) -> bool:
        now = timezone.now()
        # Consider active during trial/active period; allow past_due as active until Stripe finalizes
        if self.status in {"trialing", "active", "past_due"}:
            if self.current_period_end is None or self.current_period_end > now:
                return True
        # If set to cancel at period end, still treat as active until end
        if self.cancel_at_period_end and self.current_period_end and self.current_period_end > now:
            return True
        return False


def _recompute_user_premium(user_id: int):
    from django.contrib.auth import get_user_model
    User = get_user_model()
    try:
        user = User.objects.get(pk=user_id)
    except User.DoesNotExist:
        return
    subs = list(Subscription.objects.filter(user=user))
    any_active = any(s.is_active for s in subs)
    # Compute the latest expiry among subscriptions
    latest_expiry = None
    for s in subs:
        if s.current_period_end and (latest_expiry is None or s.current_period_end > latest_expiry):
            latest_expiry = s.current_period_end
    # Update fields if changed
    changed = False
    if getattr(user, "is_premium", None) is not None and user.is_premium != any_active:
        user.is_premium = any_active
        changed = True
    if hasattr(user, "subscription_expires") and user.subscription_expires != latest_expiry:
        user.subscription_expires = latest_expiry
        changed = True
    if changed:
        user.save(update_fields=[f for f in ["is_premium", "subscription_expires"] if hasattr(user, f)])


@receiver(post_save, sender=Subscription)
def on_subscription_saved(sender, instance: Subscription, **kwargs):
    _recompute_user_premium(instance.user_id)


@receiver(post_delete, sender=Subscription)
def on_subscription_deleted(sender, instance: Subscription, **kwargs):
    _recompute_user_premium(instance.user_id)

