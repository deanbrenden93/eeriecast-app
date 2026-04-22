import { useState, useMemo, useCallback, useEffect } from 'react';
import PropTypes from 'prop-types';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Heart, Crown, BookOpen, Clock, Star, Headphones,
  ShieldAlert, Play, Sparkles, ChevronRight, X,
  Library, ListMusic, ShoppingBag, Volume2,
} from 'lucide-react';
import { usePodcasts } from '@/context/PodcastContext';
import { useUser } from '@/context/UserContext';
import { useSettings } from '@/hooks/use-settings';
import { isAudiobook, isMaturePodcast, getPodcastCategorySet } from '@/lib/utils';
import { UserLibrary } from '@/api/entities';
import { PaymentFormModal } from '@/pages/Premium';
import { createPageUrl } from '@/utils';

const ONBOARDING_KEY = 'eeriecast_onboarding_done';

export function isOnboardingDone() {
  return localStorage.getItem(ONBOARDING_KEY) === '1';
}

export async function markOnboardingDone() {
  localStorage.setItem(ONBOARDING_KEY, '1');
  try {
    const { User: UserAPI } = await import('@/api/entities');
    await UserAPI.updateMe({ onboarding_completed: true });
  } catch (err) {
    console.error('Failed to persist onboarding completion to backend:', err);
  }
}

// ---------------------------------------------------------------------------
// Step indicator dots
// ---------------------------------------------------------------------------
function StepDots({ total, current }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={`h-1.5 rounded-full transition-all duration-500 ${
            i === current
              ? 'w-6 bg-red-500'
              : i < current
                ? 'w-1.5 bg-red-500/40'
                : 'w-1.5 bg-white/10'
          }`}
        />
      ))}
    </div>
  );
}

StepDots.propTypes = { total: PropTypes.number.isRequired, current: PropTypes.number.isRequired };

