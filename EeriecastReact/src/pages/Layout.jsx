/* eslint-disable react/prop-types */
import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Search, Bell, User, Menu, X, Home, Library, Compass, Settings } from "lucide-react";
import PropTypes from 'prop-types';
import SearchModal from "../components/search/SearchModal";
import UserMenu from "../components/layout/UserMenu";
import AuthModal from '@/components/auth/AuthModal.jsx';
import { useUser } from '@/context/UserContext.jsx';
import { cn } from "@/lib/utils";
import logo from '@/assets/logo.png';
import { AnimatePresence, motion } from "framer-motion";

// Bottom nav menu items
const menuItems = [
  { id: 'home', Icon: Home, label: 'Home', page: 'home' },
  { id: 'library', Icon: Library, label: 'Library', page: 'library' },
  { id: 'browse', Icon: Compass, label: 'Browse', page: 'browse' },
  { id: 'settings', Icon: Settings, label: 'Settings', page: 'settings' }
];

const PAGE_ROUTE_MAP = {
  home: 'Podcasts',
  library: 'Library',
  browse: 'Discover',
  settings: 'Settings',
};

function BottomNav({ currentPageName }) {
  return (
    <nav
      className="layout-bottom-nav hidden max-[1000px]:flex fixed bottom-0 left-0 right-0 z-40 bg-[#08080e]/80 backdrop-blur-xl border-t border-white/[0.04] overflow-x-hidden"
      role="navigation"
      aria-label="Bottom Navigation"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="flex w-full max-w-full justify-around items-stretch px-1 py-1.5">
        {menuItems.map(({ id, Icon, label, page }) => {
          const routeName = PAGE_ROUTE_MAP[page] || 'Home';
          const to = createPageUrl(routeName);
          const active = currentPageName === routeName;
          return (
            <li key={id} className="flex-1 min-w-0">
              <Link
                to={to}
                className="flex flex-col items-center justify-center gap-0.5 py-2 rounded-xl transition-all duration-300 group"
                aria-current={active ? 'page' : undefined}
              >
                <div className={`relative p-1.5 rounded-xl transition-all duration-300 ${active ? 'bg-white/[0.08]' : 'group-hover:bg-white/[0.04]'}`}>
                  <Icon className={`w-[18px] h-[18px] transition-all duration-300 ${active ? 'text-white' : 'text-zinc-500 group-hover:text-zinc-300'}`} strokeWidth={active ? 2.2 : 1.8} />
                </div>
                <span className={`text-[10px] leading-none transition-all duration-300 ${active ? 'text-white font-semibold' : 'text-zinc-500 font-medium group-hover:text-zinc-400'}`}>
                  {label}
                </span>
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

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') setIsMobileMenuOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Full-screen pages without standard header
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
      </div>
    );
  }

  const handleSearchClick = () => {
    setIsSearchModalOpen(true);
  };

  const navLinks = [
    { name: 'Home', route: 'Podcasts' },
    { name: 'Podcasts', route: 'Discover' },
    { name: 'Audiobooks', route: 'Audiobooks' },
    { name: 'Library', route: 'Library' },
  ];

  const NavLinks = ({ onClick }) => (
    <>
      {navLinks.map(({ name, route }) => {
        const active = currentPageName === route;
        return (
          <Link
            key={route}
            to={createPageUrl(route)}
            onClick={onClick}
            className={`relative text-[13px] font-medium tracking-wide transition-all duration-300 py-1 ${
              active
                ? "text-white"
                : "text-zinc-500 hover:text-zinc-200"
            }`}
          >
            {name}
            {active && (
              <span className="absolute -bottom-[13px] left-1/2 -translate-x-1/2 w-4 h-[2px] rounded-full bg-white" />
            )}
          </Link>
        );
      })}
    </>
  );

  return (
    <div className="min-h-screen bg-eeriecast-surface text-white w-full">
      <style>{`
        html, body {
          margin: 0 !important;
          padding: 0 !important;
          width: 100%;
          height: 100%;
        }
      `}</style>

      {/* ─── Top bar ─── */}
      <header className="layout-header fixed top-0 left-0 right-0 z-50 isolate bg-[#08080e]/70 backdrop-blur-xl border-b border-white/[0.04]">
        <div className="w-full px-4 md:px-6 py-3">
          <div className="flex items-center justify-between">
            {/* Left: Mobile menu + Logo */}
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                className="md:hidden p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.04] transition-all duration-300"
                aria-label="Open menu"
                onClick={() => setIsMobileMenuOpen(true)}
              >
                <Menu className="w-5 h-5" />
              </button>
              <Link to={createPageUrl("Home")} className="flex items-center">
                <img
                  src={logo}
                  alt="EERIECAST"
                  className="h-5 md:h-6 filter invert opacity-90"
                />
              </Link>
            </div>

            {/* Center: Navigation (desktop) */}
            <nav className="hidden md:flex items-center gap-7">
              <NavLinks />
            </nav>

            {/* Right: Actions */}
            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={handleSearchClick}
                className="p-2 rounded-lg text-zinc-500 hover:text-white hover:bg-white/[0.04] transition-all duration-300"
                aria-label="Search"
              >
                <Search className="w-5 h-5" />
              </button>

              <div className="relative" ref={notifRef}>
                <button
                  type="button"
                  onClick={() => {
                    if (!isAuthenticated) return;
                    setIsNotifOpen((open) => !open);
                  }}
                  className={`relative p-2 rounded-lg transition-all duration-300 ${isAuthenticated ? 'text-zinc-500 hover:text-white hover:bg-white/[0.04]' : 'text-zinc-700 cursor-default'}`}
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
                <AnimatePresence>
                  {isNotifOpen && <NotificationsPopover onClose={() => setIsNotifOpen(false)} />}
                </AnimatePresence>
              </div>

              <div className="relative" ref={userMenuRef}>
                <button
                  type="button"
                  onClick={() => {
                    if (isAuthenticated) {
                      setIsUserMenuOpen(prev => !prev);
                    } else {
                      setIsAuthModalOpen(true);
                    }
                  }}
                  className="w-8 h-8 rounded-full bg-gradient-to-br from-zinc-700 to-zinc-800 border border-white/[0.06] flex items-center justify-center hover:border-white/[0.12] transition-all duration-300"
                >
                  <User className="w-4 h-4 text-zinc-300" />
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

      {/* ─── Mobile slide-out menu ─── */}
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
            <motion.div
              className="absolute inset-0 bg-[#08080e]/95 backdrop-blur-lg"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            />
            <motion.div
              className="relative flex h-full w-full flex-col"
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -20, opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 h-14 border-b border-white/[0.04]">
                <Link
                  to={createPageUrl('Home')}
                  className="flex items-center"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <img src={logo} alt="EERIECAST" className="h-5 filter invert opacity-90" />
                </Link>
                <button
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.04] transition-all duration-300"
                  aria-label="Close menu"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Nav links */}
              <nav className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-0.5">
                {navLinks.map(({ name, route }, i) => {
                  const active = currentPageName === route;
                  return (
                    <motion.div
                      key={route}
                      initial={{ opacity: 0, x: -16 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.04 + i * 0.05, duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
                    >
                      <Link
                        to={createPageUrl(route)}
                        onClick={() => setIsMobileMenuOpen(false)}
                        className={`flex items-center gap-3 px-3 py-3 rounded-xl text-[15px] font-medium transition-all duration-300 ${
                          active
                            ? 'text-white bg-white/[0.06]'
                            : 'text-zinc-400 hover:text-white hover:bg-white/[0.03]'
                        }`}
                      >
                        {name}
                      </Link>
                    </motion.div>
                  );
                })}
              </nav>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className={cn(
        "relative w-full pt-16 pb-16 max-[1000px]:pb-20",
        hasPlayer && "pb-32 max-[1000px]:pb-48"
      )}>
        {children}
      </main>

      <BottomNav currentPageName={currentPageName} />

      <SearchModal
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
      />
      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
    </div>
  );
}

/* ─── Notifications popover ─── */

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
      className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl bg-[#12121a] text-white shadow-2xl shadow-black/50 ring-1 ring-white/[0.06] overflow-hidden z-50"
      initial={{ opacity: 0, y: -6, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -6, scale: 0.97 }}
      transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
    >
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.04]">
        <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">Notifications</h3>
        <button onClick={onClose} className="text-zinc-600 hover:text-zinc-300 text-xs transition-colors">Close</button>
      </div>
      <div className="max-h-80 overflow-auto">
        {notificationsLoading ? (
          <div className="px-4 py-8 text-center text-zinc-600 text-sm">Loading...</div>
        ) : !notifications || notifications.length === 0 ? (
          <div className="px-4 py-8 text-center text-zinc-600 text-sm">No notifications</div>
        ) : (
          <ul className="divide-y divide-white/[0.03]">
            {notifications.map((n) => (
              <li
                key={n.id}
                className={`px-4 py-3 hover:bg-white/[0.03] cursor-pointer transition-colors ${n.is_read ? 'opacity-60' : ''}`}
                onClick={() => markNotificationRead(n.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); markNotificationRead(n.id); } }}
                aria-label={`Notification: ${n?.message || ''}`}
              >
                <div className="flex items-start gap-3">
                  <span className={`mt-1.5 inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 ${n.is_read ? 'bg-zinc-700' : 'bg-red-500'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm leading-snug break-words text-zinc-300">
                      {n.message || 'You have a new notification.'}
                    </p>
                    {n.created_at && (
                      <p className="text-[11px] text-zinc-600 mt-1">
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
