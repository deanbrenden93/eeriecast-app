/* eslint-disable react/prop-types */
import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Search, Bell, User, Menu, X, Home, Library, Headphones, BookOpen, Settings, Crown, ShoppingBag, CheckCheck, Trash2 } from "lucide-react";
import { useCart } from '@/context/CartContext';
import PropTypes from 'prop-types';
import SearchModal from "../components/search/SearchModal";
import UserMenu from "../components/layout/UserMenu";
import AuthModal from '@/components/auth/AuthModal.jsx';
import LegacyTrialBanner from '@/components/auth/LegacyTrialBanner.jsx';
import { useUser } from '@/context/UserContext.jsx';
import { toast } from '@/components/ui/use-toast';
import { cn } from "@/lib/utils";
import { FeatureGate } from '@/lib/featureFlags';
import logo from '@/assets/logo.png';
import { AnimatePresence, motion } from "framer-motion";

// Bottom nav menu items
const menuItems = [
  { id: 'home', Icon: Home, label: 'Home', page: 'home' },
  { id: 'podcasts', Icon: Headphones, label: 'Podcasts', page: 'podcasts' },
  { id: 'books', Icon: BookOpen, label: 'Books', page: 'books' },
  { id: 'library', Icon: Library, label: 'Library', page: 'library' },
  { id: 'shop', Icon: ShoppingBag, label: 'Shop', page: 'shop' }
];

const PAGE_ROUTE_MAP = {
  home: 'Podcasts',
  podcasts: 'Discover',
  books: 'Audiobooks',
  library: 'Library',
  shop: 'Shop',
};

