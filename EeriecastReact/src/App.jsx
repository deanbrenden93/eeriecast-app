import './App.css'
import { BrowserRouter as Router } from 'react-router-dom';
import Pages from "@/pages/index.jsx"
import { Toaster } from "@/components/ui/toaster"
import { AudioPlayerProvider } from "@/context/AudioPlayerContext"
import { AuthModalProvider, useAuthModal } from '@/context/AuthModalContext.jsx';
import AuthModal from '@/components/auth/AuthModal.jsx';

function GlobalAuthModal() {
  const { open, closeAuth, defaultTab } = useAuthModal();
  return (
    <AuthModal isOpen={open} onClose={closeAuth} defaultTab={defaultTab} />
  );
}

function App() {
  return (
    <AuthModalProvider>
      <Router>
        <AudioPlayerProvider>
          <Pages />
          <Toaster />
          <GlobalAuthModal />
        </AudioPlayerProvider>
      </Router>
    </AuthModalProvider>
  )
}

export default App
