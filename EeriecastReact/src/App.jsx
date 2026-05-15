import './App.css'
import { useState, useEffect, useCallback, useRef } from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import Pages from "@/pages/index.jsx"
import { Toaster } from "@/components/ui/toaster"
import { AudioPlayerProvider } from "@/context/AudioPlayerContext"
import { AuthModalProvider, useAuthModal } from '@/context/AuthModalContext.jsx';
import { useUser } from '@/context/UserContext.jsx';
import { CartProvider } from '@/context/CartContext.jsx';
import CartDrawer from '@/components/shop/CartDrawer.jsx';
import AuthModal from '@/components/auth/AuthModal.jsx';
import ErrorBoundary from '@/components/ErrorBoundary.jsx';
import SplashScreen from '@/components/SplashScreen.jsx';
import OnboardingFlow from '@/components/OnboardingFlow.jsx';
import LegacyTrialReminderModal from '@/components/auth/LegacyTrialReminderModal.jsx';
import { computeTrialDaysRemaining } from '@/utils/trial.js';
import { djangoClient } from '@/api/djangoClient.js';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient.js';

function GlobalAuthModal() {
  const { open, closeAuth, defaultTab, afterLoginAction, setAfterLoginAction } = useAuthModal();
  const { isAuthenticated } = useUser();

  useEffect(() => {
    if (isAuthenticated && afterLoginAction?.fn) {
      const callback = afterLoginAction.fn;
      // Clear action FIRST to avoid any potential loops if callback re-opens modal
      setAfterLoginAction(null);
      callback();
    }
  }, [isAuthenticated, afterLoginAction, setAfterLoginAction]);

  return (
    <AuthModal isOpen={open} onClose={closeAuth} defaultTab={defaultTab} />
  );
}

