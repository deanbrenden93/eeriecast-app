/**
 * Helpers for formatting unified trial information exposed via UserContext.
 * The ``trial_type`` field can be one of:
 *   - 'standard'         -> the normal 7-day Stripe free trial
 *   - 'legacy_monthly'   -> 30-day legacy trial for previous monthly members
 *   - 'legacy_yearly'    -> 365-day legacy trial for previous annual members
 *   - null               -> not on any trial
 */

export const TRIAL_LABELS = {
  standard: '7-Day Free Trial',
  legacy_monthly: 'Legacy Monthly Trial',
  legacy_yearly: 'Legacy Annual Trial',
};

export const TRIAL_SHORT_LABELS = {
  standard: 'Free Trial',
  legacy_monthly: 'Legacy Trial',
  legacy_yearly: 'Legacy Trial',
};

export const TRIAL_DESCRIPTIONS = {
  standard:
    'Your 7-day free trial of Eeriecast Premium. You will be billed automatically when the trial ends unless you cancel.',
  legacy_monthly:
    'Complimentary 30-day trial granted to previous monthly members. When it ends, subscribe to keep your Premium benefits.',
  legacy_yearly:
    'Complimentary 365-day trial granted to previous annual members. When it ends, subscribe to keep your Premium benefits.',
};

export function getTrialLabel(trialType) {
  return TRIAL_LABELS[trialType] || null;
}

export function getTrialShortLabel(trialType) {
  return TRIAL_SHORT_LABELS[trialType] || null;
}

export function getTrialDescription(trialType) {
  return TRIAL_DESCRIPTIONS[trialType] || null;
}

export function formatTrialDaysRemaining(days) {
  const n = Number(days) || 0;
  if (n <= 0) return 'Ends today';
  if (n === 1) return '1 day left';
  return `${n} days left`;
}

/**
 * Compute the number of days remaining until ``endDate`` (a Date / ISO string).
 * Partial days are rounded up so that e.g. 6.3 days shows as "7 days left".
 * If ``endDate`` is missing or unparseable, falls back to ``fallbackDays``.
 */
export function computeTrialDaysRemaining(endDate, fallbackDays = 0) {
  if (!endDate) return Number(fallbackDays) || 0;
  const end = endDate instanceof Date ? endDate : new Date(endDate);
  if (Number.isNaN(end.getTime())) return Number(fallbackDays) || 0;
  const diffMs = end.getTime() - Date.now();
  if (diffMs <= 0) return 0;
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}
