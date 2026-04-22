import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Crown, Calendar } from 'lucide-react';
import { computeTrialDaysRemaining } from '@/utils/trial';

/**
 * Final-stretch reminder for legacy-trial users who have NOT added a card.
 *
 * This modal is intentionally scoped to the last few days of the trial —
 * users who have already attached a payment method will be charged
 * automatically, so there's no reason to keep nagging them. The App-level
 * trigger enforces that gate; this component just renders the message.
 *
 * Day count is computed from ``trialEnds`` (same helper used by the banner,
 * Billing page and Profile badge) so all surfaces agree.
 */
export default function LegacyTrialReminderModal({
  isOpen,
  onClose,
  daysRemaining,
  trialEnds,
}) {
  const navigate = useNavigate();

  const effectiveDays = useMemo(
    () => computeTrialDaysRemaining(trialEnds, daysRemaining),
    [trialEnds, daysRemaining]
  );

  const handleViewPlans = () => {
    onClose();
    navigate('/premium');
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    try {
      return new Date(dateString).toLocaleDateString(undefined, {
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return '';
    }
  };

  const title =
    effectiveDays === 0
      ? 'Your Free Trial Ends Today'
      : effectiveDays === 1
        ? 'Your Free Trial Ends Tomorrow'
        : 'Your Free Trial Is Ending Soon';

  const message =
    effectiveDays === 0
      ? 'Your free trial ends today. Add a payment method now to keep your premium access without interruption.'
      : effectiveDays === 1
        ? 'Your free trial ends tomorrow. Add a payment method to keep your premium access without interruption.'
        : `You have ${effectiveDays} days left in your free trial. Add a payment method to keep your premium access without interruption.`;

  const statusLabel =
    effectiveDays === 0
      ? 'Ends Today'
      : effectiveDays === 1
        ? '1 Day Left'
        : `${effectiveDays} Days Left`;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-gradient-to-br from-black via-[#121316] to-[#1f2128] text-white border border-red-600/40 shadow-2xl shadow-red-900/40">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
            <Crown className="h-6 w-6 text-red-500" />
            {title}
          </DialogTitle>
          <DialogDescription className="text-base text-gray-400 pt-2">
            {message}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="bg-[#1b1d23] border border-red-900/30 rounded-lg p-4 shadow-inner shadow-red-950/20">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-red-500" />
                <span className="font-semibold text-white">Trial Status</span>
              </div>
              <span className="text-sm font-medium text-red-400">
                {statusLabel}
              </span>
            </div>
            {trialEnds && (
              <div className="text-sm text-gray-400">
                <div className="flex justify-between items-center">
                  <span>Expires:</span>
                  <span className="text-white font-medium">{formatDate(trialEnds)}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1 border-red-600/30 text-red-100 hover:bg-red-600/10 hover:text-white transition-colors"
          >
            Remind Me Later
          </Button>
          <Button
            onClick={handleViewPlans}
            className="flex-1 bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-900/20 transition-all"
          >
            <Crown className="h-4 w-4 mr-2" />
            Add Payment Method
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
