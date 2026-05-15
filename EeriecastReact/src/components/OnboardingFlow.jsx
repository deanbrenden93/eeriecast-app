import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Heart, Crown, BookOpen, Headphones,
  Moon, Play, Sparkles, ChevronRight, X,
  ListMusic, ShoppingBag, Volume2, Check,
} from 'lucide-react';
import { usePodcasts } from '@/context/PodcastContext';
import { useUser } from '@/context/UserContext';
import { useSettings } from '@/hooks/use-settings';
import { isAudiobook, isMusic, isMaturePodcast } from '@/lib/utils';
import { UserLibrary } from '@/api/entities';
import { PaymentFormModal } from '@/pages/Premium';
import MatureContentModal from '@/components/MatureContentModal';
import { createPageUrl } from '@/utils';

const ONBOARDING_KEY = 'eeriecast_onboarding_done';

export function isOnboardingDone() {
  return localStorage.getItem(ONBOARDING_KEY) === '1';
}

export async function markOnboardingDone() {
  // Set BOTH localStorage flags synchronously *before* the backend call so
  // any effect that re-runs in the same React tick (e.g. the
  // ``onboarding_completed===false`` belt-and-suspenders effect in App.jsx)
  // sees the completion intent immediately, rather than re-mounting this
  // flow while the backend roundtrip is still in flight.
  localStorage.setItem(ONBOARDING_KEY, '1');
  try {
    sessionStorage.setItem('eeriecast_onboarding_session_dismissed', '1');
  } catch { /* sessionStorage may be unavailable in private mode */ }
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
// Atmospheric backdrop shared by the WelcomeStep and MemberfulWelcomeStep
// front-doors. A pair of radial washes (one warm red, one upper amber
// for premium) gives both screens a low-key cinematic mood without
// committing to a full-bleed photograph. Tinted variant is controlled
// by ``isPremium`` so the same component handles both onboarding paths.
function FrontDoorBackdrop({ isPremium }) {
  return (
    <>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_45%,_rgba(220,38,38,0.10)_0%,_transparent_55%)]" />
      <div
        className={`pointer-events-none absolute inset-x-0 top-0 h-1/2 ${
          isPremium
            ? 'bg-[radial-gradient(ellipse_at_50%_20%,_rgba(251,191,36,0.06)_0%,_transparent_60%)]'
            : 'bg-[radial-gradient(ellipse_at_50%_15%,_rgba(124,58,237,0.05)_0%,_transparent_60%)]'
        }`}
      />
      {/* Soft horizon vignette anchoring the lower third — keeps the body
          of the screen from feeling like a void below the headline. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/40 to-transparent" />
    </>
  );
}

FrontDoorBackdrop.propTypes = { isPremium: PropTypes.bool.isRequired };

function WelcomeStep({ isPremium, onContinue }) {
  // The Welcome screen is the first emotional beat of the entire onboarding
  // flow — it sets the tone for everything below it. The old layout
  // (icon-tile + 5 bulleted features + grey "Continue" pill) read as a
  // generic SaaS onboarding card. The redesign trades the enumerated
  // feature list for a single oversized headline, one supporting line,
  // and a real CTA — then saves the feature-by-feature pitch for the
  // PremiumUpsellStep, which is the screen that actually does sales work.

  // Sigil mark behind the headline. The premium variant gets a soft
  // amber crown; the free variant gets a triple sparkle suggesting
  // candlelit ambience. Kept compact (no boxed icon tile) so the
  // typography is unambiguously the focal point.
  const Sigil = isPremium ? Crown : Sparkles;
  const sigilTint = isPremium ? 'text-amber-300/90' : 'text-red-400/80';

  // Two short lines of body copy. The first carries the welcome; the
  // second sets a quiet promise. Authored as a pair rather than a
  // single sentence so the cadence has room to breathe.
  const headline = isPremium ? 'Welcome to the membership.' : 'Welcome to Eeriecast.';
  const accent = isPremium ? 'the inner circle' : 'after dark';
  const supportingLead = isPremium
    ? 'Everything\u2019s unlocked. Ad-free shows, exclusive episodes, the audiobook stacks — yours.'
    : 'Built for the kind of listening that happens late at night, with the lights low and the door closed.';

  return (
    <div className="relative flex flex-col items-center justify-center h-full px-6 text-center overflow-hidden">
      <FrontDoorBackdrop isPremium={isPremium} />

      {/* Sigil — atmospheric, no boxed tile. Animates in with a slow
          drift so the entrance reads as deliberate rather than a UI
          element flicking into place. */}
      <motion.div
        initial={{ opacity: 0, y: -14, scale: 0.92 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
        className="relative mb-8"
      >
        <motion.div
          aria-hidden
          animate={{ opacity: [0.35, 0.55, 0.35] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          className={`absolute inset-0 -m-6 rounded-full blur-2xl ${
            isPremium ? 'bg-amber-500/15' : 'bg-red-500/12'
          }`}
        />
        <Sigil className={`relative w-10 h-10 ${sigilTint}`} strokeWidth={1.5} />
      </motion.div>

      {/* Headline — Outfit display, oversized, with one phrase reset in
          font-eerie (Pirata One) for atmospheric bite. The accent line
          uses inline rotation and a slightly desaturated tint so it
          reads as quiet emphasis rather than a separate UI element. */}
      <motion.h1
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
        className="font-display text-[32px] sm:text-[40px] leading-[1.05] font-semibold text-white tracking-tight max-w-[18ch]"
      >
        {headline}
      </motion.h1>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4, duration: 0.55 }}
        className="mt-3 mb-6 text-[14px] text-zinc-400 max-w-md leading-relaxed"
      >
        Made for {' '}
        <span className={`font-eerie text-[18px] tracking-wide ${
          isPremium ? 'text-amber-200/90' : 'text-red-200/85'
        }`}>
          {accent}
        </span>
        .
      </motion.p>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.55, duration: 0.55 }}
        className="text-[13px] text-zinc-500 max-w-sm leading-relaxed mb-12"
      >
        {supportingLead}
      </motion.p>

      <motion.button
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.85, duration: 0.5 }}
        onClick={onContinue}
        className={`group relative flex items-center gap-2.5 px-9 py-3.5 rounded-xl text-[13px] font-semibold transition-all duration-300 shadow-lg ${
          isPremium
            ? 'bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-zinc-900 shadow-amber-900/40'
            : 'bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white shadow-red-900/40'
        }`}
      >
        {isPremium ? 'Step Inside' : 'Begin'}
        <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
      </motion.button>
    </div>
  );
}