function BottomNav({ currentPageName }) {
  const { cartCount } = useCart();
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
          const isShop = id === 'shop';
          return (
            <li key={id} className="flex-1 min-w-0">
              <Link
                to={to}
                className="flex flex-col items-center justify-center gap-0.5 py-2 rounded-xl transition-all duration-300 group"
                aria-current={active ? 'page' : undefined}
              >
                <div className={`relative p-1.5 rounded-xl transition-all duration-300 ${active ? 'bg-white/[0.08]' : 'group-hover:bg-white/[0.04]'}`}>
                  <Icon className={`w-[18px] h-[18px] transition-all duration-300 ${active ? 'text-white' : 'text-zinc-500 group-hover:text-zinc-300'}`} strokeWidth={active ? 2.2 : 1.8} />
                  {isShop && cartCount > 0 && (
                    <span className="absolute -top-1 -right-1.5 min-w-[15px] h-[15px] px-[3px] rounded-full bg-white text-black text-[9px] font-bold leading-none flex items-center justify-center shadow-sm">
                      {cartCount > 99 ? '99+' : cartCount}
                    </span>
                  )}
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
  const {
    isAuthenticated,
    isPremium,
    unreadNotificationCount,
    isOnLegacyTrial,
    legacyTrialEnds,
    legacyTrialDaysRemaining,
    hasPaymentMethod
  } = useUser();
  const { cartCount } = useCart();
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
    { name: 'Books', route: 'Audiobooks' },
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
              <Link to={createPageUrl("Podcasts")} className="flex items-center">
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
              <Link
                to={createPageUrl('Shop')}
                className={`relative flex items-center gap-1.5 text-[13px] font-medium tracking-wide transition-all duration-300 py-1 ${
                  currentPageName === 'Shop' ? 'text-white' : 'text-zinc-500 hover:text-zinc-200'
                }`}
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                Shop
                {cartCount > 0 && (
                  <span className="absolute -top-1.5 -right-3 min-w-[15px] h-[15px] px-[3px] rounded-full bg-white text-black text-[9px] font-bold leading-none flex items-center justify-center">
                    {cartCount > 99 ? '99+' : cartCount}
                  </span>
                )}
                {currentPageName === 'Shop' && (
                  <span className="absolute -bottom-[13px] left-1/2 -translate-x-1/2 w-4 h-[2px] rounded-full bg-white" />
                )}
              </Link>
              {!isPremium && (
                <Link
                  to={createPageUrl('Premium')}
                  className="flex items-center gap-1.5 ml-1 px-3 py-1 rounded-full bg-gradient-to-r from-amber-500/10 to-yellow-500/[0.06] border border-amber-400/15 text-amber-400/90 text-[12px] font-semibold tracking-wide hover:from-amber-500/20 hover:to-yellow-500/10 hover:border-amber-400/25 hover:text-amber-300 transition-all duration-300"
                >
                  <Crown className="w-3 h-3" />
                  Premium
                </Link>
              )}
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

              {/* Guests don't have a user menu, so expose Settings directly
                  on large screens — otherwise they have no entry point. */}
              {!isAuthenticated && (
                <Link
                  to={createPageUrl('Settings')}
                  className="hidden md:inline-flex p-2 rounded-lg text-zinc-500 hover:text-white hover:bg-white/[0.04] transition-all duration-300"
                  aria-label="Settings"
                  title="Settings"
                >
                  <Settings className="w-5 h-5" />
                </Link>
              )}

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
                  to={createPageUrl('Podcasts')}
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

                <div className="my-2 h-px bg-white/[0.04]" />

                {/* Shop link */}
                <motion.div
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.04 + navLinks.length * 0.05, duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
                >
                  <Link
                    to={createPageUrl('Shop')}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-3 py-3 rounded-xl text-[15px] font-medium transition-all duration-300 ${
                      currentPageName === 'Shop'
                        ? 'text-white bg-white/[0.06]'
                        : 'text-zinc-400 hover:text-white hover:bg-white/[0.03]'
                    }`}
                  >
                    <span className="relative">
                      <ShoppingBag className="w-4 h-4" />
                      {cartCount > 0 && (
                        <span className="absolute -top-1.5 -right-2 min-w-[14px] h-[14px] px-[2px] rounded-full bg-white text-black text-[9px] font-bold leading-none flex items-center justify-center">
                          {cartCount > 99 ? '99+' : cartCount}
                        </span>
                      )}
                    </span>
                    Shop
                  </Link>
                </motion.div>

                {/* Profile link */}
                <motion.div
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.04 + (navLinks.length + 1) * 0.05, duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
                >
                  <Link
                    to={createPageUrl('Profile')}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-3 py-3 rounded-xl text-[15px] font-medium transition-all duration-300 ${
                      currentPageName === 'Profile'
                        ? 'text-white bg-white/[0.06]'
                        : 'text-zinc-400 hover:text-white hover:bg-white/[0.03]'
                    }`}
                  >
                    <User className="w-4 h-4" />
                    Profile
                  </Link>
                </motion.div>

                {/* Settings link */}
                <motion.div
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.04 + (navLinks.length + 2) * 0.05, duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
                >
                  <Link
                    to={createPageUrl('Settings')}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-3 py-3 rounded-xl text-[15px] font-medium transition-all duration-300 ${
                      currentPageName === 'Settings'
                        ? 'text-white bg-white/[0.06]'
                        : 'text-zinc-400 hover:text-white hover:bg-white/[0.03]'
                    }`}
                  >
                    <Settings className="w-4 h-4" />
                    Settings
                  </Link>
                </motion.div>

                {/* Staff indicator — only visible to admin/staff accounts */}
                <FeatureGate flag="staff-indicator">
                  <motion.div
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.04 + (navLinks.length + 3) * 0.05, duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
                  >
                    <div className="flex items-center gap-2 px-3 py-2 mt-1 rounded-lg bg-emerald-500/[0.08] border border-emerald-500/[0.15]">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-[11px] font-semibold text-emerald-400/90 tracking-wide uppercase">Staff Mode</span>
                    </div>
                  </motion.div>
                </FeatureGate>

                {/* Premium CTA for free users */}
                {!isPremium && (
                  <>
                    <div className="my-2 h-px bg-white/[0.04]" />
                    <motion.div
                      initial={{ opacity: 0, x: -16 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.04 + (navLinks.length + 4) * 0.05, duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
                    >
                      <Link
                        to={createPageUrl('Premium')}
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="flex items-center gap-3 px-3 py-3 rounded-xl text-[15px] font-semibold text-amber-400/90 hover:text-amber-300 hover:bg-amber-500/[0.06] transition-all duration-300"
                      >
                        <Crown className="w-4 h-4" />
                        Go Premium
                      </Link>
                    </motion.div>
                  </>
                )}
              </nav>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className={cn(
        "relative w-full pt-16 pb-16 max-[1000px]:pb-20",
        hasPlayer && "pb-32 max-[1000px]:pb-48"
      )}>
        {/* Legacy Trial Banner — full-bleed strip directly below the header */}
        {isOnLegacyTrial && (
          <LegacyTrialBanner
            daysRemaining={legacyTrialDaysRemaining}
            trialEnds={legacyTrialEnds}
            hasPaymentMethod={hasPaymentMethod}
          />
        )}
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
  const {
    notifications,
    notificationsLoading,
    refreshNotifications,
    isAuthenticated,
    markNotificationRead,
    markAllNotificationsRead,
    deleteNotification,
    clearAllNotifications,
  } = useUser();
  // Inline confirm state for Clear All — first tap arms, second
  // confirms. Beats a global modal for what's a low-stakes,
  // low-frequency action and stays inside the popover so no other
  // chrome appears.
  const [clearArmed, setClearArmed] = useState(false);
  useEffect(() => {
    if (!clearArmed) return undefined;
    const t = setTimeout(() => setClearArmed(false), 3500);
    return () => clearTimeout(t);
  }, [clearArmed]);
  const navigate = useNavigate();
  const initializedRef = useRef(false);

  useEffect(() => {
    if (isAuthenticated) {
      if (!initializedRef.current) {
        initializedRef.current = true;
      }
      refreshNotifications().catch(() => {});
    }
  }, [isAuthenticated, refreshNotifications]);

  // Hostnames we consider "us" for the purposes of routing
  // notification URLs. An admin-authored notification might ship an
  // absolute link like ``https://eeriecast.com/Library`` because the
  // admin tool defaults to copying full URLs from the prod site —
  // when that notification lands on a dev build (localhost) or a
  // sibling domain (eerie.fm), we still want it to deep-link inside
  // the SPA via react-router instead of forcing a full page reload
  // out to production.
  //
  // The current window's origin is always treated as internal even
  // if it isn't in this list, so this only needs to enumerate
  // siblings (alternate domains, marketing site, staging hostnames).
  // ``backend.eerie.fm`` is intentionally NOT here — the API host
  // doesn't render the SPA, so links to it really are external.
  const APP_HOSTNAMES = new Set([
    'eeriecast.com',
    'www.eeriecast.com',
    'eerie.fm',
    'www.eerie.fm',
    'app.eerie.fm',
    'app.eeriecast.com',
  ]);

  // Resolve the best deep-link target for a notification.
  //
  // Three flavors, in priority order:
  //
  //   1. `n.url` — admin broadcasts can ship an arbitrary path
  //      (`/Library`) or full URL (`https://eeriecast.com/lore`).
  //      Anything that resolves to "us" (current origin or a known
  //      sibling app hostname) is routed via react-router so the
  //      SPA shell stays mounted and audio playback isn't
  //      interrupted; only genuinely third-party URLs fall through
  //      to a full-page navigation.
  //   2. Episode notifications — link to the show page with the
  //      episode id pinned, so the page can scroll/highlight the
  //      specific episode if supported.
  //   3. No target — the notification just informs and dismisses.
  const resolveDeepLink = (n) => {
    const url = (n?.url || '').trim();
    if (url) {
      if (url.startsWith('/')) {
        return { kind: 'internal', target: url };
      }
      // Try parsing as an absolute URL. If the host matches "us",
      // strip everything but path+search+hash so react-router can
      // route within the SPA instead of bouncing through window.
      try {
        const parsed = new URL(url, window.location.href);
        const isOurOrigin =
          parsed.origin === window.location.origin
          || APP_HOSTNAMES.has(parsed.hostname.toLowerCase());
        if (isOurOrigin) {
          const internalPath = `${parsed.pathname || '/'}${parsed.search || ''}${parsed.hash || ''}`;
          return { kind: 'internal', target: internalPath };
        }
      } catch {
        // Malformed URL — let it fall through to external so the
        // browser can decide what to do (it'll usually surface the
        // error in an obvious way).
      }
      return { kind: 'external', target: url };
    }
    const podId = (n?.podcast && typeof n.podcast === 'object') ? n.podcast.id : n?.podcast;
    const epId = (n?.episode && typeof n.episode === 'object') ? n.episode.id : n?.episode;
    if (!podId) return null;
    const base = `${createPageUrl('Episodes')}?id=${encodeURIComponent(podId)}`;
    return { kind: 'internal', target: epId ? `${base}&ep=${encodeURIComponent(epId)}` : base };
  };

  const handleNotificationClick = (n) => {
    if (!n) return;
    if (n.is_read === false) markNotificationRead(n.id);
    const link = resolveDeepLink(n);
    if (!link) return;
    onClose?.();
    if (link.kind === 'external') {
      // Open same-tab — admin can opt notifications into a new tab
      // by including target=_blank in their UI flow if needed; the
      // common "go check out X on the marketing site" case wants
      // same-tab navigation so back-button returns to the app.
      window.location.assign(link.target);
    } else {
      navigate(link.target);
    }
  };

  const hasUnread = (notifications || []).some((n) => n && n.is_read === false);

  return (
    <motion.div
      className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl bg-[#12121a] text-white shadow-2xl shadow-black/50 ring-1 ring-white/[0.06] overflow-hidden z-50"
      initial={{ opacity: 0, y: -6, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -6, scale: 0.97 }}
      transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
    >
      {/* Header — title on the left, action cluster on the right.
          On the narrowest popover width (320px) the actions wrap
          to a second line beneath the title rather than crowding
          the row, so the "Mark all read" + "Clear all" buttons
          never overflow or get clipped. */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 px-4 py-2.5 border-b border-white/[0.04]">
        <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">Notifications</h3>
        <div className="flex items-center gap-3 ml-auto">
          {hasUnread && typeof markAllNotificationsRead === 'function' && (
            <button
              onClick={() => markAllNotificationsRead()}
              className="inline-flex items-center gap-1 text-[11px] text-zinc-400 hover:text-white transition-colors focus:outline-none"
              title="Mark all as read"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>Mark all read</span>
            </button>
          )}
          {Array.isArray(notifications) && notifications.length > 0 && typeof clearAllNotifications === 'function' && (
            // Two-tap confirm: first tap flips the button into a
            // red "Confirm?" pill that auto-disarms after 3.5s, so
            // a stray click never wipes someone's notification
            // history. Same idiom we use on the queue's clear-all.
            <button
              onClick={() => {
                if (!clearArmed) { setClearArmed(true); return; }
                setClearArmed(false);
                Promise.resolve(clearAllNotifications()).catch(() => {
                  // Endpoint missing or network error — context will
                  // refetch from the server in a moment to restore
                  // truth. Surface a toast so the user knows the
                  // action didn't actually persist and to try again.
                  toast({
                    title: "Couldn't clear notifications",
                    description: 'Server rejected the request — please try again in a moment.',
                    variant: 'destructive',
                    duration: 3000,
                  });
                });
              }}
              className={`inline-flex items-center gap-1 text-[11px] transition-colors focus:outline-none ${
                clearArmed
                  ? 'text-red-300 hover:text-red-200'
                  : 'text-zinc-500 hover:text-zinc-200'
              }`}
              title={clearArmed ? 'Tap again to confirm' : 'Clear all notifications'}
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{clearArmed ? 'Confirm?' : 'Clear all'}</span>
            </button>
          )}
          <button onClick={onClose} className="text-zinc-600 hover:text-zinc-300 text-xs transition-colors focus:outline-none">Close</button>
        </div>
      </div>
      <div className="max-h-80 overflow-auto">
        {notificationsLoading ? (
          <div className="px-4 py-8 text-center text-zinc-600 text-sm">Loading...</div>
        ) : !notifications || notifications.length === 0 ? (
          <div className="px-4 py-8 text-center text-zinc-600 text-sm">No notifications</div>
        ) : (
          <ul className="divide-y divide-white/[0.03]">
            <AnimatePresence initial={false}>
              {notifications.map((n) => (
                <SwipeableNotificationItem
                  key={n.id}
                  notification={n}
                  onClick={() => handleNotificationClick(n)}
                  onDelete={() => deleteNotification?.(n.id)}
                />
              ))}
            </AnimatePresence>
          </ul>
        )}
      </div>
    </motion.div>
  );
}

NotificationsPopover.propTypes = {
  onClose: PropTypes.func,
};

/* ─── Swipeable notification row ─── */

// SwipeableNotificationItem
//
// A single row in the notifications popover that supports two
// gestures:
//
//   * Swipe left ➜ slide the row to reveal a red Trash button. If
//     the user releases past the dismiss threshold, the row animates
//     fully off-screen and `onDelete` fires (which the parent wires
//     up to the optimistic `deleteNotification` action).
//   * Tap (no horizontal movement, or below the threshold) ➜ falls
//     through to the standard click handler so the notification
//     still deep-links to its target as before.
//
// The native click is intentionally cancelled when a swipe fires —
// without that guard, dismissing on touchscreens would also navigate
// to whatever the notification linked to. We track the absolute
// horizontal delta during pan and consume the next click event when
// the user actually swiped.
function SwipeableNotificationItem({ notification: n, onClick, onDelete }) {
  // Mid-removal flag — once a swipe commits we set this true,
  // which kicks off the slide-off-screen animation. The animate
  // prop takes priority over the drag motion-value, so the row
  // doesn't snap back to rest while the optimistic delete is in
  // flight; if the API rejects it we flip back to false and the
  // parent's rollback re-inserts the row in place.
  const [isRemoving, setIsRemoving] = useState(false);
  // True whenever the user is actively dragging — drives the
  // reveal animation on the trash affordance underneath. We also
  // keep an "X has moved at all" ref so the synthetic click that
  // fires after pointer-up doesn't navigate when the user was
  // really swiping.
  const [isDragging, setIsDragging] = useState(false);
  // Show/hover state for the inline trash button on desktop.
  const [hovered, setHovered] = useState(false);
  const dragMovedRef = useRef(false);

  const SWIPE_DISMISS_PX = 80;
  const SWIPE_DISMISS_VELOCITY = 500;
  const TAP_GUARD_PX = 8;

  const handleDragStart = () => {
    dragMovedRef.current = false;
    setIsDragging(true);
  };

  const handleDrag = (_e, info) => {
    if (Math.abs(info.offset.x) > TAP_GUARD_PX) {
      dragMovedRef.current = true;
    }
  };

  const handleDragEnd = (_e, info) => {
    setIsDragging(false);
    const past =
      info.offset.x <= -SWIPE_DISMISS_PX ||
      info.velocity.x <= -SWIPE_DISMISS_VELOCITY;
    if (past) {
      setIsRemoving(true);
      Promise.resolve()
        .then(() => onDelete?.())
        .catch(() => setIsRemoving(false));
    }
    // Otherwise dragSnapToOrigin returns the row to x=0 and the
    // trash affordance fades back out via the AnimatePresence
    // around it.
  };

  const handleClickCapture = (e) => {
    if (dragMovedRef.current) {
      e.preventDefault();
      e.stopPropagation();
      dragMovedRef.current = false;
    }
  };

  const triggerDelete = () => {
    if (isRemoving) return;
    setIsRemoving(true);
    Promise.resolve()
      .then(() => onDelete?.())
      .catch(() => setIsRemoving(false));
  };

  // The trash affordance is shown only when (a) the user is mid-
  // swipe (mobile gesture), (b) hovering with a mouse / focused
  // (desktop keyboard), or (c) the row is animating off. Keeping
  // it hidden at rest is what makes the popover read as a clean
  // notification list rather than a wall of red strips.
  const showTrash = isDragging || hovered || isRemoving;

  return (
    <motion.li
      layout
      initial={false}
      exit={{ opacity: 0, height: 0, marginTop: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0 }}
      transition={{ type: 'tween', duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
      className="relative overflow-hidden group"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
    >
      {/* Trash affordance — sits at the far-right edge of the row
          and only appears in interactive states. Width is just
          enough for the icon (no "DELETE" text strip eating the
          row). On desktop it's a real clickable button so users
          can dismiss without swiping; on mobile it acts as the
          visual reveal target for the swipe gesture. */}
      <AnimatePresence>
        {showTrash && (
          <motion.button
            type="button"
            key="trash"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            onClick={(e) => { e.stopPropagation(); triggerDelete(); }}
            onPointerDown={(e) => e.stopPropagation()}
            aria-label="Delete notification"
            title="Delete notification"
            className="absolute top-1/2 right-2 -translate-y-1/2 z-[1] inline-flex items-center justify-center w-7 h-7 rounded-full bg-zinc-800/80 text-zinc-300 hover:bg-red-500/90 hover:text-white border border-white/[0.06] transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </motion.button>
        )}
      </AnimatePresence>

      <motion.div
        className={`relative bg-[#12121a] pl-4 pr-10 py-3 hover:bg-white/[0.03] cursor-pointer transition-colors ${n.is_read ? 'opacity-60' : ''}`}
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={{ left: 0.6, right: 0 }}
        dragSnapToOrigin
        dragMomentum={false}
        onDragStart={handleDragStart}
        onDrag={handleDrag}
        onDragEnd={handleDragEnd}
        animate={isRemoving ? { x: -360, opacity: 0 } : undefined}
        transition={{ type: 'tween', duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
        onClickCapture={handleClickCapture}
        onClick={onClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.(); }
          if (e.key === 'Delete' || e.key === 'Backspace') {
            e.preventDefault();
            triggerDelete();
          }
        }}
        aria-label={`Notification: ${n?.message || ''}`}
      >
        <div className="flex items-start gap-3">
          <span className={`mt-1.5 inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 ${n.is_read ? 'bg-zinc-700' : 'bg-red-500'}`} />
          <div className="flex-1 min-w-0">
            {n.title && (
              <p className="text-sm font-semibold leading-snug break-words text-white">
                {n.title}
              </p>
            )}
            <p className={`text-sm leading-snug break-words text-zinc-300 ${n.title ? 'mt-0.5' : ''}`}>
              {n.message || 'You have a new notification.'}
            </p>
            {n.created_at && (
              <p className="text-[11px] text-zinc-600 mt-1">
                {new Date(n.created_at).toLocaleString()}
              </p>
            )}
          </div>
        </div>
      </motion.div>
    </motion.li>
  );
}

SwipeableNotificationItem.propTypes = {
  notification: PropTypes.object.isRequired,
  onClick: PropTypes.func,
  onDelete: PropTypes.func,
};

Layout.propTypes = {
  children: PropTypes.node,
  currentPageName: PropTypes.string,
  hasPlayer: PropTypes.bool,
};