function App() {
  // Show splash only once per session unless explicitly reset (e.g. Settings → Landing Screen)
  const alreadyShown = sessionStorage.getItem('eeriecast_splash_shown') === '1';
  const hasToken = !!djangoClient.getToken();
  const [splashDone, setSplashDone] = useState(alreadyShown || hasToken);

  const handleSplashComplete = () => {
    sessionStorage.setItem('eeriecast_splash_shown', '1');
    setSplashDone(true);
  };

  // Defer mounting the heavy app tree until 1 s into the splash.
  // At that point distortion is still ~100 % so any rendering jank is invisible.
  // By the time the splash fades (4.3 s) the page is fully loaded underneath.
  const [appMounted, setAppMounted] = useState(splashDone);
  useEffect(() => {
    if (splashDone) { setAppMounted(true); return; }
    const t = setTimeout(() => setAppMounted(true), 1000);
    return () => clearTimeout(t);
  }, [splashDone]);

  // Onboarding flow — triggered via custom event after registration or premium purchase
  const [onboardingVariant, setOnboardingVariant] = useState(null);
  // Session-local dismissal sentinel: once the user reaches/skips/completes
  // onboarding in this session, we never auto-remount it again — even if the
  // backend ``onboarding_completed`` flag hasn't round-tripped yet. Without
  // this, the belt-and-suspenders effect below loops on Skip All because
  // ``markOnboardingDone`` is async and ``user.onboarding_completed`` stays
  // false locally until the next /me fetch.
  const onboardingDismissedRef = useRef(
    typeof window !== 'undefined'
      && sessionStorage.getItem('eeriecast_onboarding_session_dismissed') === '1'
  );
  const {
    user,
    isAuthenticated,
    loading: userLoading,
    isOnLegacyTrial,
    legacyTrialEnds,
    legacyTrialDaysRemaining,
    hasPaymentMethod
  } = useUser();

  useEffect(() => {
    // Auto-trigger onboarding for any authenticated user whose backend
    // ``onboarding_completed`` flag is still false. The backend flag is
    // the source of truth — it survives across devices, browsers, and
    // cache clears, which is what we want for a one-time-per-account
    // experience.
    //
    // We do NOT gate this on ``isOnboardingDone()`` (the browser-wide
    // localStorage flag): that flag is per-device and gets stuck from
    // earlier dev testing or other accounts using the same browser,
    // which silently swallows onboarding for fresh accounts on the
    // same machine.
    //
    // The handler covers three real-world paths:
    //   1. Fresh signup — handleRegister fires the custom event, but
    //      this effect is the belt-and-suspenders backup in case the
    //      event is missed (e.g. AuthModal already unmounted, race in
    //      registration handler, etc.).
    //   2. User signs up on device A, never finishes onboarding, then
    //      logs into device B — they see onboarding on device B.
    //   3. Imported Memberful users — same flow, with the premium
    //      variant selected based on ``is_premium``.
    if (
      isAuthenticated
      && user
      && !userLoading
      && user.onboarding_completed === false
      && !onboardingVariant
      && !onboardingDismissedRef.current
    ) {
      const isImported = !!user.is_imported_from_memberful;
      if (isImported) {
        setOnboardingVariant(user.is_premium ? 'premium' : 'free');
      } else {
        setOnboardingVariant(user.is_premium ? 'premium-existing' : 'free');
      }
    }
  }, [isAuthenticated, user, userLoading, onboardingVariant]);

  useEffect(() => {
    const handler = (e) => {
      const variant = e?.detail?.variant;
      if (variant === 'free' || variant === 'premium' || variant === 'premium-existing') {
        // Explicit dispatch (post-signup, post-upgrade) overrides the
        // session-dismissed sentinel — if someone triggers onboarding on
        // purpose, honor it.
        onboardingDismissedRef.current = false;
        try { sessionStorage.removeItem('eeriecast_onboarding_session_dismissed'); } catch { /* noop */ }
        setOnboardingVariant(variant);
      }
    };
    window.addEventListener('eeriecast-start-onboarding', handler);
    return () => window.removeEventListener('eeriecast-start-onboarding', handler);
  }, []);

  const handleOnboardingComplete = useCallback(() => {
    // Mark dismissed in-session so the belt-and-suspenders effect doesn't
    // immediately re-mount the flow while ``markOnboardingDone``'s backend
    // PATCH is still in flight (and the cached ``user.onboarding_completed``
    // is still false).
    onboardingDismissedRef.current = true;
    try { sessionStorage.setItem('eeriecast_onboarding_session_dismissed', '1'); } catch { /* noop */ }
    setOnboardingVariant(null);
  }, []);

  // Legacy trial reminder modal.
  //
  // We only nag users in the final 3 days of the trial AND only if they have
  // NOT yet attached a payment method. If a card is on file they'll be
  // charged automatically when the trial ends, so there's no benefit to
  // interrupting them with a modal.
  const [showLegacyTrialModal, setShowLegacyTrialModal] = useState(false);

  // Compute days from the end date so the modal uses the exact same value as
  // the banner and Billing page (avoids "banner says 2 days, modal says ends
  // today" style mismatches caused by floor vs ceil rounding).
  const effectiveLegacyDays = computeTrialDaysRemaining(
    legacyTrialEnds,
    legacyTrialDaysRemaining
  );

  useEffect(() => {
    if (!isAuthenticated || !isOnLegacyTrial || userLoading) return;
    // User already has a card — they'll renew automatically, leave them alone.
    if (hasPaymentMethod) return;
    // Only surface the modal in the final stretch of the trial.
    if (effectiveLegacyDays > 3) return;

    const dayKey = `legacy_trial_modal_shown_${user?.id}_${new Date().toDateString()}`;
    if (sessionStorage.getItem(dayKey)) return;

    const timer = setTimeout(() => {
      setShowLegacyTrialModal(true);
      sessionStorage.setItem(dayKey, 'true');
    }, 3000);
    return () => clearTimeout(timer);
  }, [isAuthenticated, isOnLegacyTrial, userLoading, hasPaymentMethod, effectiveLegacyDays, user?.id]);

  return (
    <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
    <AuthModalProvider>
      <Router>
        <AudioPlayerProvider>
          <CartProvider>
          {appMounted && <Pages />}
          <Toaster />
          <GlobalAuthModal />
          <CartDrawer />
          {/* Splash overlay */}
          <AnimatePresence>
            {!splashDone && (
              <SplashScreen
                key="splash"
                onComplete={handleSplashComplete}
              />
            )}
          </AnimatePresence>
          {/* Post-signup onboarding */}
          <AnimatePresence>
            {onboardingVariant && (
              <OnboardingFlow
                key="onboarding"
                variant={onboardingVariant}
                onComplete={handleOnboardingComplete}
              />
            )}
          </AnimatePresence>
          {/* Legacy trial reminder modal — only shown in the last 3 days
              of the trial for users without a payment method on file. */}
          {isOnLegacyTrial && !hasPaymentMethod && (
            <LegacyTrialReminderModal
              isOpen={showLegacyTrialModal}
              onClose={() => setShowLegacyTrialModal(false)}
              daysRemaining={legacyTrialDaysRemaining}
              trialEnds={legacyTrialEnds}
            />
          )}
          </CartProvider>
        </AudioPlayerProvider>
      </Router>
    </AuthModalProvider>
    </QueryClientProvider>
    </ErrorBoundary>
  )
}

export default App
