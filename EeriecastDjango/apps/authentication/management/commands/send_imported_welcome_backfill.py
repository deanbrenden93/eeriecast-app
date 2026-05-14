"""One-time backfill: send the imported-user welcome email to every legacy
Memberful member who never received it.

Targets users where:
  - is_imported_from_memberful = True
  - has_usable_password() is False (i.e. they still need to set a password)
  - no EmailEvent exists for them with event_type=IMPORTED_USER_WELCOME and
    status=sent

Idempotency is also enforced downstream via EmailEvent.external_id
(`user:{id}:imported_welcome`), so re-runs are safe.

Usage:
    python manage.py send_imported_welcome_backfill --dry-run
    python manage.py send_imported_welcome_backfill --limit 50
    python manage.py send_imported_welcome_backfill --throttle 1.0
"""
from __future__ import annotations

import logging
import time

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import PasswordResetTokenGenerator
from django.core.management.base import BaseCommand
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode

from apps.emails import events as email_events
from apps.emails.models import EmailEvent

User = get_user_model()
logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Send the imported-user welcome email to legacy Memberful members who never got it."

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Print who would be emailed without enqueuing any sends.',
        )
        parser.add_argument(
            '--limit',
            type=int,
            default=0,
            help='Stop after enqueuing N emails (0 = no limit).',
        )
        parser.add_argument(
            '--throttle',
            type=float,
            default=1.0,
            help='Seconds to sleep between enqueues (default 1.0).',
        )

    def handle(self, *args, **options):
        dry_run: bool = options['dry_run']
        limit: int = options['limit']
        throttle: float = max(0.0, float(options['throttle']))

        already_sent_user_ids = set(
            EmailEvent.objects
            .filter(
                event_type=email_events.EmailEventTypes.IMPORTED_USER_WELCOME,
                status=EmailEvent.STATUS_SENT,
            )
            .values_list('user_id', flat=True)
        )

        candidates_qs = (
            User.objects
            .filter(is_imported_from_memberful=True, is_active=True)
            .exclude(id__in=already_sent_user_ids)
            .order_by('id')
        )

        total = candidates_qs.count()
        self.stdout.write(self.style.SUCCESS(
            f"Found {total} candidate(s) for backfill"
            f"{' (dry-run)' if dry_run else ''}."
        ))

        enqueued = 0
        skipped_has_password = 0
        failed = 0

        base_url = settings.REACT_BASE_URL.rstrip('/') if getattr(settings, 'REACT_BASE_URL', None) else ''

        for user in candidates_qs.iterator():
            if user.has_usable_password():
                skipped_has_password += 1
                continue

            if limit and enqueued >= limit:
                self.stdout.write(self.style.WARNING(
                    f"Reached --limit {limit}; stopping."
                ))
                break

            if dry_run:
                self.stdout.write(f"  would email: id={user.id}  email={user.email}")
                enqueued += 1
                continue

            try:
                uid = urlsafe_base64_encode(force_bytes(user.pk))
                token = PasswordResetTokenGenerator().make_token(user)
                reset_url = f"{base_url}/reset-password?uid={uid}&token={token}"
                email_events.send_imported_user_welcome(
                    user_id=user.id,
                    to_email=user.email,
                    reset_url=reset_url,
                )
                enqueued += 1
                if throttle:
                    time.sleep(throttle)
            except Exception:
                failed += 1
                logger.exception(f"Failed to enqueue welcome email for user {user.id} ({user.email})")

        self.stdout.write(self.style.SUCCESS(
            f"Done. enqueued={enqueued}  skipped_has_password={skipped_has_password}  failed={failed}"
            f"{'  (dry-run, nothing sent)' if dry_run else ''}"
        ))
