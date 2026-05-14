import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Mail, X, Loader2 } from 'lucide-react';
import { User } from '@/api/entities';
import { toast } from '@/components/ui/use-toast';

/**
 * Thin top-of-page banner shown to authenticated users whose email is still
 * unverified. The single biggest lever on verification completion is
 * reminding users that they need to do it — most folks miss the initial
 * email in their spam folder and never come back to it without a nudge.
 *
 * Dismissals are stored per-day in localStorage (same pattern as
 * LegacyTrialBanner) so the banner doesn't nag on every navigation but
 * does come back tomorrow if the user still hasn't verified.
 */
export default function VerifyEmailBanner({ email }) {
  const [dismissed, setDismissed] = useState(false);
  const [resendStatus, setResendStatus] = useState('idle');

  useEffect(() => {
    const dismissedDate = localStorage.getItem('verify_email_banner_dismissed');
    const today = new Date().toDateString();
    if (dismissedDate === today) {
      setDismissed(true);
    }
  }, []);

  if (dismissed) return null;

  const handleDismiss = () => {
    const today = new Date().toDateString();
    localStorage.setItem('verify_email_banner_dismissed', today);
    setDismissed(true);
  };

  const handleResend = async () => {
    if (!email || resendStatus !== 'idle') return;
    setResendStatus('sending');
    try {
      await User.resendVerificationEmail(email);
      setResendStatus('sent');
      toast({
        title: 'Verification email sent',
        description: `Sent another link to ${email}. Check your inbox (and spam).`,
        variant: 'success',
      });
    } catch (err) {
      setResendStatus('idle');
      toast({
        title: 'Could not resend',
        description: err?.message || 'Please try again in a minute.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="w-full bg-gradient-to-r from-amber-600/10 via-amber-500/15 to-amber-600/10 border-y border-amber-500/20 px-4 py-2.5">
      <div className="max-w-6xl mx-auto flex items-center gap-3">
        <div className="w-7 h-7 rounded-md bg-amber-500/15 border border-amber-500/30 flex items-center justify-center flex-shrink-0">
          <Mail className="w-3.5 h-3.5 text-amber-300" />
        </div>
        <p className="text-[12.5px] text-amber-100/90 leading-snug flex-1 min-w-0">
          <span className="font-semibold text-amber-100">Verify your email.</span>{' '}
          <span className="text-amber-100/70">
            We sent a link to {email ? <span className="text-amber-100">{email}</span> : 'your inbox'}. Check your spam folder if you don&apos;t see it.
          </span>
        </p>
        <button
          type="button"
          onClick={handleResend}
          disabled={resendStatus !== 'idle'}
          className="text-[12px] font-semibold text-amber-200 hover:text-white px-3 py-1 rounded-md hover:bg-amber-500/15 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-1.5 flex-shrink-0"
        >
          {resendStatus === 'sending' && <Loader2 className="w-3 h-3 animate-spin" />}
          {resendStatus === 'sending'
            ? 'Sending…'
            : resendStatus === 'sent'
              ? 'Sent!'
              : 'Resend email'}
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss"
          className="text-amber-200/60 hover:text-amber-100 p-1 rounded-md hover:bg-amber-500/10 transition-colors flex-shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

VerifyEmailBanner.propTypes = {
  email: PropTypes.string,
};
