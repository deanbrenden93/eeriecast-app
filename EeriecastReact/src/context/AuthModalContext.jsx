import React, { createContext, useContext, useMemo, useState } from 'react';
import PropTypes from 'prop-types';

const AuthModalContext = createContext();

export function AuthModalProvider({ children }) {
  const [open, setOpen] = useState(false);
  const [defaultTab, setDefaultTab] = useState('login');

  const openAuth = (tab = 'login') => {
    setDefaultTab(tab || 'login');
    setOpen(true);
  };
  const closeAuth = () => setOpen(false);

  const value = useMemo(() => ({ open, defaultTab, openAuth, closeAuth }), [open, defaultTab]);

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

