import './App.css'
import { useState, useEffect } from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import Pages from "@/pages/index.jsx"
import { Toaster } from "@/components/ui/toaster"
import { AudioPlayerProvider } from "@/context/AudioPlayerContext"
import { AuthModalProvider, useAuthModal } from '@/context/AuthModalContext.jsx';
import { CartProvider } from '@/context/CartContext.jsx';
import CartDrawer from '@/components/shop/CartDrawer.jsx';
import AuthModal from '@/components/auth/AuthModal.jsx';
import SplashScreen from '@/components/SplashScreen.jsx';

function GlobalAuthModal() {
  const { open, closeAuth, defaultTab } = useAuthModal();
  return (
    <AuthModal isOpen={open} onClose={closeAuth} defaultTab={defaultTab} />
  );
}

function App() {
  const [splashDone, setSplashDone] = useState(false);

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
                onComplete={() => setSplashDone(true)}
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