const slideVariants = {
  enter: (dir) => ({ x: dir > 0 ? 80 : -80, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir) => ({ x: dir > 0 ? -80 : 80, opacity: 0 }),
};

// ---------------------------------------------------------------------------
// Screen 1 — Welcome
// ---------------------------------------------------------------------------
function WelcomeStep({ isPremium, onContinue }) {
  const features = isPremium
    ? [
        { icon: Volume2, text: 'Ad-free listening on every show' },
        { icon: Headphones, text: 'All exclusive & members-only episodes' },
        { icon: BookOpen, text: 'Full audiobook access — every chapter' },
        { icon: ListMusic, text: 'Unlimited playlists & favorites' },
        { icon: ShoppingBag, text: '20% off in the Eeriecast Shop' },
      ]
    : [
        { icon: Heart, text: 'Save up to 5 favorite episodes' },
        { icon: Star, text: 'Follow your favorite shows' },
        { icon: Clock, text: 'Listening history synced across devices' },
        { icon: BookOpen, text: 'First 3 chapters of every audiobook' },
        { icon: Library, text: 'Your personal library' },
      ];

  return (
    <div className="flex flex-col items-center justify-center h-full px-6 text-center">
      <motion.div
        initial={{ scale: 0, rotate: -20 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', damping: 14, stiffness: 180, delay: 0.1 }}
        className={`w-20 h-20 rounded-2xl flex items-center justify-center mb-8 ${
          isPremium
            ? 'bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-amber-500/20'
            : 'bg-gradient-to-br from-red-500/20 to-red-600/10 border border-red-500/20'
        }`}
      >
        {isPremium
          ? <Crown className="w-10 h-10 text-amber-400" />
          : <Sparkles className="w-10 h-10 text-red-400" />
        }
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="text-2xl sm:text-3xl font-bold text-white mb-2"
      >
        {isPremium ? 'Welcome to Premium' : 'Welcome to Eeriecast'}
      </motion.h1>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="text-sm text-zinc-500 mb-10 max-w-xs"
      >
        {isPremium
          ? 'Your membership is active. Here\'s what you\'ve unlocked.'
          : 'Your account is ready. Here\'s what you can do.'}
      </motion.p>

      <div className="w-full max-w-sm space-y-3 mb-10">
        {features.map((f, i) => (
          <motion.div
            key={f.text}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.35 + i * 0.07 }}
            className="flex items-center gap-3.5 text-left"
          >
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
              isPremium ? 'bg-amber-500/10' : 'bg-white/[0.04]'
            }`}>
              <f.icon className={`w-4 h-4 ${isPremium ? 'text-amber-400' : 'text-zinc-400'}`} />
            </div>
            <span className="text-sm text-zinc-300">{f.text}</span>
          </motion.div>
        ))}
      </div>

      <motion.button
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
        onClick={onContinue}
        className="flex items-center gap-2 bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] text-white font-medium px-8 py-3 rounded-xl transition-all duration-300 text-sm"
      >
        Continue
        <ChevronRight className="w-4 h-4" />
      </motion.button>
    </div>
  );
}

WelcomeStep.propTypes = { isPremium: PropTypes.bool.isRequired, onContinue: PropTypes.func.isRequired };

// Members-only frontend overrides (mirrors Podcasts.jsx / Discover.jsx)
const MEMBERS_ONLY_OVERRIDES = new Set([10, 4]);
function applyExclusiveOverrides(list) {
  return list.map(p => (p && MEMBERS_ONLY_OVERRIDES.has(p.id) && !p.is_exclusive) ? { ...p, is_exclusive: true } : p);
}

// ---------------------------------------------------------------------------
// Screen 2 — Follow Shows + Mature Toggle
// ---------------------------------------------------------------------------
function FollowShowsStep({ onContinue, onSkip }) {
  const { podcasts: rawPodcasts } = usePodcasts();
  const { user, userAge, canViewMature, isPremium, followedPodcastIds, refreshFollowings, refreshUser } = useUser();

  const [localFollowed, setLocalFollowed] = useState(new Set());
  const [loadingIds, setLoadingIds] = useState(new Set());

  useEffect(() => {
    if (followedPodcastIds) setLocalFollowed(new Set(followedPodcastIds));
  }, [followedPodcastIds]);

  const shows = useMemo(() => {
    let list = applyExclusiveOverrides(rawPodcasts || []).filter(p => !isAudiobook(p));
    if (!canViewMature) {
      list = list.filter(p => !isMaturePodcast(p));
    }
    if (!isPremium) {
      list = list.filter(p => !p.is_exclusive);
    }
    return list;
  }, [rawPodcasts, canViewMature, isPremium]);

  const grouped = useMemo(() => {
    const metaCategories = new Set(['members', 'members only', 'members-only', 'exclusive', 'podcast']);

    function getDisplayCategory(show) {
      const allCats = Array.from(getPodcastCategorySet(show));
      const content = allCats.filter(c => !metaCategories.has(c) && c !== 'audiobook' && c !== 'audiobooks');
      if (content.length) return content[0].charAt(0).toUpperCase() + content[0].slice(1);
      return 'Shows';
    }

    const map = new Map();
    if (isPremium) {
      const exclusiveShows = shows.filter(p => p.is_exclusive);
      const freeShows = shows.filter(p => !p.is_exclusive);
      if (exclusiveShows.length) map.set('Members-Only', exclusiveShows);
      for (const show of freeShows) {
        const catName = getDisplayCategory(show);
        if (!map.has(catName)) map.set(catName, []);
        map.get(catName).push(show);
      }
    } else {
      for (const show of shows) {
        const catName = getDisplayCategory(show);
        if (!map.has(catName)) map.set(catName, []);
        map.get(catName).push(show);
      }
    }
    const entries = Array.from(map.entries());
    const membersOnly = entries.filter(([k]) => k === 'Members-Only');
    const rest = entries.filter(([k]) => k !== 'Members-Only').sort((a, b) => a[0].localeCompare(b[0]));
    return [...membersOnly, ...rest];
  }, [shows, isPremium]);

  const handleToggleFollow = useCallback(async (showId) => {
    const numId = Number(showId);
    if (loadingIds.has(numId)) return;
    const wasFollowing = localFollowed.has(numId);

    setLoadingIds(prev => new Set(prev).add(numId));
    setLocalFollowed(prev => {
      const next = new Set(prev);
      wasFollowing ? next.delete(numId) : next.add(numId);
      return next;
    });

    try {
      if (wasFollowing) {
        await UserLibrary.unfollowPodcast(numId);
      } else {
        await UserLibrary.followPodcast(numId);
      }
      refreshFollowings();
    } catch (err) {
      if (typeof console !== 'undefined') console.debug('Follow toggle failed', err);
      setLocalFollowed(prev => {
        const next = new Set(prev);
        wasFollowing ? next.add(numId) : next.delete(numId);
        return next;
      });
    } finally {
      setLoadingIds(prev => {
        const next = new Set(prev);
        next.delete(numId);
        return next;
      });
    }
  }, [loadingIds, localFollowed, refreshFollowings]);

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 pt-6 pb-4 text-center flex-shrink-0">
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-xl sm:text-2xl font-bold text-white mb-1"
        >
          Follow Your Favorites
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="text-sm text-zinc-500"
        >
          Discover something new or follow shows you love
        </motion.p>

        {userAge !== null && userAge >= 18 && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            type="button"
            onClick={async () => {
              try {
                const { User: UserAPI } = await import('@/api/entities');
                await UserAPI.updateMe({ allow_mature_content: !user?.allow_mature_content });
                await refreshUser();
              } catch (err) {
                console.error('Failed to update mature content:', err);
              }
            }}
            className="mt-4 mx-auto flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-2.5 transition-colors hover:bg-white/[0.04]"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" />
            <span className="text-xs text-zinc-400">Mature Content</span>
            <div
              className={`relative w-8 h-[16px] rounded-full transition-all duration-300 flex-shrink-0 ${
                user?.allow_mature_content ? 'bg-red-600' : 'bg-zinc-700'
              }`}
            >
              <div
                className={`absolute top-[2px] w-3 h-3 rounded-full bg-white transition-all duration-300 ${
                  user?.allow_mature_content ? 'left-[18px]' : 'left-[2px]'
                }`}
              />
            </div>
          </motion.button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-4" style={{ scrollbarWidth: 'thin' }}>
        {grouped.map(([category, categoryShows], ci) => (
          <motion.div
            key={category}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 + ci * 0.05 }}
            className="mb-5"
          >
            <h3 className={`text-xs uppercase tracking-wider font-medium mb-2.5 px-1 flex items-center gap-1.5 ${
              category === 'Members-Only' ? 'text-amber-500/80' : 'text-zinc-600'
            }`}>
              {category === 'Members-Only' && <Crown className="w-3 h-3" />}
              {category}
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {categoryShows.map((show) => {
                const numId = Number(show.id);
                const isFollowing = localFollowed.has(numId);
                const isLoading = loadingIds.has(numId);
                return (
                  <button
                    key={show.id}
                    type="button"
                    onClick={() => handleToggleFollow(show.id)}
                    disabled={isLoading}
                    className={`relative flex items-center gap-2.5 rounded-xl p-2.5 text-left transition-all duration-300 border ${
                      isFollowing
                        ? 'bg-red-500/[0.06] border-red-500/20'
                        : 'bg-white/[0.02] border-white/[0.04] hover:bg-white/[0.04] hover:border-white/[0.08]'
                    } ${isLoading ? 'opacity-60' : ''}`}
                  >
                    <div className="w-11 h-11 rounded-lg overflow-hidden flex-shrink-0 bg-zinc-800">
                      {show.cover_image && (
                        <img src={show.cover_image} alt="" className="w-full h-full object-cover" loading="lazy" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        <p className="text-xs font-medium text-zinc-200 truncate">{show.title || show.name}</p>
                        {show.is_exclusive && (
                          <Crown className="w-2.5 h-2.5 text-amber-500/70 flex-shrink-0" />
                        )}
                      </div>
                      {show.episode_count != null && (
                        <p className="text-[10px] text-zinc-600 mt-0.5">{show.episode_count} episodes</p>
                      )}
                    </div>
                    <Heart
                      className={`w-3.5 h-3.5 flex-shrink-0 transition-all duration-300 ${
                        isFollowing ? 'text-red-400 fill-red-400 scale-110' : 'text-zinc-600'
                      }`}
                    />
                  </button>
                );
              })}
            </div>
          </motion.div>
        ))}
        {shows.length === 0 && (
          <div className="flex items-center justify-center h-40 text-sm text-zinc-600">No shows available</div>
        )}
      </div>

      <div className="flex-shrink-0 px-6 py-4 flex items-center justify-between border-t border-white/[0.04]">
        <button type="button" onClick={onSkip} className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors">
          Skip
        </button>
        <button
          type="button"
          onClick={onContinue}
          className="flex items-center gap-2 bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] text-white font-medium px-6 py-2.5 rounded-xl transition-all duration-300 text-sm"
        >
          Continue
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

FollowShowsStep.propTypes = { onContinue: PropTypes.func.isRequired, onSkip: PropTypes.func.isRequired };

// ---------------------------------------------------------------------------
// Screen 3 (Free) — Premium Upsell
// ---------------------------------------------------------------------------
function PremiumUpsellStep({ onComplete }) {
  const [showPayment, setShowPayment] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState('monthly');
  const { fetchUser } = useUser();

  const perks = [
    { icon: Volume2, text: 'Ad-free listening' },
    { icon: Headphones, text: 'All exclusive episodes' },
    { icon: BookOpen, text: 'Full audiobook access' },
    { icon: ListMusic, text: 'Unlimited playlists & favorites' },
    { icon: ShoppingBag, text: '20% off the Eeriecast Shop' },
  ];

  const handlePaymentSuccess = useCallback(async () => {
    try { await fetchUser(); } catch { /* handled inside modal */ }
    setShowPayment(false);
    onComplete();
  }, [fetchUser, onComplete]);

  return (
    <div className="relative flex flex-col items-center justify-center h-full px-6 text-center">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-[radial-gradient(ellipse_at_center,_rgba(220,38,38,0.06)_0%,_transparent_70%)] pointer-events-none" />

      <motion.div
        initial={{ scale: 0, rotate: -20 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', damping: 14, stiffness: 180, delay: 0.1 }}
        className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-amber-500/20 flex items-center justify-center mb-6"
      >
        <Crown className="w-8 h-8 text-amber-400" />
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="text-xl sm:text-2xl font-bold text-white mb-1"
      >
        Want the full experience?
      </motion.h1>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="text-sm text-zinc-500 mb-8 max-w-xs"
      >
        Try 7 days free. Cancel anytime.
      </motion.p>

      <div className="w-full max-w-xs space-y-2.5 mb-8">
        {perks.map((p, i) => (
          <motion.div
            key={p.text}
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.35 + i * 0.06 }}
            className="flex items-center gap-3 text-left"
          >
            <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0">
              <p.icon className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <span className="text-sm text-zinc-300">{p.text}</span>
          </motion.div>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7 }}
        className="flex items-center gap-2 mb-6"
      >
        <button
          type="button"
          onClick={() => setSelectedPlan('monthly')}
          className={`px-4 py-2 rounded-lg text-xs font-medium transition-all duration-200 ${
            selectedPlan === 'monthly'
              ? 'bg-white/[0.08] text-white border border-white/[0.12]'
              : 'text-zinc-500 hover:text-zinc-400 border border-transparent'
          }`}
        >
          $7.99/mo
        </button>
        <button
          type="button"
          onClick={() => setSelectedPlan('yearly')}
          className={`px-4 py-2 rounded-lg text-xs font-medium transition-all duration-200 ${
            selectedPlan === 'yearly'
              ? 'bg-white/[0.08] text-white border border-white/[0.12]'
              : 'text-zinc-500 hover:text-zinc-400 border border-transparent'
          }`}
        >
          $69.96/yr
          <span className="ml-1.5 text-[10px] text-emerald-400 font-normal">Save 27%</span>
        </button>
      </motion.div>

      <motion.button
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
        onClick={() => setShowPayment(true)}
        className="w-full max-w-xs bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-semibold py-3 rounded-xl shadow-lg shadow-red-900/30 transition-all duration-300 text-sm"
      >
        Start Free Trial
      </motion.button>

      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
        onClick={onComplete}
        className="mt-4 text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
      >
        Maybe Later
      </motion.button>

      <AnimatePresence>
        {showPayment && (
          <PaymentFormModal
            open={showPayment}
            onClose={() => setShowPayment(false)}
            onSuccess={handlePaymentSuccess}
            plan={selectedPlan}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

PremiumUpsellStep.propTypes = { onComplete: PropTypes.func.isRequired };

// ---------------------------------------------------------------------------
// Screen 3 (Premium) — Celebration
// ---------------------------------------------------------------------------
function CelebrationStep({ onComplete }) {
  const { user } = useUser();
  const username = user?.username || user?.email?.split('@')[0] || 'Member';

  const embers = useMemo(() =>
    Array.from({ length: 35 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      size: 1.5 + Math.random() * 2.5,
      delay: Math.random() * 4,
      duration: 4 + Math.random() * 5,
      opacity: 0.2 + Math.random() * 0.5,
      drift: -20 + Math.random() * 40,
    })),
  []);

  return (
    <div className="relative flex flex-col items-center justify-center h-full px-6 text-center overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_60%,_rgba(220,38,38,0.08)_0%,_transparent_60%)] pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_30%,_rgba(180,83,9,0.05)_0%,_transparent_50%)] pointer-events-none" />

      {embers.map((e) => (
        <motion.div
          key={e.id}
          className="absolute rounded-full pointer-events-none"
          style={{
            width: e.size,
            height: e.size,
            left: `${e.x}%`,
            bottom: '-5%',
            background: `radial-gradient(circle, rgba(239,68,68,${e.opacity}) 0%, rgba(251,146,60,${e.opacity * 0.6}) 60%, transparent 100%)`,
            boxShadow: `0 0 ${e.size * 2}px rgba(239,68,68,${e.opacity * 0.4})`,
          }}
          animate={{
            y: [0, -(400 + Math.random() * 300)],
            x: [0, e.drift],
            opacity: [0, e.opacity, e.opacity, 0],
          }}
          transition={{
            duration: e.duration,
            delay: e.delay,
            repeat: Infinity,
            ease: 'linear',
          }}
        />
      ))}

      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', damping: 12, stiffness: 150, delay: 0.2 }}
        className="relative mb-8"
      >
        <motion.div
          animate={{ scale: [1, 1.15, 1], opacity: [0.3, 0.15, 0.3] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute inset-0 w-24 h-24 -m-2 rounded-full bg-amber-500/20 blur-xl"
        />
        <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-amber-500/25 flex items-center justify-center">
          <Crown className="w-10 h-10 text-amber-400" />
        </div>
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="text-2xl sm:text-3xl font-bold text-white mb-2"
      >
        Thank you, {username}
      </motion.h1>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.55 }}
        className="text-sm text-zinc-400 mb-3 max-w-xs leading-relaxed"
      >
        Welcome to the inner circle.
      </motion.p>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7 }}
        className="text-xs text-zinc-600 mb-12 max-w-[260px] leading-relaxed"
      >
        Your membership supports the creators who bring these stories to life. We&rsquo;re glad you&rsquo;re here.
      </motion.p>

      <motion.button
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.9 }}
        onClick={onComplete}
        className="flex items-center gap-2.5 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-semibold px-8 py-3 rounded-xl shadow-lg shadow-red-900/30 transition-all duration-300 text-sm"
      >
        <Play className="w-4 h-4 fill-white" />
        Start Listening
      </motion.button>
    </div>
  );
}

CelebrationStep.propTypes = { onComplete: PropTypes.func.isRequired };

// ---------------------------------------------------------------------------
// Screen: Memberful Welcome (Relaunch Plan)
// ---------------------------------------------------------------------------
function MemberfulWelcomeStep({ planType, onContinue }) {
  const duration = planType === 'yearly' ? 'a year' : '60 days';
  
  return (
    <div className="flex flex-col items-center justify-center h-full px-6 text-center">
      <motion.div
        initial={{ scale: 0, rotate: -20 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', damping: 14, stiffness: 180, delay: 0.1 }}
        className="w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-amber-500/20 flex items-center justify-center mb-8"
      >
        <Heart className="w-10 h-10 text-amber-400" />
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="text-2xl sm:text-3xl font-bold text-white mb-4"
      >
        Thank you for being a member!
      </motion.h1>
      
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="text-sm text-zinc-400 mb-10 max-w-sm space-y-4 leading-relaxed"
      >
        <p>
          Thank you so much for being a member and switching to our new platform! 
          As a thank you, we are giving you <strong>{duration}</strong> free.
        </p>
        <p>
          If you like the new platform, you will need to sign up for a new membership - 
          You will no longer be automatically charged for the old membership site.
        </p>
        <p>
          If you sign up for a membership at the end of your free period, 
          you will begin to be charged then based on your chosen plan. Enjoy!
        </p>
      </motion.div>

      <motion.button
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        onClick={onContinue}
        className="group relative flex items-center gap-2.5 bg-white text-black font-bold px-8 py-3.5 rounded-xl transition-all duration-300 hover:bg-zinc-200"
      >
        Continue to Setup
        <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
      </motion.button>
    </div>
  );
}

MemberfulWelcomeStep.propTypes = {
  planType: PropTypes.string,
  onContinue: PropTypes.func.isRequired,
};

// ---------------------------------------------------------------------------
// Main OnboardingFlow
// ---------------------------------------------------------------------------
export default function OnboardingFlow({ variant, onComplete }) {
  const { user } = useUser();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);

  const isImported = user?.is_imported_from_memberful;
  const isExistingPremium = variant === 'premium-existing';
  const isPremium = variant === 'premium' || isExistingPremium || (isImported && user?.is_premium);

  // If imported, we add the MemberfulWelcomeStep as the first step (step -1 or shift others)
  // Let's just adjust the step logic.
  const hasMemberfulStep = isImported;
  // Existing premium users skip the FollowShowsStep (they already use the app),
  // so their flow is just Welcome + Celebration.
  const hasFollowShowsStep = !isExistingPremium;
  const totalSteps =
    1 /* welcome */ +
    (hasFollowShowsStep ? 1 : 0) +
    1 /* celebration/upsell */ +
    (hasMemberfulStep ? 1 : 0);

  const goForward = useCallback(() => {
    setDirection(1);
    setStep((s) => Math.min(s + 1, totalSteps - 1));
  }, [totalSteps]);

  const handleComplete = useCallback(async () => {
    await markOnboardingDone();
    onComplete();
    if (isExistingPremium) {
      navigate(createPageUrl('Home'));
    }
  }, [onComplete, isExistingPremium, navigate]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      className="fixed inset-0 z-[100] bg-[#0A0A12] flex flex-col"
    >
      <div className="flex items-center justify-between px-6 py-4 flex-shrink-0">
        <StepDots total={totalSteps} current={step} />
        {step < totalSteps - 1 && (
          <button
            type="button"
            onClick={handleComplete}
            className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors flex items-center gap-1"
          >
            <X className="w-3 h-3" />
            Skip all
          </button>
        )}
      </div>

      <div className="flex-1 relative overflow-hidden">
        <AnimatePresence mode="wait" custom={direction}>
          {hasMemberfulStep && step === 0 && (
            <motion.div
              key="memberful-welcome"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
              className="absolute inset-0"
            >
              <MemberfulWelcomeStep 
                planType={user?.memberful_plan_type} 
                onContinue={goForward} 
              />
            </motion.div>
          )}
          
          {(() => {
            const welcomeIndex = hasMemberfulStep ? 1 : 0;
            const followIndex = hasFollowShowsStep ? welcomeIndex + 1 : -1;
            const finalIndex = totalSteps - 1;
            return (
              <>
                {step === welcomeIndex && (
                  <motion.div
                    key="welcome"
                    custom={direction}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
                    className="absolute inset-0"
                  >
                    <WelcomeStep isPremium={isPremium} onContinue={goForward} />
                  </motion.div>
                )}
                {hasFollowShowsStep && step === followIndex && (
                  <motion.div
                    key="follow"
                    custom={direction}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
                    className="absolute inset-0"
                  >
                    <FollowShowsStep onContinue={goForward} onSkip={goForward} />
                  </motion.div>
                )}
                {step === finalIndex && (
                  <motion.div
                    key="final"
                    custom={direction}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
                    className="absolute inset-0"
                  >
                    {isPremium
                      ? <CelebrationStep onComplete={handleComplete} />
                      : <PremiumUpsellStep onComplete={handleComplete} />
                    }
                  </motion.div>
                )}
              </>
            );
          })()}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

OnboardingFlow.propTypes = {
  variant: PropTypes.oneOf(['free', 'premium', 'premium-existing']).isRequired,
  onComplete: PropTypes.func.isRequired,
};
