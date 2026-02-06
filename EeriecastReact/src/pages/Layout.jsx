/* eslint-disable react/prop-types */
import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Search, Bell, User, Menu, X } from "lucide-react";
import PropTypes from 'prop-types';
import SearchModal from "../components/search/SearchModal";
import UserMenu from "../components/layout/UserMenu";
import AuthModal from '@/components/auth/AuthModal.jsx';
import { useUser } from '@/context/UserContext.jsx';
import { cn } from "@/lib/utils";
import logo from '@/assets/logo.png';
import { AnimatePresence, motion } from "framer-motion";

// Bottom nav menu items configured here
const menuItems = [
  { id: 'home', icon: '🏠', label: 'Home', page: 'home' },
  { id: 'library', icon: '📚', label: 'Library', page: 'library' },
  { id: 'browse', icon: '🔮', label: 'Browse', page: 'browse' },
  { id: 'settings', icon: '⚙️', label: 'Settings', page: 'settings' }
];

// Map config.page -> app route name used by createPageUrl and currentPageName
const PAGE_ROUTE_MAP = {
  home: 'Podcasts',
  library: 'Library',
  browse: 'Discover',
  settings: 'Settings',
};

function BottomNav({ currentPageName }) {
  return (
    <nav
      className="hidden max-[1000px]:flex fixed bottom-0 left-0 right-0 z-40 bg-gradient-to-b from-[#0d1320]/95 to-[#05070d]/95 backdrop-blur-md border-t border-white/10 overflow-x-hidden"
      role="navigation"
      aria-label="Bottom Navigation"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="flex w-full max-w-full justify-between items-stretch px-2 py-3">
        {menuItems.map(({ id, icon, label, page }) => {
          const routeName = PAGE_ROUTE_MAP[page] || 'Home';
          const to = createPageUrl(routeName);
          const active = currentPageName === routeName;
          return (
            <li key={id} className="flex-1 min-w-0">
              <Link
                to={to}
                className={`flex flex-col items-center justify-center gap-1.5 py-2 rounded-md transition-colors ${active ? 'text-white' : 'text-gray-300 hover:text-white'}`}
                aria-current={active ? 'page' : undefined}
              >
                <span className={`text-2xl leading-none ${active ? 'opacity-100' : 'opacity-90'}`}>{icon}</span>
                <span className={`text-[13px] leading-none whitespace-nowrap ${active ? 'font-semibold' : 'font-medium text-gray-300'}`}>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export default function Layout({ children, currentPageName, hasPlayer }) {
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const userMenuRef = useRef(null);
  const notifRef = useRef(null);
  const { isAuthenticated, unreadNotificationCount } = useUser();
  const prevAuthRef = useRef(isAuthenticated);

  useEffect(() => {
    if (!prevAuthRef.current && isAuthenticated) {
      setIsAuthModalOpen(false);
      setIsUserMenuOpen(true);
    }
    prevAuthRef.current = isAuthenticated;
  }, [isAuthenticated]);

  useEffect(() => {
    function handleClickOutside(event) {
      const target = event.target;
      if (userMenuRef.current && !userMenuRef.current.contains(target)) {
        setIsUserMenuOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(target)) {
        setIsNotifOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [userMenuRef]);

  // Close mobile menu on route changes or ESC
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') setIsMobileMenuOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // The new homepage design and Premium signup page are full-screen experiences and do not use the standard header.
  if (currentPageName === "Home" || currentPageName === "Premium") {
    return (
      <div className="m-0 p-0 w-full h-full">
        <style>{`
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            width: 100%;
            height: 100%;
          }
        `}</style>
        <main className="pb-0">{children}</main>
        {/* BottomNav intentionally hidden on Home and Premium */}
      </div>
    );
  }

  const handleSearchClick = () => {
    setIsSearchModalOpen(true);
  };

  const NavLinks = ({ onClick }) => (
    <>
      <Link
        to={createPageUrl("Podcasts")}
        onClick={onClick}
        className={`text-sm font-medium transition-colors hover:text-red-500 ${
          currentPageName === "Podcasts" ? "text-red-500 border-b-2 border-red-500 pb-1" : "text-gray-300"
        }`}
      >
        Home
      </Link>
      <Link
        to={createPageUrl("Discover")}
        onClick={onClick}
        className={`text-sm font-medium transition-colors hover:text-red-500 ${
          currentPageName === "Discover" ? "text-red-500 border-b-2 border-red-500 pb-1" : "text-gray-300"
        }`}
      >
        Podcasts
      </Link>
      <Link
        to={createPageUrl("Audiobooks")}
        onClick={onClick}
        className={`text-sm font-medium transition-colors hover:text-red-500 ${
          currentPageName === "Audiobooks" ? "text-red-500 border-b-2 border-red-500 pb-1" : "text-gray-300"
        }`}
      >
        Audiobooks
      </Link>
      <Link
        to={createPageUrl("Library")}
        onClick={onClick}
        className={`text-sm font-medium transition-colors hover:text-red-500 ${
          currentPageName === "Library" ? "text-red-500 border-b-2 border-red-500 pb-1" : "text-gray-300"
        }`}
      >
        Library
      </Link>
    </>
  );

  return (
    <div className="min-h-screen bg-black text-white w-full">
      <style>{`
        html, body {
          margin: 0 !important;
          padding: 0 !important;
          width: 100%;
          height: 100%;
        }
      `}</style>

      <header className="fixed top-0 left-0 right-0 z-50 bg-black/90 backdrop-blur-md border-b border-gray-800">
        <div className="w-full px-5 py-4">
          <div className="flex items-center justify-between">
            {/* Left: Mobile menu button + Logo */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="md:hidden p-2 text-gray-300 hover:text-white transition-colors"
                aria-label="Open menu"
                onClick={() => setIsMobileMenuOpen(true)}
              >
                <Menu className="w-6 h-6" />
              </button>
              <Link to={createPageUrl("Home")} className="flex items-center">
                <img
                  src={logo}
                  alt="EERIECAST"
                  className="h-6 md:h-8 filter invert"
                />
              </Link>
            </div>

            {/* Navigation (desktop only) */}
            <nav className="hidden md:flex items-center space-x-8">
              <NavLinks />
            </nav>

            {/* Actions */}
            <div className="flex items-center space-x-4">
              <button 
                onClick={handleSearchClick}
                className="p-2 text-gray-400 hover:text-white transition-colors"
              >
                <Search className="w-5 h-5" />
              </button>
              <div className="relative" ref={notifRef}>
                <button
                  onClick={() => {
                    if (!isAuthenticated) return;
                    setIsNotifOpen((open) => !open);
                  }}
                  className={`relative p-2 transition-colors ${isAuthenticated ? 'text-gray-400 hover:text-white' : 'text-gray-600 cursor-default'}`}
                  aria-haspopup="true"
                  aria-expanded={isNotifOpen}
                  aria-label="Notifications"
                >
                  <Bell className="w-5 h-5" />
                  {isAuthenticated && unreadNotificationCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-1 rounded-full bg-red-500 text-white text-[10px] leading-none flex items-center justify-center border border-black/50 shadow-sm">
                      {unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}
                    </span>
                  )}
                </button>
                {/* Notifications popover with enter/exit animation */}
                <AnimatePresence>
                  {isNotifOpen && <NotificationsPopover onClose={() => setIsNotifOpen(false)} />}
                </AnimatePresence>
              </div>
              <div className="relative" ref={userMenuRef}>
                <button 
                  onClick={() => {
                    if (isAuthenticated) {
                      setIsUserMenuOpen(prev => !prev);
                    } else {
                      setIsAuthModalOpen(true);
                    }
                  }}
                  className="relative w-8 h-8 bg-red-600 rounded-full flex items-center justify-center"
                >
                  <User className="w-4 h-4 text-white" />
                </button>
                {isAuthenticated && (
                  <AnimatePresence>
                    {isUserMenuOpen && <UserMenu isOpen={isUserMenuOpen} onClose={() => setIsUserMenuOpen(false)} />}
                  </AnimatePresence>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile overlay menu with enter/exit transition */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            className="md:hidden fixed inset-0 z-[4000]"
            role="dialog"
            aria-modal="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            {/* Backdrop */}
            <motion.div
              className="absolute inset-0 bg-[#0b0b0b]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            />
            <motion.div
              className="relative flex h-full w-full flex-col"
              initial={{ x: -30, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -30, opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
                <Link
                  to={createPageUrl('Home')}
                  className="flex items-center"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <img
                    src={logo}
                    alt="EERIECAST"
                    className="h-6 filter invert"
                  />
                </Link>
                <button
                  className="p-2 text-gray-300 hover:text-white"
                  aria-label="Close menu"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Nav */}
              <nav className="flex-1 overflow-y-auto px-5 py-3 flex flex-col gap-1">
                {[
                  { name: 'Home', route: 'Podcasts' },
                  { name: 'Podcasts', route: 'Discover' },
                  { name: 'Audiobooks', route: 'Audiobooks' },
                  { name: 'Library', route: 'Library' },
                ].map(({ name, route }, i) => (
                  <motion.div
                    key={route}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.05 + i * 0.06, duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
                  >
                    <Link
                      to={createPageUrl(route)}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={`block px-3 py-3 rounded-md text-base font-medium ${
                        currentPageName === route
                          ? 'text-red-500 bg-white/5'
                          : 'text-gray-200 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      {name}
                    </Link>
                  </motion.div>
                ))}
              </nav>

              {/* Footer spacer */}
              <div className="h-4" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className={cn(
        "relative w-full pt-[72px] pb-16 max-[1000px]:pb-20",
        hasPlayer && "pb-32 max-[1000px]:pb-48"
      )}>
        {children}
      </main>

      <BottomNav currentPageName={currentPageName} />

      {/* Search Modal */}
      <SearchModal 
        isOpen={isSearchModalOpen} 
        onClose={() => setIsSearchModalOpen(false)} 
      />
      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
    </div>
  );
}

// Lightweight popover component anchored to bell — now animated with framer-motion
function NotificationsPopover({ onClose }) {
  const { notifications, notificationsLoading, refreshNotifications, isAuthenticated, markNotificationRead } = useUser();
  const initializedRef = useRef(false);

  useEffect(() => {
    if (isAuthenticated) {
      if (!initializedRef.current) {
        initializedRef.current = true;
      }
      refreshNotifications().catch(() => {});
    }
  }, [isAuthenticated, refreshNotifications]);

  return (
    <motion.div
      className="absolute right-0 mt-2 w-80 sm:w-96 rounded-md bg-[#181d24] text-white shadow-xl shadow-black/40 ring-1 ring-black/60 overflow-hidden z-50"
      initial={{ opacity: 0, y: -8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.96 }}
      transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
    >
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/5">
        <h3 className="text-sm font-semibold">Notifications</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-white text-xs">Close</button>
      </div>
      <div className="max-h-80 overflow-auto">
        {notificationsLoading ? (
          <div className="px-4 py-6 text-center text-gray-400">Loading…</div>
        ) : !notifications || notifications.length === 0 ? (
          <div className="px-4 py-6 text-center text-gray-400">No notifications</div>
        ) : (
          <ul className="divide-y divide-white/5">
            {notifications.map((n) => (
              <li
                key={n.id}
                className={`px-4 py-3 hover:bg-white/5 cursor-pointer ${n.is_read ? 'opacity-80' : ''}`}
                onClick={() => markNotificationRead(n.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); markNotificationRead(n.id); } }}
                aria-label={`Notification: ${n?.message || ''}`}
              >
                <div className="flex items-start gap-3">
                  <span className={`mt-1 inline-block w-2 h-2 rounded-full ${n.is_read ? 'bg-gray-600' : 'bg-red-500'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm leading-snug break-words">
                      {n.message || 'You have a new notification.'}
                    </p>
                    {n.created_at && (
                      <p className="text-[11px] text-gray-400 mt-1">
                        {new Date(n.created_at).toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </motion.div>
  );
}

NotificationsPopover.propTypes = {
  onClose: PropTypes.func,
};

Layout.propTypes = {
  children: PropTypes.node,
  currentPageName: PropTypes.string,
  hasPlayer: PropTypes.bool,
};
