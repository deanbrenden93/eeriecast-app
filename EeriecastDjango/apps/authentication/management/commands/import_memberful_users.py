import csv
import os
from datetime import datetime
from django.core.management.base import BaseCommand, CommandError
from django.contrib.auth import get_user_model
from django.utils.timezone import make_aware
from django.db import transaction

User = get_user_model()

class Command(BaseCommand):
    help = 'Imports users from a Memberful CSV export'

    def add_arguments(self, parser):
        parser.add_argument('csv_file', type=str, help='Path to the CSV file')

    def handle(self, *args, **options):
        csv_file_path = options['csv_file']

        if not os.path.exists(csv_file_path):
            raise CommandError(f"File '{csv_file_path}' does not exist")

        self.stdout.write(self.style.SUCCESS(f"Starting import from {csv_file_path}"))

        counts = {
            'created': 0,
            'updated': 0,
            'skipped': 0,
            'errors': 0
        }

        with open(csv_file_path, mode='r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            
            for row in reader:
                try:
                    email = row.get('Email', '').strip().lower()
                    if not email:
                        self.stdout.write(self.style.WARNING("Skipping row without email"))
                        counts['skipped'] += 1
                        continue

                    full_name = row.get('Full Name', '').strip()
                    first_name = ""
                    last_name = ""
                    if full_name:
                        parts = full_name.split(' ', 1)
                        first_name = parts[0]
                        if len(parts) > 1:
                            last_name = parts[1]

                    stripe_customer_id = row.get('Stripe Customer ID', '').strip()
                    active = row.get('Active', '').strip().lower() == 'yes'
                    expiration_date_str = row.get('Expiration date', '').strip()
                    created_at_str = row.get('Created at', '').strip()

                    subscription_expires = None
                    if expiration_date_str:
                        try:
                            subscription_expires = make_aware(datetime.strptime(expiration_date_str, '%Y-%m-%d'))
                        except ValueError:
                            self.stdout.write(self.style.WARNING(f"Could not parse expiration date '{expiration_date_str}' for {email}"))

                    date_joined = None
                    if created_at_str:
                        try:
                            date_joined = make_aware(datetime.strptime(created_at_str, '%Y-%m-%d'))
                        except ValueError:
                            # Try with time if it fails
                            try:
                                date_joined = make_aware(datetime.strptime(created_at_str, '%Y-%m-%d %H:%M:%S'))
                            except ValueError:
                                pass

                    with transaction.atomic():
                        user, created = User.objects.get_or_create(
                            email=email,
                            defaults={
                                'username': email, # Use email as username if not provided
                                'first_name': first_name,
                                'last_name': last_name,
                                'is_imported_from_memberful': True,
                            }
                        )

                        if created:
                            user.set_unusable_password()
                            counts['created'] += 1
                        else:
                            # If user exists, we still mark it as imported if it wasn't already
                            # and update its info from the CSV
                            user.is_imported_from_memberful = True
                            counts['updated'] += 1

                        if first_name: user.first_name = first_name
                        if last_name: user.last_name = last_name
                        if stripe_customer_id: user.stripe_customer_id = stripe_customer_id
                        
                        # Only override is_premium if it's currently False or the CSV says Yes
                        if active:
                            user.is_premium = True
                        
                        if subscription_expires:
                            user.subscription_expires = subscription_expires
                        
                        if created and date_joined:
                            user.date_joined = date_joined

                        user.save()

                except Exception as e:
                    self.stdout.write(self.style.ERROR(f"Error importing {email}: {str(e)}"))
                    counts['errors'] += 1

        self.stdout.write(self.style.SUCCESS(
            f"Import completed: {counts['created']} created, {counts['updated']} updated, "
            f"{counts['skipped']} skipped, {counts['errors']} errors"
        ))