WelcomeStep.propTypes = { isPremium: PropTypes.bool.isRequired, onContinue: PropTypes.func.isRequired };

// `is_exclusive` is sourced exclusively from the backend admin panel.
// (Previously this file mirrored a hard-coded override from Podcasts.jsx
// / Discover.jsx for podcast IDs 10 and 4; removed now that the backend
// is the single source of truth.)

// ---------------------------------------------------------------------------
// Screen 2 — Follow Shows + Mature Toggle
// ---------------------------------------------------------------------------
// Category slugs/names that say nothing meaningful about *content* (they're
// access tiers, format tags, mature gates, etc.). Filtered out before we
// build the chip list and before we render per-card genre subtitles, so
// the chip row reflects actual *genres* rather than access plumbing.
const META_CATEGORY_SLUGS = new Set([
  'members', 'members-only', 'exclusive', 'podcast',
  'audiobook', 'audiobooks', 'music', 'mature',
]);
const META_CATEGORY_NAMES = new Set([
  'members', 'members only', 'members-only', 'exclusive', 'podcast',
  'audiobook', 'audiobooks', 'music', 'mature', 'explicit', 'explicit language',
]);

// Pull the structured ``categories`` array off a podcast and return a
// normalized list of ``{slug, name}`` pairs with meta entries filtered
// out. The two members-only shows that were leaking into every chip
// previously did so because the old chip-set ingested both slugs and
// names indiscriminately via ``getPodcastCategorySet``, so a category
// like "Members Only" was hashed under two different keys and could
// accidentally match against either. Using slugs as the single source
// of truth here makes membership tests exact.
function contentCategories(show) {
  const out = [];

  // Walk a single category-shaped value (object {slug, name}, plain
  // string, or null/undefined) and append it to ``out`` if it's a real
  // content genre. Meta / access-tier / format categories drop here so
  // they never appear in the chip row or the per-card subtitle.
  const consider = (c) => {
    let slug = '';
    let name = '';
    if (c && typeof c === 'object') {
      slug = (c.slug || '').toLowerCase();
      name = c.name || '';
    } else if (typeof c === 'string') {
      slug = c.toLowerCase();
      name = c;
    }
    if (!slug && !name) return;
    if (META_CATEGORY_SLUGS.has(slug)) return;
    if (META_CATEGORY_NAMES.has(name.toLowerCase())) return;
    out.push({
      slug: slug || name.toLowerCase().replace(/\s+/g, '-'),
      name: name || slug.replace(/-/g, ' '),
    });
  };

  // Modern many-to-many shape — array of category objects.
  if (Array.isArray(show?.categories)) {
    for (const c of show.categories) consider(c);
  }
  // Legacy single-FK shape — some older podcasts still ship only this
  // and would otherwise drop out of the chip filter entirely.
  if (show?.category) consider(show.category);

  // De-dupe by slug so a category surfaced via both the M2M array and
  // the legacy single FK doesn't double-count in the chip frequency
  // tally.
  const seen = new Set();
  return out.filter(({ slug }) => {
    if (seen.has(slug)) return false;
    seen.add(slug);
    return true;
  });
}

