import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Sparkles } from 'lucide-react';
import { computeTrialDaysRemaining } from '@/utils/trial';

/**
 * Thin, minimal top-of-page banner for users on a legacy free trial.
 *
 * The displayed day count is always recomputed from ``trialEnds`` (via the
 * same helper the Billing and Profile pages use), so the banner, the trial
 * reminder modal, the Billing page slim banner and the Profile badge never
 * disagree on "N days left" vs "ends today".
 *
 * Styling is deliberately a single line so it adds roughly one row of
 * vertical space to every page instead of the previous 80–100px card.
 */
export default function LegacyTrialBanner({
  daysRemaining,
  trialEnds,
  hasPaymentMethod = false,
  onDismiss
}) {
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const dismissedDate = localStorage.getItem('legacy_trial_banner_dismissed');
    const today = new Date().toDateString();
    if (dismissedDate === today) {
      setDismissed(true);
    }
  }, []);

  const effectiveDays = useMemo(
    () => computeTrialDaysRemaining(trialEnds, daysRemaining),
    [trialEnds, daysRemaining]
  );

  const handleDismiss = () => {
    const today = new Date().toDateString();
    localStorage.setItem('legacy_trial_banner_dismissed', today);
    setDismissed(true);
    if (onDismiss) onDismiss();
  };

  const handleViewPlans = () => {
    navigate('/premium');
  };

  if (dismissed) return null;

  const urgent = effectiveDays <= 3;
  const warning = !urgent && effectiveDays <= 7;

  const tone = urgent
    ? 'border-red-500/30 bg-red-500/[0.08] text-red-100'
    : warning
      ? 'border-amber-500/25 bg-amber-500/[0.07] text-amber-100'
      : 'border-blue-500/25 bg-blue-500/[0.07] text-blue-100';

  const accent = urgent
    ? 'text-red-300'
    : warning
      ? 'text-amber-300'
      : 'text-blue-300';

  // Keep the copy short — detailed state lives on the Billing page.
  const [leadStrong, leadRest] =
    effectiveDays <= 0
      ? ['Your free trial ends today', '']
      : effectiveDays === 1
        ? ['1 day left', ' in your free trial']
        : [`${effectiveDays} days left`, ' in your free trial'];
  const tail = hasPaymentMethod ? '. You\u2019ll renew automatically.' : '.';
  const ctaLabel = hasPaymentMethod ? 'Manage plan' : 'Choose a plan';

  // Edge-to-edge strip. The outer <div> fills the viewport width; the
  // inner wrapper keeps the banner text and CTA aligned with the rest of
  // the page content (same max-w-7xl + horizontal padding the header uses).
  return (
    <div
      className={`w-full border-y ${tone}`}
      role="status"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 flex items-center gap-3">
        <Sparkles className={`w-4 h-4 flex-shrink-0 ${accent}`} />
        <p className="flex-1 text-[13px] leading-snug truncate">
          <span className="font-semibold text-white">{leadStrong}</span>
          <span className="opacity-80">
            {leadRest}{tail}
          </span>
        </p>
        <button
          type="button"
          onClick={handleViewPlans}
          className={`text-[12px] font-semibold whitespace-nowrap hover:underline ${accent}`}
        >
          {ctaLabel}
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          className="text-zinc-500 hover:text-zinc-200 transition-colors p-1 -mr-1"
          aria-label="Dismiss banner"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
