from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.utils.timezone import now
from datetime import timedelta

User = get_user_model()

class Command(BaseCommand):
    help = 'Refreshes the free trial period for all imported Memberful users to start from NOW'

    def handle(self, *args, **options):
        # Target all users who were imported from Memberful
        users = User.objects.filter(is_imported_from_memberful=True)
        
        count = users.count()
        if count == 0:
            self.stdout.write(self.style.WARNING("No imported users found to refresh."))
            return

        self.stdout.write(self.style.SUCCESS(f"Refreshing trials for {count} users..."))

        for user in users:
            # Determine the correct free period based on their imported plan type
            if user.memberful_plan_type == 'yearly':
                days = 365
            else:
                # Default to monthly (60 days as per requirements)
                days = 60
                user.memberful_plan_type = 'monthly' # Ensure field is set
            
            # Calculate new expiration from current time
            new_expiry = now() + timedelta(days=days)
            
            user.free_trial_ends = new_expiry
            user.subscription_expires = new_expiry
            user.is_premium = True
            user.is_legacy_free_trial = True
            user.save()

        self.stdout.write(self.style.SUCCESS(f"Successfully refreshed trials for {count} users."))