function titleCase(s) {
  if (!s) return '';
  return s.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

// Comma-separated list of up to ``maxCount`` genre names for the per-
// card subtitle. Multiple genres makes it visible at-a-glance why a
// show is matching any particular chip (e.g. "Horror · True Crime").
function genreLabels(show, maxCount = 2) {
  const cats = contentCategories(show);
  if (!cats.length) return '';
  const names = cats
    .slice(0, maxCount)
    .map(({ name, slug }) => name || titleCase(slug.replace(/-/g, ' ')));
  return names.join(' · ');
}

function FollowShowsStep({ onContinue, onSkip }) {
  const { podcasts: rawPodcasts } = usePodcasts();
  const { user, userAge, isPremium, refreshFollowings, refreshUser } = useUser();

  const [localFollowed, setLocalFollowed] = useState(new Set());
  const [loadingIds, setLoadingIds] = useState(new Set());

  // Local mirror of the mature toggle so flipping it re-renders instantly
  // without waiting for the API round-trip + refreshUser() to propagate
  // through context. Stays in sync with the server value.
  //
  // Tri-state on age:
  //   • DOB on file & ≥ 18 → ``isAdult`` true, toggle flips directly
  //   • DOB on file & < 18 → ``isUnderEighteen`` true, toggle is hidden
  //                          (the rest of the platform locks it too)
  //   • no DOB on file     → neither true; toggling ON opens
  //                          ``MatureContentModal`` for self-attestation,
  //                          same flow Settings + Profile use. This is
  //                          the case for every newly-signed-up account
  //                          (we don't collect DOB at signup), so without
  //                          this routing the toggle was effectively
  //                          invisible AND mature shows were silently
  //                          dropped from the picker.
  const isAdult = userAge !== null && userAge >= 18;
  const isUnderEighteen = userAge !== null && userAge < 18;
  const needsAttestation = userAge === null;
  const [matureOn, setMatureOn] = useState(!!user?.allow_mature_content && !isUnderEighteen);
  const [showAttestModal, setShowAttestModal] = useState(false);
  useEffect(() => {
    setMatureOn(!!user?.allow_mature_content && !isUnderEighteen);
  }, [user?.allow_mature_content, isUnderEighteen]);

  // Active filter chips. Empty set = "All" (no narrowing). Multi-select
  // is intentional: "show me Horror AND Sci-Fi" is a more useful
  // discovery affordance than forcing a single bucket.
  const [activeChips, setActiveChips] = useState(() => new Set());

  // Universe of shows surfaced in the picker. Audiobooks and music live
  // on dedicated landing pages and don't belong in a "pick a podcast"
  // interest picker. Non-premium users can't follow exclusive shows
  // through this surface — the Members-Only pitch handles that flow.
  const shows = useMemo(() => {
    let list = (rawPodcasts || []).filter(p => !isAudiobook(p) && !isMusic(p));
    if (!isPremium) list = list.filter(p => !p.is_exclusive);
    return list;
  }, [rawPodcasts, isPremium]);

  // Shows the user will actually see in the picker once the explicit-
  // language toggle is applied. We derive the chip counts (and the
  // "All" total) from this — not from the raw ``shows`` — so the
  // numbers on the chips always equal the size of the list they
  // produce. Showing "Horror · 7" and then rendering 6 cards because
  // the seventh is explicit-and-hidden reads as a bug.
  const visibleShows = useMemo(() => {
    if (matureOn) return shows;
    return shows.filter(s => !isMaturePodcast(s));
  }, [shows, matureOn]);

  // Build the chip list from the visible (mature-aware) catalog,
  // ordered by frequency so the most-represented genres lead. Slugs
  // are the stable Django identifiers; admin renames of the display
  // name won't shuffle the chip keys. Alphabetical tiebreak keeps
  // ordering stable across renders when counts collide.
  const chipCategories = useMemo(() => {
    const counts = new Map();
    for (const show of visibleShows) {
      for (const { slug, name } of contentCategories(show)) {
        const existing = counts.get(slug);
        if (existing) {
          existing.count += 1;
        } else {
          counts.set(slug, { slug, label: name || titleCase(slug.replace(/-/g, ' ')), count: 1 });
        }
      }
    }
    return Array.from(counts.values()).sort(
      (a, b) => (b.count - a.count) || a.label.localeCompare(b.label)
    );
  }, [visibleShows]);

  // The filtered + sorted grid that the user actually sees.
  //
  // Starts from ``visibleShows`` (already mature-gated) so the count
  // shown on the "All" chip and on each genre chip is the exact size
  // of the resulting list — no off-by-one when the explicit toggle is
  // off. Then narrows by chip selection.
  //
  // Sort order applied after the chip filter:
  //   1. Members-Only shows pinned to the top.
  //   2. Most-episode shows next (rough proxy for catalog depth).
  //   3. Alphabetical tiebreak so layout is stable across renders.
  const filteredShows = useMemo(() => {
    let list = visibleShows;

    if (activeChips.size > 0) {
      list = list.filter(s => {
        const cats = contentCategories(s);
        for (const { slug } of cats) {
          if (activeChips.has(slug)) return true;
        }
        return false;
      });
    }

    const sorted = [...list].sort((a, b) => {
      const ax = a.is_exclusive ? 1 : 0;
      const bx = b.is_exclusive ? 1 : 0;
      if (ax !== bx) return bx - ax;
      const ae = Number(a.total_episodes || a.episode_count || 0);
      const be = Number(b.total_episodes || b.episode_count || 0);
      if (ae !== be) return be - ae;
      return (a.title || a.name || '').localeCompare(b.title || b.name || '');
    });
    return sorted;
  }, [visibleShows, activeChips]);

  const toggleChip = useCallback((slug) => {
    setActiveChips(prev => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug); else next.add(slug);
      return next;
    });
  }, []);

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

  const selectedCount = localFollowed.size;
  const selectedLabel = selectedCount === 0
    ? 'No shows yet'
    : `${selectedCount} show${selectedCount === 1 ? '' : 's'} in your library`;

  return (
    <div className="relative flex flex-col h-full">
      {/* Soft top-of-screen wash — same muted-red atmospheric language as
          the home screen's hero. Just enough warmth to keep the picker
          from reading like a settings panel. */}
      <div className="pointer-events-none absolute top-0 inset-x-0 h-72 bg-[radial-gradient(ellipse_at_50%_0%,_rgba(220,38,38,0.07)_0%,_transparent_60%)]" />

      {/* Header ─────────────────────────────────────────────────────── */}
      <div className="relative px-6 pt-6 pb-3 flex-shrink-0">
        <div className="max-w-2xl mx-auto text-center">
          <motion.h1
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            className="font-display text-[26px] sm:text-[30px] font-semibold text-white leading-[1.1] tracking-tight"
          >
            Choose the voices you&rsquo;d like to invite in.
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.18, duration: 0.5 }}
            className="mt-2 text-[13px] text-zinc-500 max-w-md mx-auto"
          >
            Pick a few shows that catch your eye. You can always change your mind in your library.
          </motion.p>

          {!isUnderEighteen && (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.5 }}
              type="button"
              onClick={async () => {
                const next = !matureOn;
                // First-time enable on an account without a DOB on file
                // (every freshly-signed-up account): hand off to the
                // shared MatureContentModal so the user goes through
                // the same self-attestation flow as Settings / Profile.
                // The modal handles the API write + refreshUser itself;
                // our ``matureOn`` mirror catches up via the useEffect
                // that watches ``user.allow_mature_content``.
                if (next && needsAttestation && !user?.allow_mature_content) {
                  setShowAttestModal(true);
                  return;
                }
                setMatureOn(next);
                try {
                  const { User: UserAPI } = await import('@/api/entities');
                  await UserAPI.updateMe({ allow_mature_content: next });
                  await refreshUser();
                } catch (err) {
                  console.error('Failed to update mature content:', err);
                  setMatureOn(!next);
                }
              }}
              aria-pressed={matureOn}
              className={`mt-5 mx-auto flex items-center gap-2.5 rounded-full border px-3.5 py-1.5 transition-colors ${
                matureOn
                  ? 'bg-red-500/[0.08] border-red-500/30 hover:bg-red-500/[0.12]'
                  : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04]'
              }`}
            >
              <Moon className={`w-3 h-3 flex-shrink-0 transition-colors ${matureOn ? 'text-red-300' : 'text-zinc-500'}`} />
              <span className={`text-[11px] tracking-wide ${matureOn ? 'text-red-100/90' : 'text-zinc-400'}`}>
                Reveal Shows with Explicit Language
              </span>
              <div
                className={`relative w-7 h-[14px] rounded-full transition-all duration-300 flex-shrink-0 ${
                  matureOn ? 'bg-red-500' : 'bg-zinc-700'
                }`}
              >
                <div
                  className={`absolute top-[2px] w-[10px] h-[10px] rounded-full bg-white shadow-sm transition-all duration-300 ${
                    matureOn ? 'left-[15px]' : 'left-[2px]'
                  }`}
                />
              </div>
            </motion.button>
          )}
        </div>
      </div>

      {/* Filter chip row ────────────────────────────────────────────── */}
      {chipCategories.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.45 }}
          className="relative flex-shrink-0 px-6 mt-2"
        >
          <div
            className="flex gap-2 overflow-x-auto pb-2 -mx-6 px-6"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            <FilterChip
              active={activeChips.size === 0}
              onClick={() => setActiveChips(new Set())}
              label="All"
              count={visibleShows.length}
            />
            {chipCategories.map(({ slug, label, count }) => (
              <FilterChip
                key={slug}
                active={activeChips.has(slug)}
                onClick={() => toggleChip(slug)}
                label={label}
                count={count}
              />
            ))}
          </div>
        </motion.div>
      )}

      {/* Grid ───────────────────────────────────────────────────────── */}
      <div className="relative flex-1 overflow-y-auto px-6 pt-2 pb-6">
        {filteredShows.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-w-4xl mx-auto">
            {filteredShows.map((show, i) => (
              <OnboardingShowCard
                key={show.id}
                show={show}
                isFollowing={localFollowed.has(Number(show.id))}
                isLoading={loadingIds.has(Number(show.id))}
                onToggle={() => handleToggleFollow(show.id)}
                entryDelay={Math.min(0.45 + i * 0.025, 0.85)}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-center py-20">
            <p className="font-eerie text-[22px] text-zinc-400">
              Nothing in this corner of the catalog yet.
            </p>
            <p className="mt-2 text-[12px] text-zinc-600">
              Try another chip — or clear them all to see everything.
            </p>
            {activeChips.size > 0 && (
              <button
                type="button"
                onClick={() => setActiveChips(new Set())}
                className="mt-4 text-[11px] uppercase tracking-[0.15em] font-semibold text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                Clear filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* Selection anchor ───────────────────────────────────────────── */}
      <div className="relative flex-shrink-0 px-6 py-4 flex items-center justify-between gap-3 border-t border-white/[0.04] bg-black/30 backdrop-blur-sm">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onSkip}
            className="text-[11px] uppercase tracking-[0.14em] text-zinc-500 hover:text-zinc-300 transition-colors flex-shrink-0"
          >
            Skip for now
          </button>
          <div className="hidden sm:block w-px h-4 bg-white/[0.06]" />
          <span className={`hidden sm:inline text-[12px] truncate ${
            selectedCount > 0 ? 'text-zinc-300' : 'text-zinc-600'
          }`}>
            {selectedLabel}
          </span>
        </div>
        <button
          type="button"
          onClick={onContinue}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-semibold transition-all duration-300 ${
            selectedCount > 0
              ? 'bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white shadow-lg shadow-red-900/40'
              : 'bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] text-white'
          }`}
        >
          Continue
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Self-attestation modal — same component used by Settings and
          Profile. When the toggle is flipped ON for an account without
          a DOB on file (i.e. every freshly-signed-up account), this is
          how we collect the 18+ confirmation before the backend will
          accept ``allow_mature_content: true``.
          
          The onboarding overlay sits at z-[10300]; the Dialog component
          defaults to z-[10200], which would render the modal *behind*
          the onboarding canvas and make it invisible. We bump both the
          overlay and content to z-[10400] so this instance stacks
          correctly above the onboarding. Other call sites (Settings,
          Profile, Player) don't pass these props and keep the default. */}
      <MatureContentModal
        isOpen={showAttestModal}
        onClose={() => setShowAttestModal(false)}
        onContinue={() => setShowAttestModal(false)}
        contentClassName="z-[10400]"
        overlayClassName="z-[10400]"
      />
    </div>
  );
}

function FilterChip({ active, onClick, label, count }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`group flex-shrink-0 inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] transition-all duration-200 border ${
        active
          ? 'bg-red-500/[0.12] border-red-400/40 text-red-100 shadow-[0_0_0_3px_rgba(220,38,38,0.06)]'
          : 'bg-white/[0.03] border-white/[0.08] text-zinc-400 hover:bg-white/[0.06] hover:border-white/[0.16] hover:text-zinc-200'
      }`}
    >
      <span className="font-medium">{label}</span>
      {count != null && (
        <span className={`text-[10px] tabular-nums ${active ? 'text-red-300/80' : 'text-zinc-600 group-hover:text-zinc-500'}`}>
          {count}
        </span>
      )}
    </button>
  );
}

FilterChip.propTypes = {
  active: PropTypes.bool.isRequired,
  onClick: PropTypes.func.isRequired,
  label: PropTypes.string.isRequired,
  count: PropTypes.number,
};

// Per-card sub-component for the FollowShowsStep grid.
//
// Pulled out of the inline ``filteredShows.map(...)`` so each card can
// maintain its OWN follow / unfollow burst counters without re-running
// motion on neighboring cards every time the parent re-renders. The
// shape (cover · title · subtitle) is unchanged from before — what's
// new is the four layers of motion on the follow indicator:
//
//   1. Indicator bloom — the heart/check container scales 1 → 1.18 →
//      0.96 → 1 on each successful follow, with a quick squish (1 →
//      0.85 → 1) on unfollow. Built with ``animate={[...]}`` keyframes
//      so the animation re-fires whenever the burst key flips.
//   2. Pulse ring — a single red ring expands and fades out from the
//      indicator the instant a follow lands. Mounted with key={
//      followBurst} so it remounts and re-runs on every follow event.
//   3. Icon swap — ``AnimatePresence mode="wait"`` rotates and scales
//      the heart out and the check in (and vice versa) so the symbolic
//      change carries motion of its own, not just a static swap.
//   4. Cover dim — the cover briefly desaturates and fades on unfollow,
//      giving the act of removal a small, deliberate beat that mirrors
//      the celebratory pulse on follow.
function OnboardingShowCard({ show, isFollowing, isLoading, onToggle, entryDelay }) {
  const genres = genreLabels(show);
  const epCount = show.episode_count ?? show.total_episodes ?? null;

  // Burst counters — each increments only when the follow state crosses
  // its respective threshold (false→true for follow, true→false for
  // unfollow). The previous-state ref keeps useEffect from re-firing
  // when other props change without the follow state itself flipping.
  const [followBurst, setFollowBurst] = useState(0);
  const [unfollowBurst, setUnfollowBurst] = useState(0);
  const prevFollowingRef = useRef(isFollowing);
  useEffect(() => {
    if (isFollowing !== prevFollowingRef.current) {
      if (isFollowing) setFollowBurst(k => k + 1);
      else setUnfollowBurst(k => k + 1);
      prevFollowingRef.current = isFollowing;
    }
  }, [isFollowing]);

  // ``indicatorAnim`` keyframes the container's scale and box-shadow
  // depending on the most recent burst. When neither has fired we stay
  // at rest (scale 1, no shadow) regardless of follow state, so the
  // initial card mount doesn't visibly pulse.
  const totalBursts = followBurst + unfollowBurst;
  const indicatorAnim = followBurst > 0 && isFollowing
    ? { scale: [1, 1.22, 0.94, 1] }
    : unfollowBurst > 0 && !isFollowing
      ? { scale: [1, 0.82, 1.04, 1] }
      : { scale: 1 };

  return (
    <motion.button
      type="button"
      onClick={onToggle}
      disabled={isLoading}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: entryDelay, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className={`group relative text-left rounded-2xl overflow-hidden transition-all duration-300 border ${
        isFollowing
          ? 'border-red-500/40 shadow-[0_0_0_3px_rgba(220,38,38,0.10)]'
          : 'border-white/[0.06] hover:border-white/[0.14]'
      } ${isLoading ? 'opacity-60' : ''}`}
    >
      {/* Cover */}
      <div className="relative aspect-square bg-zinc-900 overflow-hidden">
        {/* Cover dim — a brief desaturate-and-fade on unfollow only.
            Keyed to ``unfollowBurst`` so it remounts and replays on
            every unfollow event; renders nothing until the user has
            actually unfollowed at least once. */}
        {unfollowBurst > 0 && (
          <motion.div
            key={`dim-${unfollowBurst}`}
            aria-hidden
            className="absolute inset-0 z-[2] bg-black pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.5, 0] }}
            transition={{ duration: 0.45, ease: 'easeOut', times: [0, 0.35, 1] }}
          />
        )}

        {show.cover_image ? (
          <img
            src={show.cover_image}
            alt=""
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-zinc-800 to-zinc-900" />
        )}

        {/* Bottom-fade so the title pill stays legible against bright
            cover art. */}
        <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/85 via-black/40 to-transparent" />

        {/* Members-Only pill (top-left). For premium users the pinned
            "members at top" sort already telegraphs this; the pill is
            the visual confirmation. */}
        {show.is_exclusive && (
          <div className="absolute top-2 left-2 z-[3] flex items-center gap-1 px-1.5 py-0.5 bg-black/70 backdrop-blur-sm border border-amber-400/40 rounded-full">
            <Crown className="w-2.5 h-2.5 text-amber-300" />
            <span className="text-[9px] font-semibold tracking-wider uppercase text-amber-200">
              Members
            </span>
          </div>
        )}

        {/* Follow indicator (top-right). */}
        <div className="absolute top-2 right-2 z-[3] w-8 h-8">
          {/* Pulse ring — one-shot ring expansion on the moment of
              follow. Mounted with key={followBurst} so each new follow
              event spawns a fresh ring that animates and unmounts. */}
          {followBurst > 0 && (
            <motion.div
              key={`ring-${followBurst}`}
              aria-hidden
              className="absolute inset-0 rounded-full border-2 border-red-400 pointer-events-none"
              initial={{ scale: 1, opacity: 0.7 }}
              animate={{ scale: 2.1, opacity: 0 }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            />
          )}
          {/* Secondary, slower ring for a fuller bloom on follow. */}
          {followBurst > 0 && (
            <motion.div
              key={`ring2-${followBurst}`}
              aria-hidden
              className="absolute inset-0 rounded-full border border-red-400/60 pointer-events-none"
              initial={{ scale: 1, opacity: 0.5 }}
              animate={{ scale: 2.8, opacity: 0 }}
              transition={{ duration: 1.0, ease: [0.22, 1, 0.36, 1], delay: 0.05 }}
            />
          )}

          {/* The indicator itself. ``animate`` keyframes drive the
              bloom/squish; the ``key`` derived from totalBursts forces
              the motion to retrigger even when the keyframe array
              hasn't changed shape (e.g. user rapid-clicks the same
              card twice). */}
          <motion.div
            key={`ind-${totalBursts}`}
            animate={indicatorAnim}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className={`relative w-8 h-8 rounded-full flex items-center justify-center transition-colors duration-300 ${
              isFollowing
                ? 'bg-red-500/95 shadow-[0_0_18px_rgba(220,38,38,0.55)]'
                : 'bg-black/55 backdrop-blur-sm border border-white/15 group-hover:border-white/30'
            }`}
          >
            <AnimatePresence mode="wait" initial={false}>
              {isFollowing ? (
                <motion.span
                  key="check"
                  initial={{ scale: 0, rotate: -45, opacity: 0 }}
                  animate={{ scale: 1, rotate: 0, opacity: 1 }}
                  exit={{ scale: 0, rotate: 45, opacity: 0 }}
                  transition={{ type: 'spring', damping: 14, stiffness: 380 }}
                  className="absolute inset-0 flex items-center justify-center"
                >
                  <Check className="w-4 h-4 text-white" strokeWidth={3} />
                </motion.span>
              ) : (
                <motion.span
                  key="heart"
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.6, opacity: 0 }}
                  transition={{ type: 'spring', damping: 16, stiffness: 360 }}
                  className="absolute inset-0 flex items-center justify-center"
                >
                  <Heart className="w-4 h-4 text-white/85" />
                </motion.span>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </div>

      {/* Caption */}
      <div className="px-3 py-2.5 bg-black/40 backdrop-blur-[2px]">
        <p className="font-display text-[13px] font-semibold text-white leading-snug line-clamp-1">
          {show.title || show.name}
        </p>
        <p className="mt-0.5 text-[10.5px] text-zinc-500 leading-tight line-clamp-1">
          {[genres, epCount != null ? `${epCount} episode${epCount === 1 ? '' : 's'}` : null]
            .filter(Boolean)
            .join(' · ')}
        </p>
      </div>
    </motion.button>
  );
}

OnboardingShowCard.propTypes = {
  show: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    title: PropTypes.string,
    name: PropTypes.string,
    cover_image: PropTypes.string,
    is_exclusive: PropTypes.bool,
    episode_count: PropTypes.number,
    total_episodes: PropTypes.number,
  }).isRequired,
  isFollowing: PropTypes.bool.isRequired,
  isLoading: PropTypes.bool.isRequired,
  onToggle: PropTypes.func.isRequired,
  entryDelay: PropTypes.number.isRequired,
};

FollowShowsStep.propTypes = { onContinue: PropTypes.func.isRequired, onSkip: PropTypes.func.isRequired };

// ---------------------------------------------------------------------------
// Screen 3 (Free) — Premium Upsell
// ---------------------------------------------------------------------------
function PremiumUpsellStep({ onComplete }) {
  const [showPayment, setShowPayment] = useState(false);
  // Yearly is the default selection — it's the better deal for the
  // user (~27% off) and the better unit-economics outcome for us, so
  // it's the one we lead with on the upsell. Users who'd rather pay
  // monthly can still tap the monthly card; the visual treatment
  // makes both cards unambiguously clickable while still nudging
  // toward the annual plan.
  const [selectedPlan, setSelectedPlan] = useState('yearly');
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
    // Outer scroll container. The inner ``min-h-full + justify-center``
    // pattern means: on tall screens the content centers vertically with
    // breathing room; on shorter screens (or screens where the on-screen
    // keyboard pushes the viewport down) the content overflows and the
    // user can scroll instead of having the top/bottom of the offer
    // silently chopped off — which is what was happening before.
    <div className="relative h-full overflow-y-auto">
      <div className="relative min-h-full flex flex-col items-center justify-center px-6 py-8 text-center">
        {/* Single soft radial wash. The old layout stacked this against
            a haloed Crown badge + a glowing CTA + a plan picker with
            its own drop shadow — too many simultaneous focal points.
            With the Crown icon-tile removed, the headline becomes the
            visual anchor and everything else supports it. */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_25%,_rgba(220,38,38,0.07)_0%,_transparent_55%)]" />

        {/* Trial badge — promoted from a zinc-500 footnote ("Try 7 days
            free. Cancel anytime.") to the sales-leading element it has
            always been. This is the highest-converting copy on the
            page; it gets the strongest typographic treatment short of
            the headline. */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          className="relative flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/[0.10] border border-amber-400/30 mb-5"
        >
          <div className="w-1.5 h-1.5 rounded-full bg-amber-300 shadow-[0_0_8px_rgba(251,191,36,0.7)] animate-pulse" />
          <span className="text-[11px] font-semibold tracking-[0.18em] uppercase text-amber-200">
            7 days free · cancel anytime
          </span>
        </motion.div>

        {/* Split headline. Putting the Pirata One accent on its own
            line avoids the awkward mid-line wrap that happens when
            "Step inside" + "the inner circle" share a flow box at
            narrow widths (and Pirata One's wider glyphs make that
            wrap likely on anything under ~480px). */}
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
          className="relative font-display font-semibold text-white tracking-tight leading-[1.05]"
        >
          <span className="block text-[24px] sm:text-[30px]">Step inside</span>
          <span className="block mt-1 font-eerie text-[32px] sm:text-[40px] tracking-wide text-amber-200/95">
            the inner circle
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.55 }}
          className="relative mt-4 text-[13px] text-zinc-400 max-w-sm mb-7 leading-relaxed"
        >
          Every show ad-free, the audiobook stacks unlocked, and the corners of the catalog members are reading first.
        </motion.p>

        <div className="relative w-full max-w-xs space-y-2 mb-7">
          {perks.map((p, i) => (
            <motion.div
              key={p.text}
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.55 + i * 0.06, duration: 0.45 }}
              className="flex items-center gap-3 text-left"
            >
              <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                <p.icon className="w-3.5 h-3.5 text-amber-400" />
              </div>
              <span className="text-[13px] text-zinc-300">{p.text}</span>
            </motion.div>
          ))}
        </div>

      {/* Plan picker — proper tappable cards instead of flat text
          toggles. Each card has a real border, padding, and a
          hover state so they read as buttons even when unselected.
          Yearly is rendered first and ships pre-selected; the
          "BEST VALUE" pill, the amber accent ring on the
          selected state, and the per-month savings line all push
          toward yearly without making monthly look like a
          second-class citizen. */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.9, duration: 0.5 }}
        className="relative w-full max-w-xs grid grid-cols-2 gap-2.5 mb-5"
        role="radiogroup"
        aria-label="Choose a billing period"
      >
        {/* Yearly — recommended */}
        <button
          type="button"
          role="radio"
          aria-checked={selectedPlan === 'yearly'}
          onClick={() => setSelectedPlan('yearly')}
          className={`relative text-left rounded-xl px-3 pt-3 pb-2.5 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60 ${
            selectedPlan === 'yearly'
              ? 'bg-amber-500/[0.10] border border-amber-400/60 shadow-[0_0_0_3px_rgba(251,191,36,0.12)]'
              : 'bg-white/[0.03] border border-white/[0.10] hover:bg-white/[0.05] hover:border-white/[0.18]'
          }`}
        >
          <span
            className={`absolute -top-2 right-2 px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wider uppercase ${
              selectedPlan === 'yearly'
                ? 'bg-amber-400 text-zinc-900'
                : 'bg-amber-500/20 text-amber-300 border border-amber-400/30'
            }`}
          >
            Best Value
          </span>
          <div className={`text-[10px] font-semibold tracking-[0.14em] uppercase ${
            selectedPlan === 'yearly' ? 'text-amber-300' : 'text-zinc-400'
          }`}>
            Yearly
          </div>
          <div className="mt-1 text-white text-base font-bold leading-none">
            $69.96<span className="text-zinc-500 text-xs font-medium">/yr</span>
          </div>
          <div className={`mt-1 text-[11px] leading-tight ${
            selectedPlan === 'yearly' ? 'text-emerald-300' : 'text-emerald-400/80'
          }`}>
            $5.83/mo · Save 27%
          </div>
        </button>

        {/* Monthly */}
        <button
          type="button"
          role="radio"
          aria-checked={selectedPlan === 'monthly'}
          onClick={() => setSelectedPlan('monthly')}
          className={`relative text-left rounded-xl px-3 pt-3 pb-2.5 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 ${
            selectedPlan === 'monthly'
              ? 'bg-white/[0.08] border border-white/[0.30] shadow-[0_0_0_3px_rgba(255,255,255,0.06)]'
              : 'bg-white/[0.03] border border-white/[0.10] hover:bg-white/[0.05] hover:border-white/[0.18]'
          }`}
        >
          <div className={`text-[10px] font-semibold tracking-[0.14em] uppercase ${
            selectedPlan === 'monthly' ? 'text-white' : 'text-zinc-400'
          }`}>
            Monthly
          </div>
          <div className="mt-1 text-white text-base font-bold leading-none">
            $7.99<span className="text-zinc-500 text-xs font-medium">/mo</span>
          </div>
          <div className="mt-1 text-[11px] leading-tight text-zinc-500">
            Billed monthly
          </div>
        </button>
      </motion.div>

        <motion.button
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.05, duration: 0.5 }}
          onClick={() => setShowPayment(true)}
          className="group relative w-full max-w-xs bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-semibold py-3.5 rounded-xl shadow-lg shadow-red-900/40 transition-all duration-300 text-[13px] flex items-center justify-center gap-2"
        >
          Start Free Trial
          <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
        </motion.button>

        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2, duration: 0.5 }}
          onClick={onComplete}
          className="relative mt-4 text-[11px] uppercase tracking-[0.15em] text-zinc-600 hover:text-zinc-400 transition-colors"
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

  // Embers float up from the bottom of the screen and fade out before
  // they reach the header. The travel distance is capped at roughly the
  // viewport height (with a soft random spread) so embers don't visibly
  // disappear into the StepDots row — the old implementation used a
  // flat 400–700px range which leaked through the chrome on tall
  // screens. ``opacity`` fades back to 0 just before the cap, so even
  // on screens taller than 700px there's no abrupt termination.
  const embers = useMemo(() =>
    Array.from({ length: 32 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      size: 1.5 + Math.random() * 2.5,
      delay: Math.random() * 4,
      duration: 5 + Math.random() * 4,
      opacity: 0.18 + Math.random() * 0.45,
      drift: -22 + Math.random() * 44,
      // Travel range as a viewport-height fraction. 60–80vh keeps every
      // ember well below the top of the screen, so the fade-out happens
      // mid-flight rather than at a hard ceiling.
      rise: 60 + Math.random() * 20,
    })),
  []);

  return (
    <div className="relative flex flex-col items-center justify-center h-full px-6 text-center overflow-hidden">
      {/* Two radial washes stacked — the lower red one anchors the
          embers' light source; the upper amber wash softens the
          headline area. Layered rather than blended so the brand reads
          warm without going orange. */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_75%,_rgba(220,38,38,0.10)_0%,_transparent_55%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_25%,_rgba(180,83,9,0.06)_0%,_transparent_45%)]" />
      {/* Soft horizon vignette — pushes the lower portion of the screen
          deeper so the embers feel like they're rising out of darkness
          rather than from the page itself. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/45 via-black/15 to-transparent" />

      {embers.map((e) => (
        <motion.div
          key={e.id}
          className="absolute rounded-full pointer-events-none"
          style={{
            width: e.size,
            height: e.size,
            left: `${e.x}%`,
            bottom: '-2%',
            background: `radial-gradient(circle, rgba(239,68,68,${e.opacity}) 0%, rgba(251,146,60,${e.opacity * 0.55}) 60%, transparent 100%)`,
            boxShadow: `0 0 ${e.size * 2}px rgba(239,68,68,${e.opacity * 0.4})`,
          }}
          animate={{
            y: [`0vh`, `-${e.rise}vh`],
            x: [0, e.drift],
            // Quick fade-in, long sustain, then fade-out *before* the
            // ember reaches the cap so the disappearance reads as the
            // ember dying out, not as a hard cutoff.
            opacity: [0, e.opacity, e.opacity, 0],
          }}
          transition={{
            duration: e.duration,
            delay: e.delay,
            repeat: Infinity,
            ease: 'linear',
            times: [0, 0.15, 0.75, 1],
          }}
        />
      ))}

      {/* Crown — the same membership iconography used throughout the
          flow. Earlier drafts tried a hairline-ring-with-glowing-dot
          as a "quieter" symbol but it ended up reading as a UI dot,
          not a celebration. Crown is the brand's membership symbol;
          this is the moment to land on it. */}
      <motion.div
        initial={{ opacity: 0, scale: 0.85, y: -6 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.95, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
        className="relative mb-7"
      >
        <motion.div
          aria-hidden
          animate={{ scale: [1, 1.2, 1], opacity: [0.35, 0.6, 0.35] }}
          transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute inset-0 -m-6 rounded-full bg-amber-500/15 blur-2xl"
        />
        <Crown className="relative w-12 h-12 text-amber-300" strokeWidth={1.4} />
      </motion.div>

      {/* Headline split across two lines: a name-led greeting and a
          font-eerie accent for "the inner circle." The accent does the
          atmospheric work; the greeting does the personalization. */}
      <motion.h1
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="font-display text-[28px] sm:text-[34px] leading-[1.1] font-semibold text-white tracking-tight"
      >
        Thank you, {username}.
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.55, duration: 0.65 }}
        className="mt-4 text-zinc-400 text-[15px] leading-snug"
      >
        Welcome to{' '}
        <span className="font-eerie text-[28px] sm:text-[32px] tracking-wide text-amber-200/95 align-middle">
          the inner circle
        </span>
        .
      </motion.p>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8, duration: 0.55 }}
        className="mt-6 text-[12.5px] text-zinc-500 max-w-[300px] leading-relaxed mb-10"
      >
        Your membership keeps the lights on for the creators who bring these stories to life. We&rsquo;re glad you&rsquo;re here.
      </motion.p>

      <motion.button
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.0, duration: 0.5 }}
        onClick={onComplete}
        className="group flex items-center gap-2.5 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-semibold px-8 py-3.5 rounded-xl shadow-lg shadow-red-900/40 transition-all duration-300 text-[13px]"
      >
        <Play className="w-4 h-4 fill-white transition-transform group-hover:scale-110" />
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
  // The original three-paragraph wall buried the kernel ("you have free
  // time on the house, here's what changes") under repeated thank-yous.
  // The redesign promotes the gift to the visual hook, compresses the
  // policy into a single supporting line, and surfaces the two
  // operational changes as a quiet what-changes list — instead of
  // burying them in body copy a returning member is unlikely to read
  // in full.
  const duration = planType === 'yearly' ? 'a year' : '60 days';

  return (
    <div className="relative flex flex-col items-center justify-center h-full px-6 text-center overflow-hidden">
      <FrontDoorBackdrop isPremium />

      {/* Sigil — same atmospheric language as the WelcomeStep, swapped
          to a Heart for the gratitude beat. */}
      <motion.div
        initial={{ opacity: 0, y: -12, scale: 0.92 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
        className="relative mb-7"
      >
        <motion.div
          aria-hidden
          animate={{ opacity: [0.35, 0.6, 0.35] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute inset-0 -m-6 rounded-full blur-2xl bg-amber-500/15"
        />
        <Heart className="relative w-10 h-10 text-amber-300/90" strokeWidth={1.5} />
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
        className="font-display text-[30px] sm:text-[36px] leading-[1.08] font-semibold text-white tracking-tight max-w-[20ch]"
      >
        Welcome back. We&rsquo;ve saved your seat.
      </motion.h1>

      {/* The gift — promoted from a bold span buried in body copy to a
          full-width display flourish in font-eerie. Reads as a gesture
          rather than a transaction. */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.45, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="mt-6 mb-5 flex items-baseline gap-3"
      >
        <span className="text-[11px] uppercase tracking-[0.22em] text-amber-300/80 font-semibold">
          On us
        </span>
        <span className="font-eerie text-[44px] sm:text-[52px] text-amber-200 leading-none tracking-tight">
          {duration} free
        </span>
      </motion.div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6, duration: 0.55 }}
        className="text-[13px] text-zinc-400 max-w-md leading-relaxed mb-7"
      >
        Thanks for sticking with us through the move to our new platform.
        Your access carries over — nothing to set up.
      </motion.p>

      {/* The two operational changes, rendered as a quiet two-row list
          rather than a paragraph. Members who skim still leave knowing
          (a) auto-billing on the legacy site is off, and (b) they'll
          choose a plan if they decide to stay. */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.78, duration: 0.55 }}
        className="w-full max-w-sm space-y-2 mb-10 text-left"
      >
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-white/[0.025] border border-white/[0.05]">
          <Check className="w-3.5 h-3.5 text-amber-300 mt-[3px] flex-shrink-0" strokeWidth={2.5} />
          <p className="text-[12.5px] text-zinc-300 leading-snug">
            The old site won&rsquo;t bill you again. That auto-renewal is off.
          </p>
        </div>
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-white/[0.025] border border-white/[0.05]">
          <Check className="w-3.5 h-3.5 text-amber-300 mt-[3px] flex-shrink-0" strokeWidth={2.5} />
          <p className="text-[12.5px] text-zinc-300 leading-snug">
            Like what you find? Choose a plan when your free time ends — no surprise charges before then.
          </p>
        </div>
      </motion.div>

      <motion.button
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.0, duration: 0.5 }}
        onClick={onContinue}
        className="group relative flex items-center gap-2.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-zinc-900 font-semibold px-8 py-3.5 rounded-xl transition-all duration-300 text-[13px] shadow-lg shadow-amber-900/40"
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
      className="fixed inset-0 z-[10300] bg-[#0A0A12] flex flex-col"
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
