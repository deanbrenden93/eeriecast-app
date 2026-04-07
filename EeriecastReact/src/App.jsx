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
import SplashScreen from '@/components/SplashScreen.jsx';
import OnboardingFlow, { isOnboardingDone } from '@/components/OnboardingFlow.jsx';
import { djangoClient } from '@/api/djangoClient.js';

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
  const { user, isAuthenticated, loading: userLoading } = useUser();

  useEffect(() => {
    // Check if imported user needs onboarding
    if (isAuthenticated && user?.is_imported_from_memberful && !user?.onboarding_completed && !isOnboardingDone()) {
      setOnboardingVariant(user.is_premium ? 'premium' : 'free');
    }
  }, [isAuthenticated, user, userLoading]);

  useEffect(() => {
    const handler = (e) => {
      const variant = e?.detail?.variant;
      if (variant === 'free' || variant === 'premium') {
        setOnboardingVariant(variant);
      }
    };
    window.addEventListener('eeriecast-start-onboarding', handler);
    return () => window.removeEventListener('eeriecast-start-onboarding', handler);
  }, []);

  const handleOnboardingComplete = useCallback(() => {
    setOnboardingVariant(null);
  }, []);

  return (
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
          </CartProvider>
        </AudioPlayerProvider>
      </Router>
    </AuthModalProvider>
  )
}

export default App
