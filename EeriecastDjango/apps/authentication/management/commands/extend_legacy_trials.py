"""
One-time (and safe-to-rerun) cleanup that brings every imported Memberful
user up to the current legacy-trial policy:

    - Monthly members ......... 90-day complimentary legacy trial
    - Yearly members .......... 365-day complimentary legacy trial

Counted from the moment this command runs.

Why this command exists
-----------------------
The original ``import_memberful_users`` command preferred each row's
``Expiration date`` column over the policy default whenever that column
sat in the future. CSV exports from Memberful are point-in-time snapshots,
so a CSV produced before a member renewed (or auto-renewed) would record
a trial-end that was actually shorter than the member's real Memberful
expiration. Some users were imported with already-elapsed or far-too-soon
trial dates, leaving them stuck on the new site: the daily expiration job
flips them off "premium," but their stale ``is_premium`` flag still blocks
the Stripe checkout flow because ``is_premium_member()`` historically
returned True for that combination.

Semantics
---------
We only consider users who were **active** Memberful members at import
time — identified by ``is_imported_from_memberful=True`` AND a non-empty
``memberful_plan_type``. The import script only stamps a plan type for
rows whose CSV ``Active`` column was ``yes``, so this filter naturally
excludes already-cancelled imports (which were never granted a legacy
trial in the first place and shouldn't get one retroactively).

For each candidate user:

* If they already have an **active Stripe subscription**, we leave the
  legacy-trial fields ALONE. They've moved on from the legacy trial and
  are now a paying customer; touching their dates would be confusing.
* Otherwise we compute ``policy_end = now() + 90 or 365 days`` based on
  ``memberful_plan_type``.
* We then set the legacy trial to ``max(existing_end, policy_end)`` —
  **never shortening** an existing valid trial, only extending the ones
  that are too short or already elapsed.
* We always set ``is_legacy_free_trial=True`` and ``is_premium=True``
  alongside, so users that the daily expiration job has already revoked
  get their legacy trial reinstated for the remaining policy window.

The command is idempotent: running it twice in a row will (on the second
run) be a near no-op because every user's trial is already at-or-past the
policy length.

Usage
-----
    python manage.py extend_legacy_trials --dry-run
    python manage.py extend_legacy_trials

The ``--dry-run`` flag prints what would change without writing anything.
"""

from datetime import timedelta

from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils.timezone import now

User = get_user_model()


MONTHLY_TRIAL_DAYS = 90
YEARLY_TRIAL_DAYS = 365


def _user_has_active_stripe_subscription(user) -> bool:
    """Return True iff the user has at least one local Subscription row
    whose ``is_active`` property reports True. We rely on the existing
    property rather than redoing the status logic so this stays in lockstep
    with what the rest of the billing layer considers "currently paying.""""
    try:
        from apps.billing.models import Subscription
    except Exception:
        return False
    for sub in Subscription.objects.filter(user=user):
        if getattr(sub, 'is_active', False):
            return True
    return False


class Command(BaseCommand):
    help = (
        'Bring imported Memberful users up to the current legacy-trial '
        'policy (90 days monthly / 365 days yearly), extending only, never '
        'shortening an existing valid trial. Skips users who already have '
        'an active Stripe subscription.'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Print the planned changes without writing to the database.',
        )

    def handle(self, *args, **options):
        dry_run = bool(options.get('dry_run'))
        current_time = now()

        # Only touch users who were *active* Memberful members at import
        # time. The import script stamps ``memberful_plan_type`` exclusively
        # for rows with ``Active=yes``, so filtering on a non-empty plan
        # type cleanly excludes already-cancelled imports (which were never
        # granted a legacy trial and shouldn't retroactively get one).
        candidates = User.objects.filter(
            is_imported_from_memberful=True,
            is_deleted=False,
        ).exclude(memberful_plan_type__isnull=True).exclude(
            memberful_plan_type__exact=''
        ).order_by('email')

        total = candidates.count()
        if total == 0:
            self.stdout.write(self.style.WARNING(
                'No active Memberful imports found to evaluate.'
            ))
            return

        self.stdout.write(self.style.SUCCESS(
            f'Evaluating {total} imported user(s) against policy '
            f'(monthly={MONTHLY_TRIAL_DAYS}d, yearly={YEARLY_TRIAL_DAYS}d).'
        ))
        if dry_run:
            self.stdout.write(self.style.WARNING('DRY RUN — no changes will be saved.'))

        stats = {
            'extended_expired': 0,    # was already past the end date
            'extended_short': 0,      # was still valid but shorter than policy
            'left_alone_longer': 0,   # already longer than policy
            'skipped_active_sub': 0,  # paying Stripe customer
        }

        for user in candidates.iterator():
            if _user_has_active_stripe_subscription(user):
                stats['skipped_active_sub'] += 1
                self.stdout.write(
                    f'  - SKIP  {user.email}: has an active Stripe subscription'
                )
                continue

            plan = (user.memberful_plan_type or '').lower()
            if plan in ('yearly', 'annual'):
                trial_days = YEARLY_TRIAL_DAYS
                resolved_plan = 'yearly'
            else:
                trial_days = MONTHLY_TRIAL_DAYS
                resolved_plan = 'monthly'

            policy_end = current_time + timedelta(days=trial_days)
            existing_end = user.free_trial_ends or user.subscription_expires

            if existing_end and existing_end >= policy_end:
                # Their current trial already runs longer than the policy
                # would grant — leave the date alone. We still normalise
                # the supporting flags below so the user is in a coherent
                # legacy-trial state.
                target_end = existing_end
                bucket = 'left_alone_longer'
                verb = 'KEEP '
            elif existing_end and existing_end > current_time:
                # Still valid but shorter than policy — extend.
                target_end = policy_end
                bucket = 'extended_short'
                verb = 'EXT  '
            else:
                # Already expired (or never had a date) — restore.
                target_end = policy_end
                bucket = 'extended_expired'
                verb = 'FIX  '

            stats[bucket] += 1

            self.stdout.write(
                f'  - {verb} {user.email} [{resolved_plan}] '
                f'{existing_end.isoformat() if existing_end else "(none)"} '
                f'-> {target_end.isoformat()}'
            )

            if dry_run:
                continue

            # Wrap the per-user write in its own transaction so a failure
            # on one row can't poison the rest of the run.
            with transaction.atomic():
                user.is_legacy_free_trial = True
                user.is_premium = True
                user.free_trial_ends = target_end
                user.subscription_expires = target_end
                if not user.memberful_plan_type:
                    user.memberful_plan_type = resolved_plan
                user.save(update_fields=[
                    'is_legacy_free_trial',
                    'is_premium',
                    'free_trial_ends',
                    'subscription_expires',
                    'memberful_plan_type',
                ])

        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS('Summary:'))
        self.stdout.write(f"  expired trials restored     : {stats['extended_expired']}")
        self.stdout.write(f"  short trials extended       : {stats['extended_short']}")
        self.stdout.write(f"  already longer (left alone) : {stats['left_alone_longer']}")
        self.stdout.write(f"  active Stripe subs (skipped): {stats['skipped_active_sub']}")
        self.stdout.write(f"  total evaluated             : {total}")
        if dry_run:
            self.stdout.write(self.style.WARNING(
                'DRY RUN complete — rerun without --dry-run to apply changes.'
            ))
        else:
            self.stdout.write(self.style.SUCCESS('Done.'))
