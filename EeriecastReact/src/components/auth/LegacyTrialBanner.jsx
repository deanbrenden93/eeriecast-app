import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Sparkles, Clock, Crown } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

/**
 * Banner to inform legacy Memberful users about their free trial period
 * Shows different urgency levels based on days remaining
 */
export default function LegacyTrialBanner({
  daysRemaining,
  trialEnds,
  planType = 'monthly',
  onDismiss
}) {
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(false);

  // Check if user has dismissed this reminder today
  useEffect(() => {
    const dismissedDate = localStorage.getItem('legacy_trial_banner_dismissed');
    const today = new Date().toDateString();
    if (dismissedDate === today) {
      setDismissed(true);
    }
  }, []);

  const handleDismiss = () => {
    const today = new Date().toDateString();
    localStorage.setItem('legacy_trial_banner_dismissed', today);
    setDismissed(true);
    if (onDismiss) onDismiss();
  };

  const handleViewPlans = () => {
    navigate('/premium');
  };

  if (dismissed || daysRemaining < 0) return null;

  // Determine urgency level and styling
  let urgency = 'info';
  let icon = <Sparkles className="h-5 w-5" />;
  let bgColor = 'bg-blue-500/10';
  let borderColor = 'border-blue-500/20';
  let textColor = 'text-blue-100';
  let buttonVariant = 'outline';

  if (daysRemaining <= 3) {
    urgency = 'urgent';
    icon = <Clock className="h-5 w-5 animate-pulse" />;
    bgColor = 'bg-red-500/10';
    borderColor = 'border-red-500/30';
    textColor = 'text-red-100';
    buttonVariant = 'default';
  } else if (daysRemaining <= 7) {
    urgency = 'warning';
    icon = <Crown className="h-5 w-5" />;
    bgColor = 'bg-orange-500/10';
    borderColor = 'border-orange-500/20';
    textColor = 'text-orange-100';
    buttonVariant = 'default';
  }

  const getMessage = () => {
    if (daysRemaining === 0) {
      return 'Your free trial expires today!';
    } else if (daysRemaining === 1) {
      return 'Your free trial expires tomorrow!';
    } else if (daysRemaining <= 3) {
      return `Only ${daysRemaining} days left in your free trial!`;
    } else if (daysRemaining <= 7) {
      return `Your free trial expires in ${daysRemaining} days`;
    } else if (daysRemaining <= 14) {
      return `You have ${daysRemaining} days remaining in your free trial`;
    } else {
      const planTypeText = planType === 'yearly' ? 'year' : 'month';
      return `Welcome! Enjoy your free ${planTypeText} to try the new platform`;
    }
  };

  const getSubMessage = () => {
    if (daysRemaining <= 3) {
      return 'Subscribe now to keep your premium access';
    } else if (daysRemaining <= 7) {
      return 'Choose a plan to continue enjoying premium content';
    } else {
      return 'No automatic charges - you choose when to subscribe';
    }
  };

  return (
    <div className={`relative ${bgColor} border ${borderColor} rounded-lg p-4 mb-4 shadow-lg`}>
      <div className="flex items-start gap-4">
        <div className={`${textColor} mt-0.5`}>
          {icon}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <h3 className={`font-semibold ${textColor} text-base`}>
                {getMessage()}
              </h3>
              <p className="text-sm text-gray-300 mt-1">
                {getSubMessage()}
              </p>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <Button
                variant={buttonVariant}
                size="sm"
                onClick={handleViewPlans}
                className="whitespace-nowrap"
              >
                <Crown className="h-4 w-4 mr-2" />
                Choose Your Plan
              </Button>

              {daysRemaining > 7 && (
                <button
                  onClick={handleDismiss}
                  className="text-gray-400 hover:text-gray-200 transition-colors p-1"
                  aria-label="Dismiss banner"
                >
                  <X className="h-5 w-5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
