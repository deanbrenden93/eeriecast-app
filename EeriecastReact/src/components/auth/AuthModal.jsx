import { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useUser } from '@/context/UserContext.jsx';
import { useAuthModal } from '@/context/AuthModalContext.jsx';
import { Check, ArrowLeft, Mail, Eye, EyeOff, CheckCircle } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

export default function AuthModal({ isOpen, onClose, defaultTab = 'login' }) {
  const { login, register, error, isAuthenticated, loading, user } = useUser();
  const { afterLoginAction, subtitle } = useAuthModal();
  const [tab, setTab] = useState(defaultTab);
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [registerForm, setRegisterForm] = useState({ email: '', password: '', confirm_password: '', username: '' });
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState(null);
  const [showLoginPw, setShowLoginPw] = useState(false);
  const [showRegPw, setShowRegPw] = useState(false);
  const [showRegConfirmPw, setShowRegConfirmPw] = useState(false);
  const [successState, setSuccessState] = useState(null); // 'login' | 'register' | null
  const successTimerRef = useRef(null);

  // Forgot password sub-view
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSubmitted, setForgotSubmitted] = useState(false);

  const FEATURES = [
    'Listening History Sync',
    'Follow Your Favorite Shows',
    'Sleep Timer & Playback Speed',
    'Sample Exclusive Content',
  ];

  const prevAuthRef = useRef(isAuthenticated);

  useEffect(() => {
    // Only auto-close if we transition from NOT authenticated to authenticated while the modal is open.
    // If afterLoginAction is pending, let GlobalAuthModal handle the close + callback
    // simultaneously for a seamless transition (no flicker between modals).
    // Skip if successState is active — we're showing a success animation and will close on our own.
    if (!prevAuthRef.current && isAuthenticated && isOpen && !afterLoginAction?.fn && !successState) {
      onClose();
    }
    prevAuthRef.current = isAuthenticated;
  }, [isAuthenticated, isOpen, onClose, afterLoginAction, successState]);

  useEffect(() => {
    setTab(defaultTab);
    setShowForgotPassword(false);
    setForgotEmail('');
    setForgotSubmitted(false);
    setSuccessState(null);
    if (successTimerRef.current) clearTimeout(successTimerRef.current);
  }, [defaultTab, isOpen]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setLocalError(null);
    const success = await login(loginForm);
    if (!success) { setLocalError('Invalid credentials'); setSubmitting(false); return; }
    setSubmitting(false);
    if (afterLoginAction?.fn) return; // GlobalAuthModal handles close + callback seamlessly
    setSuccessState('login');
    toast({ title: 'Welcome back!', description: 'You\'re now signed in.', variant: 'success' });
    successTimerRef.current = setTimeout(() => { setSuccessState(null); onClose(); window.location.reload(); }, 1500);
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
    const success = await register(registerForm);
    if (!success) { setLocalError('Registration failed'); setSubmitting(false); return; }
    setSubmitting(false);
    if (afterLoginAction?.fn) return; // GlobalAuthModal handles close + callback seamlessly
    setSuccessState('register');
    toast({ title: 'Account created!', description: 'Welcome to EERIECAST.', variant: 'success' });
    successTimerRef.current = setTimeout(() => { setSuccessState(null); onClose(); window.location.reload(); }, 1800);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-[95vw] sm:max-w-[500px] md:max-w-[760px] bg-gradient-to-br from-black via-[#121316] to-[#1f2128] text-white border border-red-600/40 shadow-2xl shadow-red-900/40 p-0 overflow-hidden max-h-[90vh] overflow-y-auto">
        <div className="flex flex-col md:flex-row w-full">
          {/* Left / Main Form Section */}
          <div className="flex-1 p-4 sm:p-6 md:p-8">
            <div className="flex flex-col items-center mb-4 sm:mb-6">
              <img
                src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/e37bc9c15_logo.png"
                alt="EERIECAST"
                className="h-8 sm:h-10 md:h-12 mb-2 sm:mb-3 invert opacity-90"
              />
              {!successState && (
                <div className="text-center space-y-1">
                  {tab === 'login' ? (
                    <>
                      <h2 className="text-lg sm:text-xl font-semibold tracking-wide">Welcome Back</h2>
                      <p className="text-xs sm:text-sm text-gray-400 px-2">{subtitle || 'Log in to continue your eerie listening journey.'}</p>
                    </>
                  ) : (
                    <>
                      <h2 className="text-lg sm:text-xl font-semibold tracking-wide">Create Your Account</h2>
                      <p className="text-xs sm:text-sm text-gray-400 px-2">{subtitle || 'Sign up for members-only features like favorites, history, playlists, follows and downloads!'}</p>
                    </>
                  )}
                </div>
              )}
            </div>
            {successState ? (
              <div className="flex flex-col items-center py-8 animate-in fade-in zoom-in-95 duration-300">
                <div className="w-14 h-14 rounded-full bg-green-500/10 flex items-center justify-center mb-4 ring-1 ring-green-500/20">
                  <CheckCircle className="w-7 h-7 text-green-500" />
                </div>
                <h3 className="text-lg font-semibold mb-1">
                  {successState === 'login' ? 'Welcome back!' : 'Welcome to EERIECAST!'}
                </h3>
                <p className="text-sm text-gray-400">
                  {successState === 'login'
                    ? 'You\'re signed in. Enjoy the show.'
                    : 'Your account is ready. Let the nightmares begin.'}
                </p>
              </div>
            ) : (
            <Tabs value={tab} onValueChange={setTab} className="w-full">
              <TabsList className="grid grid-cols-2 w-full mb-4 sm:mb-6 bg-[#2a2d36] text-gray-300">
                <TabsTrigger value="login" className="data-[state=active]:bg-red-600 data-[state=active]:text-white text-sm sm:text-base">Login</TabsTrigger>
                <TabsTrigger value="register" className="data-[state=active]:bg-red-600 data-[state=active]:text-white text-sm sm:text-base">Register</TabsTrigger>
              </TabsList>
              <TabsContent value="login">
                {showForgotPassword ? (
                  <div className="animate-in fade-in duration-300">
                    {forgotSubmitted ? (
                      /* Success state */
                      <div className="flex flex-col items-center py-4 text-center">
                        <div className="w-12 h-12 rounded-full bg-red-600/10 flex items-center justify-center mb-3 ring-1 ring-red-600/20">
                          <Mail className="w-6 h-6 text-red-500" />
                        </div>
                        <h3 className="text-base font-semibold mb-1">Check your inbox</h3>
                        <p className="text-xs text-gray-400 mb-4 max-w-[280px]">
                          If an account exists for <span className="text-gray-300">{forgotEmail}</span>, we&apos;ll send a password reset link shortly.
                        </p>
                        <button
                          type="button"
                          onClick={() => { setShowForgotPassword(false); setForgotSubmitted(false); setForgotEmail(''); }}
                          className="text-sm text-red-400 hover:text-red-300 flex items-center gap-1.5"
                        >
                          <ArrowLeft className="w-3.5 h-3.5" />
                          Back to login
                        </button>
                      </div>
                    ) : (
                      /* Email input form */
                      <div className="space-y-4">
                        <div className="text-center mb-2">
                          <h3 className="text-base font-semibold mb-1">Forgot your password?</h3>
                          <p className="text-xs text-gray-400">Enter your email and we&apos;ll send you a reset link.</p>
                        </div>
                        <div>
                          <label className="text-xs uppercase tracking-wider font-medium text-gray-400 mb-1 block">Email</label>
                          <Input
                            type="email"
                            required
                            autoComplete="email"
                            value={forgotEmail}
                            onChange={(e) => setForgotEmail(e.target.value)}
                            className="bg-[#1b1d23] border-gray-700 focus-visible:ring-red-600 text-sm sm:text-base"
                            placeholder="you@example.com"
                          />
                        </div>
                        <Button
                          className="w-full bg-red-600 hover:bg-red-500 text-sm sm:text-base"
                          onClick={() => {
                            if (forgotEmail.trim()) setForgotSubmitted(true);
                            // TODO: call User.requestPasswordReset(forgotEmail) once backend email service is configured
                          }}
                        >
                          Send Reset Link
                        </Button>
                        <p className="text-xs text-center">
                          <button
                            type="button"
                            onClick={() => { setShowForgotPassword(false); setForgotEmail(''); }}
                            className="text-red-400 hover:text-red-300 flex items-center gap-1.5 mx-auto"
                          >
                            <ArrowLeft className="w-3.5 h-3.5" />
                            Back to login
                          </button>
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <form onSubmit={handleLogin} className="space-y-3 sm:space-y-4 animate-in fade-in duration-300">
                    <div>
                      <label className="text-xs uppercase tracking-wider font-medium text-gray-400 mb-1 block">Email</label>
                      <Input type="email" required autoComplete="email" value={loginForm.email} onChange={e=>setLoginForm(f=>({...f,email:e.target.value}))} className="bg-[#1b1d23] border-gray-700 focus-visible:ring-red-600 text-sm sm:text-base" />
                    </div>
                    <div>
                      <label className="text-xs uppercase tracking-wider font-medium text-gray-400 mb-1 block">Password</label>
                      <div className="relative">
                        <Input type={showLoginPw ? 'text' : 'password'} required autoComplete="current-password" value={loginForm.password} onChange={e=>setLoginForm(f=>({...f,password:e.target.value}))} className="bg-[#1b1d23] border-gray-700 focus-visible:ring-red-600 text-sm sm:text-base pr-10" />
                        <button type="button" tabIndex={-1} onClick={() => setShowLoginPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors">
                          {showLoginPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      <div className="text-right mt-1">
                        <button type="button" onClick={() => setShowForgotPassword(true)} className="text-xs text-gray-500 hover:text-red-400 transition-colors">Forgot password?</button>
                      </div>
                    </div>
                    {(localError || error) && <p className="text-red-400 text-xs sm:text-sm bg-red-950/30 border border-red-800/40 rounded px-3 py-2">{localError || error}</p>}
                    <Button type="submit" className="w-full bg-red-600 hover:bg-red-500 text-sm sm:text-base" disabled={submitting || loading}>{submitting ? 'Logging in...' : 'Login'}</Button>
                    <p className="text-xs text-center text-gray-400">Don&apos;t have an account? <button type="button" onClick={()=>setTab('register')} className="text-red-400 hover:text-red-300 underline-offset-2 hover:underline">Create one free</button></p>
                  </form>
                )}
              </TabsContent>
              <TabsContent value="register">
                <form onSubmit={handleRegister} className="space-y-3 sm:space-y-4 animate-in fade-in duration-300">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                    <div className="md:col-span-2">
                      <label className="text-xs uppercase tracking-wider font-medium text-gray-400 mb-1 block">Username</label>
                      <Input required value={registerForm.username} onChange={e=>setRegisterForm(f=>({...f,username:e.target.value}))} className="bg-[#1b1d23] border-gray-700 focus-visible:ring-red-600 text-sm sm:text-base" />
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-xs uppercase tracking-wider font-medium text-gray-400 mb-1 block">Email</label>
                      <Input type="email" required autoComplete="email" value={registerForm.email} onChange={e=>setRegisterForm(f=>({...f,email:e.target.value}))} className="bg-[#1b1d23] border-gray-700 focus-visible:ring-red-600 text-sm sm:text-base" />
                    </div>
                    <div>
                      <label className="text-xs uppercase tracking-wider font-medium text-gray-400 mb-1 block">Password</label>
                      <div className="relative">
                        <Input type={showRegPw ? 'text' : 'password'} required autoComplete="new-password" value={registerForm.password} onChange={e=>setRegisterForm(f=>({...f,password:e.target.value}))} className="bg-[#1b1d23] border-gray-700 focus-visible:ring-red-600 text-sm sm:text-base pr-10" />
                        <button type="button" tabIndex={-1} onClick={() => setShowRegPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors">
                          {showRegPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs uppercase tracking-wider font-medium text-gray-400 mb-1 block">Confirm Password</label>
                      <div className="relative">
                        <Input type={showRegConfirmPw ? 'text' : 'password'} required autoComplete="new-password" value={registerForm.confirm_password} onChange={e=>setRegisterForm(f=>({...f,confirm_password:e.target.value}))} className="bg-[#1b1d23] border-gray-700 focus-visible:ring-red-600 text-sm sm:text-base pr-10" />
                        <button type="button" tabIndex={-1} onClick={() => setShowRegConfirmPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors">
                          {showRegConfirmPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>
                  {(localError || error) && <p className="text-red-400 text-xs sm:text-sm bg-red-950/30 border border-red-800/40 rounded px-3 py-2">{localError || error}</p>}
                  <Button type="submit" className="w-full bg-red-600 hover:bg-red-500 text-sm sm:text-base" disabled={submitting || loading}>{submitting ? 'Creating...' : 'Create Account'}</Button>
                  <p className="text-xs text-center text-gray-400">Already have an account? <button type="button" onClick={()=>setTab('login')} className="text-red-400 hover:text-red-300 underline-offset-2 hover:underline">Log in</button></p>
                </form>
              </TabsContent>
            </Tabs>
            )}
          </div>
          {/* Right / Feature Panel (hidden on small screens) */}
            <div className="hidden md:flex w-[240px] xl:w-[260px] flex-col justify-between bg-[#191b21] border-l border-gray-800/60 p-6 relative overflow-hidden">
              <div className="absolute -top-24 -right-24 w-64 h-64 bg-red-600/20 rounded-full blur-3xl" />
              <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-red-600/40 to-transparent" />
              <div>
                {/* Pricing / Tagline */}
                <div className="mb-8">
                  <div className="relative group">
                    <div className="absolute inset-0 bg-gradient-to-br from-red-600/25 via-red-500/10 to-transparent rounded-lg blur-sm opacity-70 group-hover:opacity-100 transition" />
                    <div className="relative rounded-lg border border-red-600/40 bg-[#201e22]/70 backdrop-blur-sm px-3 py-3 mt-3 text-center shadow-inner shadow-red-900/30">
                      <p className="text-[10px] tracking-[0.25em] font-semibold uppercase text-red-300/90 mb-1">Endless Nightmares for only</p>
                      <p className="text-xl font-extrabold leading-none text-white drop-shadow-sm">$7.99 <span className="text-[11px] font-medium text-gray-300">/mo</span></p>
                    </div>
                  </div>
                  {/*<p className="mt-3 text-[11px] text-gray-400 leading-relaxed">*/}
                  {/*  Unlock chilling exclusives, ad-free binges, offline downloads and a growing vault of members‑only shows. Cancel anytime.*/}
                  {/*</p>*/}
                </div>
                <h3 className="text-sm font-semibold uppercase tracking-wider text-red-400 mb-4">Member Perks</h3>
                <ul className="space-y-3">
                  {FEATURES.map(f => (
                    <li key={f} className="flex items-start gap-3 text-sm text-gray-300">
                      <span className="mt-0.5 text-red-500"><Check className="w-4 h-4" /></span>{f}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="mt-8 text-[11px] text-gray-500 leading-relaxed">
                By continuing you agree to our <span className="text-gray-300">Terms</span> & <span className="text-gray-300">Privacy Policy</span>.
              </div>
            </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

AuthModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  defaultTab: PropTypes.string,
};
