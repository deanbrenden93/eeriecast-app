from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.utils.timezone import now
from django.db.models import Q

User = get_user_model()


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

        # Find users with expired legacy trials
        expired_users = User.objects.filter(
            is_legacy_free_trial=True,
            free_trial_ends__lte=now(),
            is_deleted=False
        )

        count = expired_users.count()

        if count == 0:
            self.stdout.write(self.style.SUCCESS('No expired trials found'))
            return

        if dry_run:
            self.stdout.write(
                self.style.WARNING(f'DRY RUN: Would expire {count} trial(s)')
            )
            for user in expired_users:
                self.stdout.write(
                    f'  - {user.email} (trial ended {user.free_trial_ends})'
                )
            return

        # Expire the trials
        for user in expired_users:
            self.stdout.write(
                f'Expiring trial for {user.email} (ended {user.free_trial_ends})'
            )
            user.is_legacy_free_trial = False
            user.is_premium = False
            user.save(update_fields=['is_legacy_free_trial', 'is_premium'])

        self.stdout.write(
            self.style.SUCCESS(f'Successfully expired {count} trial(s)')
        )
