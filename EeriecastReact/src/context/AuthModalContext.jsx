import React, { createContext, useContext, useMemo, useState } from 'react';
import PropTypes from 'prop-types';

const AuthModalContext = createContext();

export function AuthModalProvider({ children }) {
  const [open, setOpen] = useState(false);
  const [defaultTab, setDefaultTab] = useState('login');
  const [afterLoginAction, setAfterLoginAction] = useState(null);

  const openAuth = (tab = 'login', onComplete = null) => {
    setDefaultTab(tab || 'login');
    setAfterLoginAction(onComplete ? { fn: onComplete } : null);
    setOpen(true);
  };
  const closeAuth = () => {
    setOpen(false);
    setAfterLoginAction(null);
  };

  const value = useMemo(() => ({
    open,
    defaultTab,
    afterLoginAction,
    openAuth,
    closeAuth,
    setAfterLoginAction
  }), [open, defaultTab, afterLoginAction]);

  return (
    <AuthModalContext.Provider value={value}>
      {children}
    </AuthModalContext.Provider>
  );
}

AuthModalProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export function useAuthModal() {
  const ctx = useContext(AuthModalContext);
  if (!ctx) throw new Error('useAuthModal must be used within an AuthModalProvider');
  return ctx;
}

