import React, { createContext, useContext, useMemo, useState } from 'react';
import PropTypes from 'prop-types';

const AuthModalContext = createContext();

export function AuthModalProvider({ children }) {
  const [open, setOpen] = useState(false);
  const [defaultTab, setDefaultTab] = useState('login');
  const [afterLoginAction, setAfterLoginAction] = useState(null);
  const [subtitle, setSubtitle] = useState(null);

  const openAuth = (tab = 'login', onComplete = null, contextSubtitle = null) => {
    setDefaultTab(tab || 'login');
    setAfterLoginAction(onComplete ? { fn: onComplete } : null);
    setSubtitle(contextSubtitle);
    setOpen(true);
  };
  const closeAuth = () => {
    setOpen(false);
    setAfterLoginAction(null);
    setSubtitle(null);
  };

  const value = useMemo(() => ({
    open,
    defaultTab,
    afterLoginAction,
    subtitle,
    openAuth,
    closeAuth,
    setAfterLoginAction
  }), [open, defaultTab, afterLoginAction, subtitle]);

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

