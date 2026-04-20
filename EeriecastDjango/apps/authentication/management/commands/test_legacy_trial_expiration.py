from django.core.management.base import BaseCommand, CommandError
from django.contrib.auth import get_user_model
from django.utils.timezone import now
from datetime import timedelta

User = get_user_model()


class Command(BaseCommand):
    help = 'Test legacy trial expiration by simulating time offset for an imported user'

    def add_arguments(self, parser):
        parser.add_argument(
            '--user-email',
            type=str,
            required=True,
            help='Email of the imported user to test',
        )
        parser.add_argument(
            '--days-offset',
            type=int,
            default=-30,
            help='Number of days to offset from original trial end (negative = subtract days, e.g., -30 simulates 30 days passed)',
        )
        parser.add_argument(
            '--reset',
            action='store_true',
            help='Reset the user to their original trial dates (based on plan type)',
        )
        parser.add_argument(
            '--show-info',
            action='store_true',
            help='Just show current user info without making changes',
        )

    def handle(self, *args, **options):
        email = options['user_email']
        days_offset = options['days_offset']
        reset = options['reset']
        show_info = options['show_info']

        try:
            user = User.objects.get(email=email, is_imported_from_memberful=True)
        except User.DoesNotExist:
            raise CommandError(f'User with email "{email}" not found or not imported from Memberful')

        # Show current info
        self.stdout.write(self.style.WARNING(f'\n=== User: {user.email} ==='))
        self.stdout.write(f'Plan Type: {user.memberful_plan_type}')
        self.stdout.write(f'Is Legacy Trial: {user.is_legacy_free_trial}')
        self.stdout.write(f'Is Premium: {user.is_premium}')
        self.stdout.write(f'Free Trial Ends: {user.free_trial_ends}')
        self.stdout.write(f'Subscription Expires: {user.subscription_expires}')

        if user.free_trial_ends:
            delta = user.free_trial_ends - now()
            days_remaining = delta.days
            self.stdout.write(f'Days Remaining: {days_remaining}')
            self.stdout.write(f'Hours Remaining: {delta.total_seconds() / 3600:.1f}')
        else:
            self.stdout.write(f'Days Remaining: N/A')

        if show_info:
            return

        if reset:
            # Reset to original trial dates based on plan type
            if user.memberful_plan_type == 'yearly':
                trial_days = 365
            else:
                trial_days = 60  # monthly default

            new_expiry = now() + timedelta(days=trial_days)
            user.free_trial_ends = new_expiry
            user.subscription_expires = new_expiry
            user.is_legacy_free_trial = True
            user.is_premium = True
            user.save(update_fields=['free_trial_ends', 'subscription_expires', 'is_legacy_free_trial', 'is_premium'])

            self.stdout.write(self.style.SUCCESS(f'\n✓ Reset trial to {trial_days} days from now'))
            self.stdout.write(f'New expiry: {new_expiry}')
            return

        # Apply offset to simulate time passing
        if user.memberful_plan_type == 'yearly':
            original_trial_days = 365
        else:
            original_trial_days = 60

        # Calculate new expiry: NOW + original_trial_days + days_offset
        # Example: If offset is -30, this simulates being 30 days into the trial
        new_expiry = now() + timedelta(days=original_trial_days + days_offset)

        old_expiry = user.free_trial_ends
        user.free_trial_ends = new_expiry
        user.subscription_expires = new_expiry

        # Keep is_legacy_free_trial and is_premium true (expiration check happens elsewhere)
        user.save(update_fields=['free_trial_ends', 'subscription_expires'])

        self.stdout.write(self.style.SUCCESS(f'\n✓ Applied offset of {days_offset} days'))
        self.stdout.write(f'Old expiry: {old_expiry}')
        self.stdout.write(f'New expiry: {new_expiry}')

        delta = new_expiry - now()
        days_remaining = delta.days
        self.stdout.write(f'Simulated days remaining: {days_remaining}')

        # Provide guidance on what to expect
        self.stdout.write(self.style.WARNING('\n=== Expected Frontend Behavior ==='))
        if days_remaining <= 0:
            self.stdout.write('❌ Trial EXPIRED - Run check_expired_trials to revoke access')
            self.stdout.write('   Banner: Should NOT appear (trial expired)')
            self.stdout.write('   Access: Will lose premium after running check_expired_trials')
        elif days_remaining <= 3:
            self.stdout.write('🔴 URGENT (Red banner, animated pulse)')
            self.stdout.write(f'   Message: "Only {days_remaining} days left in your free trial!"')
            self.stdout.write('   Button: Default variant, not dismissible')
        elif days_remaining <= 7:
            self.stdout.write('🟠 WARNING (Orange banner)')
            self.stdout.write(f'   Message: "Your free trial expires in {days_remaining} days"')
            self.stdout.write('   Button: Default variant, not dismissible')
        elif days_remaining <= 14:
            self.stdout.write('🔵 INFO (Blue banner)')
            self.stdout.write(f'   Message: "You have {days_remaining} days remaining in your free trial"')
            self.stdout.write('   Button: Outline variant, dismissible')
        else:
            self.stdout.write('🔵 WELCOME (Blue banner)')
            plan_text = 'year' if user.memberful_plan_type == 'yearly' else 'month'
            self.stdout.write(f'   Message: "Welcome! Enjoy your free {plan_text} to try the new platform"')
            self.stdout.write('   Button: Outline variant, dismissible')

        self.stdout.write(self.style.WARNING('\n=== Next Steps ==='))
        self.stdout.write('1. Refresh the frontend to see the banner')
        self.stdout.write('2. Check /api/users/me/ for updated values')
        self.stdout.write('3. Verify banner appearance and messaging')
        self.stdout.write('4. To reset: --reset flag')
        if days_remaining <= 0:
            self.stdout.write('5. Run: python manage.py check_expired_trials')
