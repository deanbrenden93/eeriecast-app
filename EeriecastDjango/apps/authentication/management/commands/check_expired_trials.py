from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.utils.timezone import now

User = get_user_model()


def _user_has_active_stripe_subscription(user) -> bool:
    """Return True iff the user has at least one local Subscription row
    whose ``is_active`` property reports True. Used as a safety filter
    so the daily expiration job never revokes premium from a customer
    who has since converted to a paying Stripe subscriber but whose
    ``is_legacy_free_trial`` flag happens to still be True."""
    try:
        from apps.billing.models import Subscription
    except Exception:
        return False
    for sub in Subscription.objects.filter(user=user):
        if getattr(sub, 'is_active', False):
            return True
    return False


class Command(BaseCommand):
    help = 'Check for expired legacy free trials and revoke premium access'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be done without making changes',
        )

    def handle(self, *args, **options):
        dry_run = options.get('dry_run', False)

        expired_users = User.objects.filter(
            is_legacy_free_trial=True,
            free_trial_ends__lte=now(),
            is_deleted=False,
        )

        count = expired_users.count()

        if count == 0:
            self.stdout.write(self.style.SUCCESS('No expired trials found'))
            return

        if dry_run:
            self.stdout.write(
                self.style.WARNING(f'DRY RUN: Would evaluate {count} expired trial(s)')
            )
            for user in expired_users:
                tag = 'SKIP (active Stripe sub)' if _user_has_active_stripe_subscription(user) else 'EXPIRE'
                self.stdout.write(
                    f'  - {tag}: {user.email} (trial ended {user.free_trial_ends})'
                )
            return

        expired_count = 0
        skipped_count = 0
        for user in expired_users:
            # Belt-and-suspenders: never revoke premium from a user who
            # has an active Stripe subscription, even if their legacy
            # trial flag is somehow still True. The current backend
            # blocks legacy-trial users from starting a Stripe sub, so
            # this dual state shouldn't arise in practice — but a daily
            # job that touches `is_premium=False` deserves a safety net.
            if _user_has_active_stripe_subscription(user):
                self.stdout.write(
                    f'Skipping {user.email}: has an active Stripe subscription'
                )
                skipped_count += 1
                continue

            self.stdout.write(
                f'Expiring trial for {user.email} (ended {user.free_trial_ends})'
            )
            user.is_legacy_free_trial = False
            user.is_premium = False
            user.save(update_fields=['is_legacy_free_trial', 'is_premium'])
            expired_count += 1

        self.stdout.write(
            self.style.SUCCESS(
                f'Done. Expired {expired_count} trial(s), '
                f'skipped {skipped_count} (active Stripe subs).'
            )
        )
