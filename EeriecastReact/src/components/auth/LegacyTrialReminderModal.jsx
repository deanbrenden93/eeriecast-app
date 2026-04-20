import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Crown, Sparkles, Lock, Unlock, Calendar } from 'lucide-react';

/**
 * Modal to remind legacy Memberful users about their trial and encourage subscription
 */
export default function LegacyTrialReminderModal({
  isOpen,
  onClose,
  daysRemaining,
  trialEnds,
  planType = 'monthly',
  isFirstLogin = false
}) {
  const navigate = useNavigate();

  const handleViewPlans = () => {
    onClose();
    navigate('/premium');
  };

  const handleRemindLater = () => {
    onClose();
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

  const getTitle = () => {
    if (isFirstLogin) {
      return `Welcome to the New Eeriecast! 🎉`;
    } else if (daysRemaining <= 3) {
      return 'Your Free Trial is Ending Soon';
    } else if (daysRemaining <= 30) {
      return 'Trial Reminder';
    } else {
      return 'Enjoying the New Platform?';
    }
  };

  const getMessage = () => {
    const planTypeText = planType === 'yearly' ? 'annual' : 'monthly';
    const trialLength = planType === 'yearly' ? 'full year' : 'full month';

    if (isFirstLogin) {
      return `As a valued ${planTypeText} member, we're giving you a ${trialLength} free to explore the new platform. There are no automatic charges - take your time to see if you love it!`;
    } else if (daysRemaining <= 1) {
      return `Your free trial ends ${daysRemaining === 0 ? 'today' : 'tomorrow'}. Subscribe now to keep enjoying premium content without interruption.`;
    } else if (daysRemaining <= 7) {
      return `You have ${daysRemaining} days left in your free trial. Choose a plan that works for you to continue your premium access.`;
    } else if (daysRemaining <= 30) {
      return `You have ${daysRemaining} days left in your free trial. Subscribe now to keep your premium access without interruption.`;
    } else {
      return `You're currently enjoying a free ${trialLength} to try out all the new features. When you're ready, you can choose to continue with a subscription.`;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-gradient-to-br from-black via-[#121316] to-[#1f2128] text-white border border-red-600/40 shadow-2xl shadow-red-900/40">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
            <Crown className="h-6 w-6 text-red-500" />
            {getTitle()}
          </DialogTitle>
          <DialogDescription className="text-base text-gray-400 pt-2">
            {getMessage()}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Trial Status Card */}
          <div className="bg-[#1b1d23] border border-red-900/30 rounded-lg p-4 shadow-inner shadow-red-950/20">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-red-500" />
                <span className="font-semibold text-white">Trial Status</span>
              </div>
              <span className={`text-sm font-medium ${
                daysRemaining <= 3 ? 'text-red-400' :
                daysRemaining <= 7 ? 'text-orange-400' :
                'text-red-300'
              }`}>
                {daysRemaining === 0 ? 'Expires Today' :
                 daysRemaining === 1 ? '1 Day Left' :
                 `${daysRemaining} Days Left`}
              </span>
            </div>
            <div className="text-sm text-gray-400">
              <div className="flex justify-between items-center">
                <span>Expires:</span>
                <span className="text-white font-medium">{formatDate(trialEnds)}</span>
              </div>
              <div className="flex justify-between items-center mt-2">
                <span>Previous Plan:</span>
                <span className="text-white font-medium capitalize">{planType}</span>
              </div>
            </div>
          </div>

          {/* What You'll Keep/Lose */}
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <Unlock className="h-5 w-5 text-red-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-white">With a Subscription:</p>
                <p className="text-sm text-gray-400">Unlimited access to all premium content, ad-free listening, and exclusive shows</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Lock className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-white">Without a Subscription:</p>
                <p className="text-sm text-gray-400">Access limited to free sample episodes only</p>
              </div>
            </div>
          </div>

          {/* Friendly Note */}
          {!isFirstLogin && daysRemaining > 7 && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <Sparkles className="h-5 w-5 text-red-400 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-red-100">
                  No pressure! We want you to love the new platform. Take your time to explore, and subscribe when you're ready.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3 pt-2">
          {daysRemaining > 7 && (
            <Button
              variant="outline"
              onClick={handleRemindLater}
              className="flex-1 border-red-600/30 text-red-100 hover:bg-red-600/10 hover:text-white transition-colors"
            >
              Remind Me Later
            </Button>
          )}
          <Button
            onClick={handleViewPlans}
            className={`${daysRemaining <= 7 ? 'flex-1' : 'flex-1'} bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-900/20 transition-all`}
          >
            <Crown className="h-4 w-4 mr-2" />
            View Plans
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
