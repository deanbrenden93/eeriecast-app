from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.utils.timezone import now
from datetime import timedelta

User = get_user_model()

class Command(BaseCommand):
    help = (
        "HARD RESET every imported Memberful user's legacy trial to start "
        "from NOW (90 days monthly / 365 days yearly). This WILL shorten "
        "trials that are currently longer than the policy. For the safe, "
        "extend-only variant that never shortens an existing trial, use "
        "`python manage.py extend_legacy_trials` instead."
    )

    def handle(self, *args, **options):
        users = User.objects.filter(is_imported_from_memberful=True)

        count = users.count()
        if count == 0:
            self.stdout.write(self.style.WARNING("No imported users found to refresh."))
            return

        self.stdout.write(self.style.SUCCESS(f"Refreshing trials for {count} users..."))

        for user in users:
            if user.memberful_plan_type == 'yearly':
                days = 365
            else:
                days = 90
                user.memberful_plan_type = 'monthly'

            new_expiry = now() + timedelta(days=days)

            user.free_trial_ends = new_expiry
            user.subscription_expires = new_expiry
            user.is_premium = True
            user.is_legacy_free_trial = True
            user.save()

        self.stdout.write(self.style.SUCCESS(f"Successfully refreshed trials for {count} users."))
