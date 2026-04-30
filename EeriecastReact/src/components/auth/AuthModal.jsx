import { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useUser } from '@/context/UserContext.jsx';
import { useAuthModal } from '@/context/AuthModalContext.jsx';
import {
  Check,
  ArrowLeft,
  Mail,
  Eye,
  EyeOff,
  CheckCircle,
  Loader2,
  Crown,
  Headphones,
  Skull,
  Moon,
  Sparkles,
} from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { User } from '@/api/entities';
import TermsOfServiceModal from '@/components/legal/TermsOfServiceModal';
import PrivacyPolicyModal from '@/components/legal/PrivacyPolicyModal';

const FEATURES = [
  { icon: Headphones, label: 'Ad-free listening across the whole catalog' },
  { icon: Crown,      label: 'Exclusive members-only shows & bonus episodes' },
  { icon: Skull,      label: 'Full horror audiobook library' },
  { icon: Moon,       label: 'Sleep timer, playback speed & downloads' },
  { icon: Sparkles,   label: 'Cross-device sync, follows, favorites, playlists' },
];

// Defined at module scope so its component identity is stable across renders.
// If this were nested inside AuthModal, every keystroke would re-declare the
// component, React would unmount the old <Input/> and mount a fresh one, and
// focus would jump back to the modal container after a single character.
function PasswordField({ id, value, onChange, show, onToggleShow, autoComplete, label }) {
  return (
    <div>
      <label htmlFor={id} className="text-[10px] uppercase tracking-[0.18em] font-semibold text-zinc-500 mb-1.5 block">
        {label}
      </label>
      <div className="relative group">
        <Input
          id={id}
          type={show ? 'text' : 'password'}
          required
          autoComplete={autoComplete}
          value={value}
          onChange={onChange}
          className="h-11 bg-white/[0.03] border-white/[0.08] text-white placeholder:text-zinc-600 focus-visible:ring-red-500/50 focus-visible:border-red-500/40 rounded-lg pr-11 transition-colors text-sm"
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={onToggleShow}
          aria-label={show ? 'Hide password' : 'Show password'}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-200 transition-colors p-1 rounded-md hover:bg-white/[0.04]"
        >
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}
PasswordField.propTypes = {
  id: PropTypes.string.isRequired,
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  show: PropTypes.bool.isRequired,
  onToggleShow: PropTypes.func.isRequired,
  autoComplete: PropTypes.string,
  label: PropTypes.string.isRequired,
};

export default function AuthModal({ isOpen, onClose, defaultTab = 'login' }) {
  const { login, register, error, isAuthenticated, loading } = useUser();
  const { afterLoginAction, subtitle } = useAuthModal();
  const [tab, setTab] = useState(defaultTab);
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  // Eeriecast is rated 17+ at the app store level (IARC/Mature 17+), which
  // is where age verification happens at install time. We deliberately do
  // NOT collect a date of birth at signup — it adds friction for a flow
  // that's already gated by the store, and collecting less data keeps our
  // privacy posture (GDPR/CCPA) and compliance surface (COPPA) simpler.
  // Explicit-content access is instead gated in-app by an 18+
  // self-attestation the first time a user turns on mature content (see
  // MatureContentModal + Settings.jsx). New users start with
  // `allow_mature_content = false` and opt in at the gate.
  const [registerForm, setRegisterForm] = useState({ email: '', password: '', confirm_password: '', username: '' });
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState(null);
  const [showLoginPw, setShowLoginPw] = useState(false);
  const [showRegPw, setShowRegPw] = useState(false);
  const [showRegConfirmPw, setShowRegConfirmPw] = useState(false);

  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSubmitted, setForgotSubmitted] = useState(false);

  const [showImportedWelcome, setShowImportedWelcome] = useState(false);
  const [importedUserEmail, setImportedUserEmail] = useState('');

  const [showTerms, setShowTerms] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);

  const prevAuthRef = useRef(isAuthenticated);

  useEffect(() => {
    if (!prevAuthRef.current && isAuthenticated && isOpen && !afterLoginAction?.fn) {
      onClose();
    }
    prevAuthRef.current = isAuthenticated;
  }, [isAuthenticated, isOpen, onClose, afterLoginAction]);

  useEffect(() => {
    setTab(defaultTab);
    setShowForgotPassword(false);
    setForgotEmail('');
    setForgotSubmitted(false);
    setShowImportedWelcome(false);
    setImportedUserEmail('');
    setLocalError(null);
  }, [defaultTab, isOpen]);

  // Login mirrors `handleRegister`: close immediately on success, fire the
  // toast, and let the data layer refetch in the background. PodcastContext
  // listens to `user?.id` and silently re-pulls the catalog so premium URLs
  // and unlock states reflect the authenticated identity. Favorites,
  // followings, notifications and history are already auto-refreshed by
  // UserContext's per-user effects. No artificial delay, no page reload.
  const handleLogin = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setLocalError(null);
    const result = await login(loginForm);
    if (result.success) {
      toast({ title: 'Welcome back!', description: "You're now signed in.", variant: 'success' });
      onClose();
    } else if (result.code === 'imported_user_welcome') {
      setImportedUserEmail(result.email || loginForm.email);
      setShowImportedWelcome(true);
    } else {
      setLocalError(result.error || 'Invalid credentials');
    }
    setSubmitting(false);
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setLocalError(null);
    if (registerForm.password !== registerForm.confirm_password) {
      setLocalError('Passwords do not match');
      setSubmitting(false);
      return;
    }
    // No DOB collected at signup. New users land with mature content OFF
    // and must self-attest 18+ the first time they enable it (that flow
    // lives in MatureContentModal + Settings.jsx).
    const payload = {
      ...registerForm,
      allow_mature_content: false,
    };
    const result = await register(payload);
    if (!result || result.success === false) {
      if (result?.code === 'imported_user_welcome') {
        setImportedUserEmail(result.email || registerForm.email);
        setShowImportedWelcome(true);
        setSubmitting(false);
        return;
      }
      setLocalError(result?.error || 'Registration failed');
      setSubmitting(false);
      return;
    }
    setSubmitting(false);
    sessionStorage.setItem('eeriecast_just_registered', '1');

    const pendingAction = afterLoginAction?.fn;
    onClose();

    if (pendingAction) {
      setTimeout(() => pendingAction(), 0);
      return;
    }
    window.dispatchEvent(new CustomEvent('eeriecast-start-onboarding', { detail: { variant: 'free' } }));
  };

  const isLogin = tab === 'login';
  const contextSubtitle = subtitle
    || (isLogin
      ? 'Log in to continue your eerie listening journey.'
      : 'Sign up for members-only features like favorites, history, playlists, follows and downloads.');

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
        <DialogContent
          className="p-0 overflow-hidden border-0 bg-transparent shadow-none
                     max-w-[95vw] sm:max-w-[460px] md:max-w-[860px]
                     max-h-[92vh] sm:max-h-[88vh]"
        >
          <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-[#0a0a0d] via-[#11101a] to-[#15101b] border border-white/[0.06] shadow-[0_40px_80px_-20px_rgba(0,0,0,0.8),0_0_0_1px_rgba(220,38,38,0.04)]">
            {/* Ambient glow accents */}
            <div className="pointer-events-none absolute -top-40 -left-40 w-[28rem] h-[28rem] rounded-full bg-red-600/[0.08] blur-[120px]" />
            <div className="pointer-events-none absolute -bottom-40 -right-40 w-[28rem] h-[28rem] rounded-full bg-amber-500/[0.05] blur-[120px]" />
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_0%,rgba(220,38,38,0.08),transparent_60%)]" />

            <div className="relative flex flex-col md:flex-row w-full max-h-[92vh] sm:max-h-[88vh]">
              {/* ═════════ Left — form ═════════ */}
              <div className="flex-1 p-6 sm:p-8 md:p-10 overflow-y-auto">
                {/* Brand mark */}
                <div className="flex flex-col items-center text-center mb-6 sm:mb-7">
                  <img
                    src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/e37bc9c15_logo.png"
                    alt="EERIECAST"
                    className="h-8 sm:h-9 mb-3 invert opacity-95"
                  />
                  {!showImportedWelcome && (
                    <>
                      <h2 className="text-[22px] sm:text-[26px] font-bold tracking-tight text-white">
                        {isLogin ? 'Welcome back' : 'Create your account'}
                      </h2>
                      <p className="text-[13px] text-zinc-400 mt-1.5 max-w-[320px] leading-relaxed">
                        {contextSubtitle}
                      </p>
                    </>
                  )}
                </div>

                {showImportedWelcome ? (
                  <div className="flex flex-col items-center py-6 text-center animate-in fade-in duration-300">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-red-600/20 to-red-500/10 flex items-center justify-center mb-4 ring-2 ring-red-600/30">
                      <CheckCircle className="w-8 h-8 text-red-500" />
                    </div>
                    <h3 className="text-xl font-bold mb-2 bg-gradient-to-r from-white to-zinc-300 bg-clip-text text-transparent">
                      Welcome to the new EERIECAST!
                    </h3>
                    <p className="text-sm text-zinc-400 mb-2 max-w-[320px] leading-relaxed">
                      We found your account from Memberful. Your premium access is still active!
                    </p>
                    <p className="text-sm text-zinc-300 mb-6 max-w-[320px]">
                      We&apos;ve sent an email to <span className="font-semibold text-white">{importedUserEmail}</span> with a link to set up your password.
                    </p>
                    <div className="w-full max-w-[340px] bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 mb-6">
                      <div className="flex items-start gap-3 text-left">
                        <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center flex-shrink-0">
                          <Mail className="w-4 h-4 text-red-400" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-zinc-200 mb-1">Check your inbox</p>
                          <p className="text-xs text-zinc-400 leading-relaxed">
                            Click the link in the email to set your password and start enjoying the new platform.
                          </p>
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setShowImportedWelcome(false); setImportedUserEmail(''); onClose(); }}
                      className="text-sm text-red-400 hover:text-red-300 transition-colors"
                    >
                      Close
                    </button>
                  </div>
                ) : showForgotPassword ? (
                  <div className="animate-in fade-in duration-300">
                    {forgotSubmitted ? (
                      <div className="flex flex-col items-center py-4 text-center">
                        <div className="w-14 h-14 rounded-full bg-red-500/[0.08] flex items-center justify-center mb-4 ring-1 ring-red-500/20">
                          <Mail className="w-6 h-6 text-red-400" />
                        </div>
                        <h3 className="text-base font-semibold text-white mb-2">Check your inbox</h3>
                        <p className="text-xs text-zinc-400 mb-5 max-w-[300px] leading-relaxed">
                          If an account exists for <span className="text-zinc-200">{forgotEmail}</span>, we&apos;ll send a password reset link shortly.
                        </p>
                        <button
                          type="button"
                          onClick={() => { setShowForgotPassword(false); setForgotSubmitted(false); setForgotEmail(''); }}
                          className="text-sm text-red-400 hover:text-red-300 flex items-center gap-1.5 transition-colors"
                        >
                          <ArrowLeft className="w-3.5 h-3.5" />
                          Back to login
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="text-center">
                          <h3 className="text-base font-semibold text-white mb-1">Forgot your password?</h3>
                          <p className="text-xs text-zinc-400">Enter your email and we&apos;ll send you a reset link.</p>
                        </div>
                        <div>
                          <label className="text-[10px] uppercase tracking-[0.18em] font-semibold text-zinc-500 mb-1.5 block">Email</label>
                          <Input
                            type="email"
                            required
                            autoComplete="email"
                            value={forgotEmail}
                            onChange={(e) => setForgotEmail(e.target.value)}
                            className="h-11 bg-white/[0.03] border-white/[0.08] text-white placeholder:text-zinc-600 focus-visible:ring-red-500/50 focus-visible:border-red-500/40 rounded-lg transition-colors text-sm"
                            placeholder="you@example.com"
                          />
                        </div>
                        {localError && (
                          <p className="text-red-400 text-xs bg-red-950/20 border border-red-900/30 rounded-lg px-3 py-2">{localError}</p>
                        )}
                        <Button
                          className="w-full h-11 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-semibold rounded-lg transition-all duration-300 shadow-[0_4px_14px_rgba(220,38,38,0.25)] hover:shadow-[0_6px_20px_rgba(220,38,38,0.35)]"
                          disabled={submitting || !forgotEmail.trim()}
                          onClick={async () => {
                            if (!forgotEmail.trim()) return;
                            setSubmitting(true);
                            setLocalError(null);
                            try {
                              await User.requestPasswordReset(forgotEmail.trim());
                              setForgotSubmitted(true);
                            } catch (err) {
                              setLocalError(err.message || 'Failed to request password reset. Please try again.');
                            } finally {
                              setSubmitting(false);
                            }
                          }}
                        >
                          {submitting ? (
                            <span className="flex items-center gap-2">
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Sending...
                            </span>
                          ) : 'Send reset link'}
                        </Button>
                        <p className="text-xs text-center">
                          <button
                            type="button"
                            onClick={() => { setShowForgotPassword(false); setForgotEmail(''); setLocalError(null); }}
                            className="text-red-400 hover:text-red-300 flex items-center gap-1.5 mx-auto transition-colors"
                          >
                            <ArrowLeft className="w-3.5 h-3.5" />
                            Back to login
                          </button>
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    {/* Segmented tab switcher */}
                    <div className="relative grid grid-cols-2 p-1 mb-5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                      <div
                        className={`absolute top-1 bottom-1 w-[calc(50%-0.25rem)] rounded-lg bg-gradient-to-br from-red-600 to-red-700 shadow-[0_2px_8px_rgba(220,38,38,0.35)] transition-transform duration-300 ease-out ${isLogin ? 'translate-x-0' : 'translate-x-full'}`}
                        style={{ left: '0.25rem' }}
                      />
                      <button
                        type="button"
                        onClick={() => { setTab('login'); setLocalError(null); }}
                        className={`relative z-[1] py-2 text-sm font-semibold transition-colors ${isLogin ? 'text-white' : 'text-zinc-400 hover:text-zinc-200'}`}
                      >
                        Log in
                      </button>
                      <button
                        type="button"
                        onClick={() => { setTab('register'); setLocalError(null); }}
                        className={`relative z-[1] py-2 text-sm font-semibold transition-colors ${!isLogin ? 'text-white' : 'text-zinc-400 hover:text-zinc-200'}`}
                      >
                        Create account
                      </button>
                    </div>

                    {isLogin ? (
                      <form onSubmit={handleLogin} className="space-y-4 animate-in fade-in duration-300">
                        <div>
                          <label htmlFor="login-email" className="text-[10px] uppercase tracking-[0.18em] font-semibold text-zinc-500 mb-1.5 block">Email</label>
                          <Input
                            id="login-email"
                            type="email"
                            required
                            autoComplete="email"
                            value={loginForm.email}
                            onChange={e => setLoginForm(f => ({ ...f, email: e.target.value }))}
                            className="h-11 bg-white/[0.03] border-white/[0.08] text-white placeholder:text-zinc-600 focus-visible:ring-red-500/50 focus-visible:border-red-500/40 rounded-lg transition-colors text-sm"
                            placeholder="you@example.com"
                          />
                        </div>

                        <PasswordField
                          id="login-password"
                          value={loginForm.password}
                          onChange={e => setLoginForm(f => ({ ...f, password: e.target.value }))}
                          show={showLoginPw}
                          onToggleShow={() => setShowLoginPw(v => !v)}
                          autoComplete="current-password"
                          label="Password"
                        />

                        <div className="flex justify-end -mt-1">
                          <button
                            type="button"
                            onClick={() => { setShowForgotPassword(true); setLocalError(null); }}
                            className="text-xs text-zinc-500 hover:text-red-400 transition-colors"
                          >
                            Forgot password?
                          </button>
                        </div>

                        {(localError || error) && (
                          <p className="text-red-400 text-xs bg-red-950/20 border border-red-900/30 rounded-lg px-3 py-2">
                            {localError || error}
                          </p>
                        )}

                        <Button
                          type="submit"
                          className="w-full h-11 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-semibold rounded-lg transition-all duration-300 shadow-[0_4px_14px_rgba(220,38,38,0.25)] hover:shadow-[0_6px_20px_rgba(220,38,38,0.35)]"
                          disabled={submitting || loading}
                        >
                          {submitting ? (
                            <span className="flex items-center gap-2">
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Logging in...
                            </span>
                          ) : 'Log in'}
                        </Button>
                      </form>
                    ) : (
                      <form onSubmit={handleRegister} className="space-y-4 animate-in fade-in duration-300">
                        <div>
                          <label htmlFor="reg-username" className="text-[10px] uppercase tracking-[0.18em] font-semibold text-zinc-500 mb-1.5 block">Username</label>
                          <Input
                            id="reg-username"
                            required
                            value={registerForm.username}
                            onChange={e => setRegisterForm(f => ({ ...f, username: e.target.value }))}
                            className="h-11 bg-white/[0.03] border-white/[0.08] text-white placeholder:text-zinc-600 focus-visible:ring-red-500/50 focus-visible:border-red-500/40 rounded-lg transition-colors text-sm"
                            placeholder="horrorfan666"
                          />
                        </div>
                        <div>
                          <label htmlFor="reg-email" className="text-[10px] uppercase tracking-[0.18em] font-semibold text-zinc-500 mb-1.5 block">Email</label>
                          <Input
                            id="reg-email"
                            type="email"
                            required
                            autoComplete="email"
                            value={registerForm.email}
                            onChange={e => setRegisterForm(f => ({ ...f, email: e.target.value }))}
                            className="h-11 bg-white/[0.03] border-white/[0.08] text-white placeholder:text-zinc-600 focus-visible:ring-red-500/50 focus-visible:border-red-500/40 rounded-lg transition-colors text-sm"
                            placeholder="you@example.com"
                          />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <PasswordField
                            id="reg-password"
                            value={registerForm.password}
                            onChange={e => setRegisterForm(f => ({ ...f, password: e.target.value }))}
                            show={showRegPw}
                            onToggleShow={() => setShowRegPw(v => !v)}
                            autoComplete="new-password"
                            label="Password"
                          />
                          <PasswordField
                            id="reg-confirm-password"
                            value={registerForm.confirm_password}
                            onChange={e => setRegisterForm(f => ({ ...f, confirm_password: e.target.value }))}
                            show={showRegConfirmPw}
                            onToggleShow={() => setShowRegConfirmPw(v => !v)}
                            autoComplete="new-password"
                            label="Confirm"
                          />
                        </div>

                        {(localError || error) && (
                          <p className="text-red-400 text-xs bg-red-950/20 border border-red-900/30 rounded-lg px-3 py-2">
                            {localError || error}
                          </p>
                        )}

                        <Button
                          type="submit"
                          className="w-full h-11 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-semibold rounded-lg transition-all duration-300 shadow-[0_4px_14px_rgba(220,38,38,0.25)] hover:shadow-[0_6px_20px_rgba(220,38,38,0.35)]"
                          disabled={submitting || loading}
                        >
                          {submitting ? (
                            <span className="flex items-center gap-2">
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Creating...
                            </span>
                          ) : 'Create account'}
                        </Button>
                      </form>
                    )}

                    {/* ─── Mobile-only condensed membership promo ───
                         Desktop uses the full-height right-column aside.
                         Small screens get this minimal, single-row card
                         so the ad + trial CTA are still visible without
                         crowding the form above the fold. */}
                    <div className="md:hidden mt-5 rounded-xl border border-white/[0.08] bg-gradient-to-br from-white/[0.04] to-white/[0.01] p-3 relative overflow-hidden">
                      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_0%_0%,rgba(220,38,38,0.16),transparent_65%)]" />
                      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_100%_100%,rgba(245,158,11,0.08),transparent_55%)]" />
                      <div className="relative flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-400/[0.2] to-amber-500/[0.08] border border-amber-400/25 flex items-center justify-center flex-shrink-0">
                          <Crown className="w-4 h-4 text-amber-300" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[12.5px] font-bold text-white tracking-tight">Go Premium</span>
                            <span className="text-[10px] font-semibold text-amber-300/90 uppercase tracking-[0.14em]">7 days free</span>
                          </div>
                          <p className="text-[11px] text-zinc-400 leading-snug mt-0.5 truncate">
                            Ad-free &middot; exclusive shows &middot; full audiobook library
                          </p>
                        </div>
                        <span className="text-[11px] font-semibold text-zinc-300 whitespace-nowrap">
                          $7.99<span className="text-zinc-500 font-normal">/mo</span>
                        </span>
                      </div>
                    </div>

                    {/* Fine-print with real Terms / Privacy buttons */}
                    <p className="text-[11px] text-center text-zinc-500 mt-5 leading-relaxed">
                      By continuing you agree to our{' '}
                      <button
                        type="button"
                        onClick={() => setShowTerms(true)}
                        className="text-zinc-300 hover:text-red-400 underline-offset-2 hover:underline transition-colors"
                      >
                        Terms
                      </button>
                      {' '}and{' '}
                      <button
                        type="button"
                        onClick={() => setShowPrivacy(true)}
                        className="text-zinc-300 hover:text-red-400 underline-offset-2 hover:underline transition-colors"
                      >
                        Privacy Policy
                      </button>
                      .
                    </p>
                  </>
                )}
              </div>

              {/* ═════════ Right — membership promo (hidden on mobile) ═════════ */}
              <aside className="hidden md:flex w-[300px] xl:w-[320px] flex-shrink-0 flex-col justify-between relative border-l border-white/[0.05] bg-gradient-to-br from-black/60 via-[#14101c]/60 to-[#0f0b14]/60 backdrop-blur-sm overflow-hidden">
                {/* Glow details */}
                <div className="pointer-events-none absolute -top-20 -right-16 w-60 h-60 rounded-full bg-red-600/[0.15] blur-[80px]" />
                <div className="pointer-events-none absolute -bottom-20 -left-16 w-60 h-60 rounded-full bg-amber-500/[0.08] blur-[80px]" />
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,rgba(220,38,38,0.08),transparent_50%)]" />

                <div className="relative p-7 xl:p-8">
                  {/* Premium badge */}
                  <div className="inline-flex items-center gap-1.5 bg-gradient-to-r from-amber-400/[0.18] to-amber-500/[0.08] text-amber-300 text-[10px] font-bold uppercase tracking-[0.2em] px-2.5 py-1 rounded-full border border-amber-400/[0.2] mb-5">
                    <Crown className="w-3 h-3" />
                    <span>Membership</span>
                  </div>

                  <h3 className="text-[22px] font-bold text-white leading-tight tracking-tight mb-2">
                    Unlock the full horror catalog
                  </h3>
                  <p className="text-[13px] text-zinc-400 leading-relaxed mb-5">
                    Exclusive shows, after-hours episodes, and the complete audiobook library &mdash; on every device.
                  </p>

                  {/* Price tile */}
                  <div className="relative rounded-xl border border-white/[0.08] bg-gradient-to-br from-white/[0.04] to-white/[0.01] p-4 mb-6 overflow-hidden">
                    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_0%_0%,rgba(220,38,38,0.18),transparent_60%)]" />
                    <div className="relative flex items-baseline gap-1.5">
                      <span className="text-[28px] font-extrabold text-white leading-none tracking-tight">$7.99</span>
                      <span className="text-xs text-zinc-400 font-medium">/mo</span>
                    </div>
                    <p className="relative text-[11px] text-zinc-500 mt-1.5">
                      7-day free trial &middot; cancel anytime
                    </p>
                  </div>

                  {/* Feature list */}
                  <ul className="space-y-2.5">
                    {FEATURES.map(({ icon: Icon, label }) => (
                      <li key={label} className="flex items-start gap-2.5 text-[12.5px] text-zinc-300 leading-snug">
                        <span className="mt-0.5 w-5 h-5 rounded-md bg-white/[0.04] border border-white/[0.06] flex items-center justify-center flex-shrink-0">
                          <Icon className="w-3 h-3 text-red-400" />
                        </span>
                        <span>{label}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Footer of aside */}
                <div className="relative px-7 xl:px-8 py-4 border-t border-white/[0.05] bg-black/30">
                  <div className="flex items-center gap-1.5 text-[10.5px] text-zinc-500">
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span>Secure checkout &middot; Cancel anytime</span>
                  </div>
                </div>
              </aside>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Legal modals — rendered as siblings so they layer above the auth modal */}
      <TermsOfServiceModal open={showTerms} onOpenChange={setShowTerms} />
      <PrivacyPolicyModal open={showPrivacy} onOpenChange={setShowPrivacy} />
    </>
  );
}

AuthModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  defaultTab: PropTypes.string,
};
