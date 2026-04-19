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
    } else if (daysRemaining <= 7) {
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
    } else {
      return `You're currently enjoying a free ${trialLength} to try out all the new features. When you're ready, you can choose to continue with a subscription.`;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-gray-900 border-gray-800">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
            <Crown className="h-6 w-6 text-yellow-500" />
            {getTitle()}
          </DialogTitle>
          <DialogDescription className="text-base text-gray-300 pt-2">
            {getMessage()}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Trial Status Card */}
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-blue-400" />
                <span className="font-semibold text-white">Trial Status</span>
              </div>
              <span className={`text-sm font-medium ${
                daysRemaining <= 3 ? 'text-red-400' :
                daysRemaining <= 7 ? 'text-orange-400' :
                'text-green-400'
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
              <Unlock className="h-5 w-5 text-green-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-white">With a Subscription:</p>
                <p className="text-sm text-gray-400">Unlimited access to all premium content, ad-free listening, and exclusive shows</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Lock className="h-5 w-5 text-red-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-white">Without a Subscription:</p>
                <p className="text-sm text-gray-400">Access limited to free sample episodes only</p>
              </div>
            </div>
          </div>

          {/* Friendly Note */}
          {!isFirstLogin && daysRemaining > 7 && (
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <Sparkles className="h-5 w-5 text-blue-400 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-blue-100">
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
              className="flex-1"
            >
              Remind Me Later
            </Button>
          )}
          <Button
            onClick={handleViewPlans}
            className={`${daysRemaining <= 7 ? 'flex-1' : 'flex-1'} bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700`}
          >
            <Crown className="h-4 w-4 mr-2" />
            View Plans
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
