import './App.css'
import { useState, useEffect, useCallback } from 'react';
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
import OnboardingFlow, { isOnboardingDone } from '@/components/OnboardingFlow.jsx';
import LegacyTrialReminderModal from '@/components/auth/LegacyTrialReminderModal.jsx';
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
  const {
    user,
    isAuthenticated,
    loading: userLoading,
    isOnLegacyTrial,
    legacyTrialEnds,
    legacyTrialDaysRemaining,
    legacyPlanType
  } = useUser();

  useEffect(() => {
    // Check if imported user needs onboarding
    if (isAuthenticated && user?.is_imported_from_memberful && !user?.onboarding_completed && !isOnboardingDone()) {
      setOnboardingVariant(user.is_premium ? 'premium' : 'free');
    }
  }, [isAuthenticated, user, userLoading]);

  useEffect(() => {
    const handler = (e) => {
      const variant = e?.detail?.variant;
      if (variant === 'free' || variant === 'premium' || variant === 'premium-existing') {
        setOnboardingVariant(variant);
      }
    };
    window.addEventListener('eeriecast-start-onboarding', handler);
    return () => window.removeEventListener('eeriecast-start-onboarding', handler);
  }, []);

  const handleOnboardingComplete = useCallback(() => {
    setOnboardingVariant(null);
  }, []);

  // Legacy trial reminder modal
  const [showLegacyTrialModal, setShowLegacyTrialModal] = useState(false);
  const [hasShownFirstLoginModal, setHasShownFirstLoginModal] = useState(false);

  useEffect(() => {
    // Show modal for legacy trial users at strategic times
    if (!isAuthenticated || !isOnLegacyTrial || userLoading) return;

    const modalShownKey = `legacy_trial_modal_shown_${user?.id}`;
    const firstLoginShown = localStorage.getItem(`${modalShownKey}_first_login`);

    // Show on first login after import
    if (!firstLoginShown && !hasShownFirstLoginModal) {
      const timer = setTimeout(() => {
        setShowLegacyTrialModal(true);
        setHasShownFirstLoginModal(true);
        localStorage.setItem(`${modalShownKey}_first_login`, 'true');
      }, 2000); // Delay to let page load
      return () => clearTimeout(timer);
    }

    // Show reminders based on days remaining
    const reminderShownToday = sessionStorage.getItem(`${modalShownKey}_${new Date().toDateString()}`);
    if (!reminderShownToday) {
      if (legacyTrialDaysRemaining <= 1 ||
          legacyTrialDaysRemaining === 3 ||
          legacyTrialDaysRemaining === 7 ||
          legacyTrialDaysRemaining === 30) {
        const timer = setTimeout(() => {
          setShowLegacyTrialModal(true);
          sessionStorage.setItem(`${modalShownKey}_${new Date().toDateString()}`, 'true');
        }, 5000);
        return () => clearTimeout(timer);
      }
    }
  }, [isAuthenticated, isOnLegacyTrial, legacyTrialDaysRemaining, user?.id, userLoading, hasShownFirstLoginModal]);

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
          {/* Legacy trial reminder modal */}
          {isOnLegacyTrial && (
            <LegacyTrialReminderModal
              isOpen={showLegacyTrialModal}
              onClose={() => setShowLegacyTrialModal(false)}
              daysRemaining={legacyTrialDaysRemaining}
              trialEnds={legacyTrialEnds}
              planType={legacyPlanType}
              isFirstLogin={!hasShownFirstLoginModal && !localStorage.getItem(`legacy_trial_modal_shown_${user?.id}_first_login`)}
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
