import './App.css'
import { useState, useEffect } from 'react';
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

function GlobalAuthModal() {
  const { open, closeAuth, defaultTab, afterLoginAction, setAfterLoginAction } = useAuthModal();
  const { isAuthenticated } = useUser();

  useEffect(() => {
    if (isAuthenticated && afterLoginAction?.fn) {
      const callback = afterLoginAction.fn;
      // Clear action and close auth modal FIRST to avoid loops,
      // then immediately fire the callback (e.g. open payment modal).
      // This ensures a single seamless transition with no flicker.
      setAfterLoginAction(null);
      closeAuth();
      callback();
    }
  }, [isAuthenticated, afterLoginAction, setAfterLoginAction, closeAuth]);

  return (
    <AuthModal isOpen={open} onClose={closeAuth} defaultTab={defaultTab} />
  );
}

function App() {
  // Show splash only once per session unless explicitly reset (e.g. Settings → Landing Screen)
  const alreadyShown = sessionStorage.getItem('eeriecast_splash_shown') === '1';
  const [splashDone, setSplashDone] = useState(alreadyShown);

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
          </CartProvider>
        </AudioPlayerProvider>
      </Router>
    </AuthModalProvider>
  )
}

export default App
