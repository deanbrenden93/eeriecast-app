/* eslint-disable no-undef, no-unused-vars */
import { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import PropTypes from 'prop-types';
import { useAudioPlayer } from '@/hooks/use-audio-player';
import { audioTimeStore } from '@/hooks/use-audio-time';
import { useMediaSession } from '@/hooks/use-media-session';
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';
import { getEpisodeAudioUrl, isAudiobook, isMusic, hasCategory, isMaturePodcast } from '@/lib/utils';
import { getSetting } from '@/hooks/use-settings';
import { useUser } from '@/context/UserContext.jsx';
import { usePodcasts } from '@/context/PodcastContext.jsx';
import { canAccessChapter, canAccessExclusiveEpisode, FREE_LISTEN_CHAPTER_LIMIT } from '@/lib/freeTier';
import { createPageUrl } from '@/utils';
import MobilePlayer from '@/components/podcasts/MobilePlayer';
import ExpandedPlayer from '@/components/podcasts/ExpandedPlayer';
import MatureContentModal from '@/components/MatureContentModal';
import { AnimatePresence, motion } from 'framer-motion';

const AudioPlayerContext = createContext();

// Routes where the mini player should never appear
const PLAYER_HIDDEN_ROUTES = new Set(['/', '/home', '/premium']);

// ─── Hoisted motion variants for the player wrappers ──────────────────
// Hoisted so framer-motion sees stable prop identities across renders.
//
// IMPORTANT: these animations animate **transform only** (`y`) — not
// opacity — for two reasons:
//
//   1. Both player surfaces sit on `backdrop-filter: blur()` (the
//      mini player's `.eeriecast-glass`, the pill's
//      `backdrop-blur-xl`, the expanded player's blurred orbs and
//      any glassy header chrome). Animating opacity on a
//      backdrop-blurred element forces the browser to re-blur the
//      underlying layer every frame at the new alpha — one of the
//      most expensive operations in modern browsers and the cause
//      of the open/close stutter the user reported.
//
//   2. A pure-transform slide is GPU-composited from a cached
//      bitmap. The work per frame is essentially constant
//      regardless of how heavy the player content is.
//
// We add `willChange: 'transform'` to the inline style so the
// browser pre-commits a compositor layer for these surfaces and
// doesn't have to discover one mid-animation.
const EXPANDED_PLAYER_INITIAL = { y: '100%' };
const EXPANDED_PLAYER_ANIMATE = { y: 0 };
const EXPANDED_PLAYER_EXIT = { y: '100%' };
const EXPANDED_PLAYER_TRANSITION = {
  type: 'tween',
  duration: 0.36,
  ease: [0.32, 0.72, 0, 1],
};
const EXPANDED_PLAYER_STYLE = {
  position: 'fixed',
  inset: 0,
  zIndex: 10100,
  willChange: 'transform',
};

// The mini-player wrapper must NOT have `transform` or
// `will-change: transform`. Per the CSS spec both of those make
// the element a containing block for `position:fixed` descendants
// — and the inner mini-full / pill are themselves position:fixed.
// On iOS Safari and mobile Chrome, when the URL bar collapses /
// expands during scroll, the visual viewport changes faster than
// the layout viewport this wrapper's `inset: 0` box is sized
// against; that lag is exactly what produced the "gap below /
// overlap above" the user reported during scroll. The bottom nav
// is rock-solid in the same scenarios because it's just
// `position: fixed; bottom: 0` with no transformed ancestor —
// we deliberately mirror that here (no framer-motion wrapper, no
// transform, no will-change) so the mini player tracks the
// visual viewport directly. The inner pill / mini-full keep
// their tiny pill ↔ restore micro-transition because that
// transform is on the position:fixed element itself, which can't
// affect its own viewport-relative positioning.
//
// `pointer-events: none` keeps the otherwise-empty full-viewport
// surface from swallowing clicks on the page underneath; the
// actual interactive bits inside MobilePlayer add
// `pointer-events: auto` for themselves.
//
// `z-40` (and the `[html.ereader-active_&]:z-[10080]` arbitrary
// variant on the wrapper className) live here on the wrapper as
// an authoritative stacking-context anchor for the player layer,
// so the inner pill/mini-full's z-index can never accidentally
// sit below page chrome.
const MOBILE_PLAYER_STYLE = {
  position: 'fixed',
  inset: 0,
  pointerEvents: 'none',
};

// ─── End-of-queue autoplay fallback ────────────────────────────────
// Resolves what to play after the queue has been exhausted, based on
// the user's per-content-type autoplay preference. Returns either a
// `{ podcast, episode }` pair to play next or `null` to stop.
//
// Safety filters applied to every candidate:
//   • Free-tier: locked exclusive non-samples, audiobook chapters past
//     the free limit, and bonus `is_premium` episodes are excluded so
//     autoplay can never silently trip the paywall.
//   • Mature content: skipped for users who haven't opted in
//     (random_any only — same-show fallbacks stay on the show the
//     user is already listening to, which they've already cleared).
//   • Audio availability: episodes with no playable URL are skipped
//     so we never queue a track that just sits there silent.

const epDate = (e) =>
  new Date(
    e?.created_date || e?.published_at || e?.release_date || 0,
  ).getTime();

// Detail payloads come back two ways depending on which serializer the
// backend used: either a flat array or a paginated `{ results: [...] }`
// envelope. Normalize so callers always get a real array.
function getEpisodeArray(podcast) {
  const raw = podcast?.episodes;
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.results)) return raw.results;
  return [];
}

function hasPlayableAudio(ep) {
  try {
    return !!getEpisodeAudioUrl(ep);
  } catch {
    return false;
  }
}

function isEpisodeAccessibleToFree(podcast, episode, isAudiobookContent) {
  if (!episode) return false;
  if (isAudiobookContent) {
    // Chapter-based gating: caller must check by index. We can only
    // approve "this is a chapter" here; index check happens upstream.
    return true;
  }
  if (podcast?.is_exclusive) {
    return canAccessExclusiveEpisode(episode, podcast, false);
  }
  if (episode.is_premium) return false;
  return true;
}

async function resolveAutoplayFallback({
  mode,
  currentPodcast,
  currentEpisode,
  isAudiobookContent,
  isMusicContent,
  isPremium,
  canViewMature,
  ensureDetail,
  catalog,
}) {
  if (!mode || mode === 'none') return null;
  if (!currentPodcast?.id || !currentEpisode?.id) return null;
  if (typeof ensureDetail !== 'function') return null;

  // ── Audiobook: only meaningful fallback is "next chapter of same book"
  if (isAudiobookContent) {
    if (mode !== 'next_chapter') return null;
    const detail = await ensureDetail(currentPodcast.id).catch(() => null);
    const eps = getEpisodeArray(detail)
      .slice()
      .sort((a, b) => epDate(a) - epDate(b)); // chapter order = oldest-first
    const i = eps.findIndex(
      (e) => Number(e?.id) === Number(currentEpisode.id),
    );
    if (i < 0 || i + 1 >= eps.length) return null;
    const next = eps[i + 1];
    if (!hasPlayableAudio(next)) return null;
    // Free users can't roll past the free chapter limit
    if (!isPremium && !canAccessChapter(i + 1, false, FREE_LISTEN_CHAPTER_LIMIT)) {
      return null;
    }
    return { podcast: detail || currentPodcast, episode: next };
  }

  // ── Random from any matching show in the catalog
  if (mode === 'random_any') {
    const pool = (catalog || []).filter((p) => {
      if (!p?.id) return false;
      if (Number(p.id) === Number(currentPodcast.id)) return false; // exclude current show
      // Mature gate: never autoplay-roll into mature content for a
      // listener who hasn't opted in.
      if (!canViewMature && isMaturePodcast(p)) return false;
      const pAudio = isAudiobook(p);
      const pMusic = isMusic(p);
      const pPodcast = !pAudio && !pMusic;
      if (isMusicContent) return pMusic;
      return pPodcast; // regular podcasts only
    });
    if (!pool.length) return null;
    // Try up to 6 different shows; some catalog entries are list-payload
    // shells with no episodes hydrated yet, in which case ensureDetail
    // brings back the full set on demand.
    const shuffled = pool.slice().sort(() => Math.random() - 0.5);
    for (const candidate of shuffled.slice(0, 6)) {
      // Free users: skip exclusive shows entirely — even if a few
      // sample episodes exist, surprise-rolling into a members-only
      // show right after a free episode ends feels like a bait
      // switch. Random-any should stay on shows the user can binge.
      if (!isPremium && candidate.is_exclusive) continue;
      const detail = await ensureDetail(candidate.id).catch(() => null);
      if (!detail) continue;
      const allEps = getEpisodeArray(detail);
      const playable = allEps.filter((e) => {
        if (!e?.id) return false;
        if (!hasPlayableAudio(e)) return false;
        if (!isPremium && !isEpisodeAccessibleToFree(detail, e, false)) return false;
        return true;
      });
      if (!playable.length) continue;
      const next = playable[Math.floor(Math.random() * playable.length)];
      return { podcast: detail, episode: next };
    }
    return null;
  }

  // ── Same-show fallbacks (next-newest / next-oldest / random_same_show)
  const detail = await ensureDetail(currentPodcast.id).catch(() => null);
  const allEps = getEpisodeArray(detail);
  const playable = allEps.filter((e) => {
    if (!e?.id) return false;
    if (!hasPlayableAudio(e)) return false;
    if (isPremium) return true;
    return isEpisodeAccessibleToFree(detail || currentPodcast, e, false);
  });
  const others = playable.filter(
    (e) => Number(e.id) !== Number(currentEpisode.id),
  );
  if (!others.length) return null;

  if (mode === 'random_same_show') {
    const next = others[Math.floor(Math.random() * others.length)];
    return { podcast: detail || currentPodcast, episode: next };
  }

  const curDate = epDate(currentEpisode);

  if (mode === 'next_newest_same_show') {
    // The episode whose release date is just newer than the current one
    let target = null;
    let targetDate = Infinity;
    for (const ep of others) {
      const d = epDate(ep);
      if (d > curDate && d < targetDate) {
        target = ep;
        targetDate = d;
      }
    }
    return target ? { podcast: detail || currentPodcast, episode: target } : null;
  }

  if (mode === 'next_oldest_same_show') {
    // The episode whose release date is just older than the current one
    let target = null;
    let targetDate = -Infinity;
    for (const ep of others) {
      const d = epDate(ep);
      if (d < curDate && d > targetDate) {
        target = ep;
        targetDate = d;
      }
    }
    return target ? { podcast: detail || currentPodcast, episode: target } : null;
  }

  return null;
}

// Cap the queue when rolling autoplay keeps appending fallbacks during
// long listening sessions. We trim from the front so the user can still
// scrub backward through the most recent items via the prev button,
// but we don't grow the queue array — and the Up Next UI — without
// bound. 200 entries ≈ ~150+ hours of listening at typical episode
// lengths, which comfortably outlasts any realistic single session.
const ROLLING_QUEUE_CAP = 200;

export const AudioPlayerProvider = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const hidePlayer = PLAYER_HIDDEN_ROUTES.has(location.pathname.toLowerCase());
  const [showPlayer, setShowPlayer] = useState(false);
  const [showExpandedPlayer, setShowExpandedPlayer] = useState(false);
  // New: global queue across podcasts (array of { podcast, episode, resume })
  const [queue, setQueue] = useState([]);
  const [queueIndex, setQueueIndex] = useState(-1);
  // New: playback modes
  const [isShuffling, setIsShuffling] = useState(false);
  const [repeatMode, setRepeatMode] = useState('off'); // 'off' | 'all' | 'one'
  const [matureModalOpen, setMatureModalOpen] = useState(false);
  const matureBlockedArgsRef = useRef(null);

  // Ref-based onEnd so the audio hook always calls the latest auto-advance logic
  const onEndedRef = useRef(null);
  const handleAudioEnded = useCallback(() => { onEndedRef.current?.(); }, []);

  // Audio player hook — auto-advance wired through handleAudioEnded
  const audioPlayer = useAudioPlayer({ onEnd: handleAudioEnded });
  const {
    audioRef,
    episode,
    podcast,
    isPlaying,
    volume,
    setVolume,
    playbackRate,
    setPlaybackRate,
    loadAndPlay,
    toggle,
    play,
    pause,
    seek,
    skip,
    setEpisode,
    setPodcast,
  } = audioPlayer;
  // currentTime / duration are deliberately NOT destructured. They
  // live in `audioTimeStore` (see `@/hooks/use-audio-time`) and are
  // consumed by leaf components via `useAudioTime`. Keeping them out
  // of this provider's render path is what prevents the 4 Hz timeupdate
  // tick from re-rendering the entire player tree.

  // Mark state setters as referenced for ESLint in environments where closures confuse the analyzer
  useEffect(() => { /* no-op to reference setQueue */ }, [setQueue]);

  // ─── User Context ─────────────────────────────────────────────────
  // Pulled here (above the persistence effects) so each saved state
  // blob can be tagged with the owning user's id. That tag is what
  // lets the rehydration logic refuse to restore another account's
  // playback if a different user logs into the same browser.
  const { user, loading: userLoading, updateEpisodeProgress, episodeProgressMap, isPremium, canViewMature } = useUser() || {};
  const userIdRef = useRef(user?.id ?? null);
  useEffect(() => { userIdRef.current = user?.id ?? null; }, [user?.id]);

  // ─── Session Persistence ──────────────────────────────────────────
  // Save current playback state to localStorage so it survives page refreshes.
  const STORAGE_KEY = 'eeriecast_player_state';
  const lastSavedRef = useRef(0);

  // Save periodically (interval-based, every 5 seconds while an episode is loaded).
  // Timer pauses when the tab is hidden to avoid a callback stampede on return.
  useEffect(() => {
    if (!episode?.id || !podcast?.id) return;
    const save = () => {
      try {
        const audio = audioRef?.current;
        // Read time straight off the audio element (or the time
        // store as a fallback) — currentTime / duration no longer
        // live in React state in this provider so we can't
        // reference them as variables here.
        const t = audioTimeStore.getState();
        const state = {
          episode,
          podcast,
          currentTime: audio ? audio.currentTime : t.currentTime,
          duration: audio ? (audio.duration || t.duration) : t.duration,
          queue: queue.slice(0, 50),
          queueIndex,
          savedAt: Date.now(),
          userId: userIdRef.current,
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch { /* storage full or unavailable */ }
    };
    // Save immediately when episode changes
    save();

    let id = null;
    const start = () => { if (!id) id = setInterval(save, 5000); };
    const stop = () => { if (id) { clearInterval(id); id = null; } };
    const onVis = () => { document.hidden ? stop() : start(); };

    start();
    document.addEventListener('visibilitychange', onVis);
    return () => { stop(); document.removeEventListener('visibilitychange', onVis); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [episode?.id, podcast?.id, queue.length, queueIndex]);

  // Also save on `beforeunload` to capture the latest position. We
  // funnel every dependency through a single ref so the listener is
  // bound exactly once for the lifetime of the provider — putting
  // `currentTime` (which ticks 4×/sec via the audio element's
  // timeupdate listener) in this effect's deps array used to re-bind
  // the listener 4 times per second during playback, which was a
  // major source of background CPU work and a contributor to scroll
  // / swipe stutter on the player surfaces.
  const saveStateRef = useRef({});
  saveStateRef.current = { episode, podcast, queue, queueIndex };
  useEffect(() => {
    const saveNow = () => {
      const snap = saveStateRef.current;
      if (!snap.episode?.id || !snap.podcast?.id) return;
      try {
        const audio = audioRef?.current;
        const t = audioTimeStore.getState();
        const state = {
          episode: snap.episode,
          podcast: snap.podcast,
          currentTime: audio ? audio.currentTime : t.currentTime,
          duration: audio ? (audio.duration || t.duration) : t.duration,
          queue: snap.queue.slice(0, 50),
          queueIndex: snap.queueIndex,
          savedAt: Date.now(),
          userId: userIdRef.current,
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch { /* */ }
    };
    window.addEventListener('beforeunload', saveNow);
    return () => window.removeEventListener('beforeunload', saveNow);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // (Session rehydration lives further down, AFTER loadAndPlaySmart
  //  is declared — see the "Session Rehydration" block below
  //  loadAndPlaySmart. We can't rehydrate at this point in the file
  //  because the rehydration call uses the smart wrapper.)

  // ─── Podcast catalog (for end-of-queue autoplay fallback) ──────────
  // The audio context is mounted inside <PodcastProvider> (see main.jsx),
  // so we can safely pull the full show list and the per-show detail
  // hydrator. Both go through refs so the auto-advance closure always
  // reaches the latest values without forcing the context to rebuild.
  const { podcasts: podcastsCatalog, ensureDetail } = usePodcasts() || {};
  const podcastsCatalogRef = useRef(podcastsCatalog);
  const ensureDetailRef = useRef(ensureDetail);
  useEffect(() => { podcastsCatalogRef.current = podcastsCatalog; }, [podcastsCatalog]);
  useEffect(() => { ensureDetailRef.current = ensureDetail; }, [ensureDetail]);

  // ─── Free-tier chapter gating ──────────────────────────────────────
  const premiumRef = useRef(isPremium);
  useEffect(() => { premiumRef.current = isPremium; }, [isPremium]);
  const canViewMatureRef = useRef(canViewMature);
  useEffect(() => { canViewMatureRef.current = canViewMature; }, [canViewMature]);
  const navigateRef = useRef(navigate);
  useEffect(() => { navigateRef.current = navigate; }, [navigate]);

  // ─── Smart Resume Wrapper ──────────────────────────────────────────
  // Wraps the raw loadAndPlay to automatically resume from the last known
  // position if the caller passes resume.progress === 0 (i.e. "start from
  // beginning, or wherever we left off").
  const episodeProgressMapRef = useRef(episodeProgressMap);
  useEffect(() => { episodeProgressMapRef.current = episodeProgressMap; }, [episodeProgressMap]);

  const loadAndPlaySmart = useCallback(async (args) => {
    const { episode: ep, resume, autoplay, ...rest } = args;

    // Mature-content gate
    const pod = rest.podcast;
    // Use isMaturePodcast (not hasCategory directly) so the title-based
    // override list in utils.js — Darkness Plays, etc. — is honored even
    // for shows whose backend categories haven't been tagged yet.
    if (pod && isMaturePodcast(pod) && !canViewMature) {
      matureBlockedArgsRef.current = args;
      setMatureModalOpen(true);
      return 'blocked';
    }

    // Premium/exclusive gate.
    //
    // Rule: the Premium paywall should only interrupt a play if the user
    // genuinely doesn't have access. A "free sample" on a members-only
    // show is explicitly carved out — it's there to hook listeners — and
    // must never bounce them to /Premium, even if that episode happens
    // to also have `is_premium` set on it.
    //
    // Evaluation order:
    //   1. If the show is exclusive, let canAccessExclusiveEpisode decide
    //      (that's the function that knows about free samples).
    //   2. Otherwise, honor the per-episode is_premium flag (bonus episode
    //      on an otherwise-free show).
    if (pod && !premiumRef.current) {
      if (pod.is_exclusive) {
        if (!canAccessExclusiveEpisode(ep, pod, false)) {
          navigateRef.current(createPageUrl('Premium'));
          return 'blocked';
        }
      } else if (ep?.is_premium) {
        navigateRef.current(createPageUrl('Premium'));
        return 'blocked';
      }
    }

    const eid = Number(ep?.id);
    const map = episodeProgressMapRef.current;
    const shouldRemember = getSetting('rememberPosition');

    // Ensure there is always at least a 1-item queue so next/prev and
    // autoplay have something to work with. If setPlaybackQueue already
    // populated the queue in this same batch, the functional updater
    // will see the populated array and leave it alone.
    setQueue(prev => {
      if (prev.length > 0) return prev;          // queue already set
      return [{ podcast: pod, episode: ep, resume }]; // minimal fallback
    });
    setQueueIndex(prev => (prev >= 0 ? prev : 0));
    setShowPlayer(true);

    let result;
    // If "remember position" is off, always start from the beginning
    if (!shouldRemember) {
      result = await loadAndPlay({ ...rest, episode: ep, resume: { progress: 0 }, autoplay });
    } else if (ep && Number.isFinite(eid) && map && (!resume || resume.progress === 0 || resume.progress == null)) {
      // If resume.progress is 0 (default), check if we have saved progress
      const saved = map.get(eid);
      if (saved && saved.progress > 0 && !saved.completed) {
        result = await loadAndPlay({ ...rest, episode: ep, resume: { progress: saved.progress }, autoplay });
      } else {
        result = await loadAndPlay({ ...rest, episode: ep, resume, autoplay });
      }
    } else {
      result = await loadAndPlay({ ...rest, episode: ep, resume, autoplay });
    }
    return result;
  }, [loadAndPlay, canViewMature]);

  // ─── Session Rehydration ──────────────────────────────────────────
  // When a logged-in user refreshes or returns to the app and their
  // last session was a real listen, restore the mini player so they
  // can resume with one tap. The audio is loaded paused at the
  // saved position; we deliberately do NOT autoplay (browsers
  // require a user gesture in most cases anyway, and a refresh
  // suddenly blasting audio is jarring UX).
  //
  // Hard guards — rehydration is skipped if any of these fail:
  //   1. User is logged in. We use the resolved `user` object (not
  //      just the token) so we can match the saved state's userId.
  //   2. Saved state belongs to the SAME user. Defends against a
  //      different account logging in on a shared browser before
  //      the previous user's state was cleared.
  //   3. Saved state is recent (within REHYDRATE_MAX_AGE_MS).
  //      Stale state from weeks ago is more confusing than helpful.
  //   4. Episode + podcast both have ids. Anything less means the
  //      blob was corrupted and the mini player would crash.
  //
  // The effect is gated behind a ref so it only ever runs once per
  // mount, even if the user object reshapes during the session.
  const REHYDRATE_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000; // 14 days
  const hasRehydratedRef = useRef(false);

  useEffect(() => {
    if (hasRehydratedRef.current) return;
    if (!user?.id) return; // wait for user data; no token = no restore

    let raw;
    try { raw = localStorage.getItem(STORAGE_KEY); } catch { return; }
    if (!raw) return;

    let saved;
    try { saved = JSON.parse(raw); } catch {
      // Corrupt blob — clear it so we don't keep retrying every mount.
      try { localStorage.removeItem(STORAGE_KEY); } catch { /* */ }
      return;
    }

    if (!saved?.episode?.id || !saved?.podcast?.id) return;
    if (typeof saved.savedAt !== 'number') return;
    if (Date.now() - saved.savedAt > REHYDRATE_MAX_AGE_MS) {
      // Stale — quietly drop it.
      try { localStorage.removeItem(STORAGE_KEY); } catch { /* */ }
      return;
    }
    // Cross-user contamination guard. `userId` was added to the
    // saved blob in the persistence effects above. Older blobs
    // from before that field existed are allowed to rehydrate
    // (`undefined` userId), since they predate the multi-user
    // concern and the user has clearly already consented to the
    // app on this browser.
    if (saved.userId != null && saved.userId !== user.id) {
      try { localStorage.removeItem(STORAGE_KEY); } catch { /* */ }
      return;
    }

    hasRehydratedRef.current = true;

    // Restore queue first so playNext / playPrev have somewhere to go
    // immediately after the user taps play.
    if (Array.isArray(saved.queue) && saved.queue.length > 0) {
      setQueue(saved.queue);
      setQueueIndex(typeof saved.queueIndex === 'number' ? saved.queueIndex : 0);
    }

    // Use loadAndPlaySmart with `autoplay: false` so all the same
    // paywall / mature gates fire if access has changed since the
    // session was saved (e.g. premium expired). The audio element
    // is loaded with a real `src` so the user's first tap on play
    // actually starts the track. The smart wrapper also seeds a
    // 1-item queue if `saved.queue` was empty, mirroring the
    // normal play-an-episode flow.
    loadAndPlaySmart({
      podcast: saved.podcast,
      episode: saved.episode,
      resume: { progress: saved.currentTime || 0 },
      autoplay: false,
    }).catch(() => { /* gates / network — leave silent */ });
  // We intentionally don't list `loadAndPlaySmart` here. The
  // hasRehydratedRef guard makes this single-shot per mount, and
  // including the function would force re-runs every time its
  // identity changes (which happens on `canViewMature` flips).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Queue helpers
  const playQueueIndex = useCallback(async (index) => {
    if (!Array.isArray(queue) || index < 0 || index >= queue.length) return;
    const item = queue[index];
    if (!item || !item.episode) return;

    // Free-tier gate: block chapters/episodes beyond the free limit
    if (item.podcast && !premiumRef.current) {
      if (isAudiobook(item.podcast)) {
        if (!canAccessChapter(index, false, FREE_LISTEN_CHAPTER_LIMIT)) {
          navigateRef.current(createPageUrl('Premium'));
          return;
        }
      } else if (item.podcast.is_exclusive) {
        if (!canAccessExclusiveEpisode(item.episode, item.podcast, false)) {
          navigateRef.current(createPageUrl('Premium'));
          return;
        }
      }
    }

    setQueueIndex(index);
    await loadAndPlaySmart({ podcast: item.podcast, episode: item.episode, resume: item.resume });
  }, [queue, loadAndPlaySmart]);

  const setPlaybackQueue = useCallback(async (items, startIndex = 0) => {
    const list = Array.isArray(items) ? items.filter(Boolean) : [];
    setQueue(list);
    if (list.length) {
      const idx = Math.min(Math.max(0, startIndex), list.length - 1);
      const item = list[idx];
      if (item?.episode) {
        // Free-tier gate (mirrors playQueueIndex logic)
        if (item.podcast && !premiumRef.current) {
          if (isAudiobook(item.podcast)) {
            if (!canAccessChapter(idx, false, FREE_LISTEN_CHAPTER_LIMIT)) {
              navigateRef.current(createPageUrl('Premium'));
              return;
            }
          } else if (item.podcast.is_exclusive) {
            if (!canAccessExclusiveEpisode(item.episode, item.podcast, false)) {
              navigateRef.current(createPageUrl('Premium'));
              return;
            }
          }
        }
        setQueueIndex(idx);
        await loadAndPlaySmart({ podcast: item.podcast, episode: item.episode, resume: item.resume });
      }
      setShowPlayer(true);
    } else {
      setQueueIndex(-1);
    }
  }, [loadAndPlaySmart]);

  // Refs for latest state/functions used in onEnded
  const queueRef = useRef(queue);
  const idxRef = useRef(queueIndex);
  const shuffleRef = useRef(isShuffling);
  const repeatRef = useRef(repeatMode);
  const loadAndPlayRef = useRef(loadAndPlaySmart);
  // Keep refs in sync
  useEffect(() => { queueRef.current = queue; }, [queue]);
  useEffect(() => { idxRef.current = queueIndex; }, [queueIndex]);
  useEffect(() => { shuffleRef.current = isShuffling; }, [isShuffling]);
  useEffect(() => { repeatRef.current = repeatMode; }, [repeatMode]);
  useEffect(() => { loadAndPlayRef.current = loadAndPlaySmart; }, [loadAndPlaySmart]);

  // Wire the ref so the audio hook's onEnd always calls the latest auto-advance
  const onEndedFn = useCallback(async () => {
    const list = queueRef.current || [];
    const idx = idxRef.current ?? -1;
    const shuffle = !!shuffleRef.current;
    const repeat = repeatRef.current || 'off';
    const loader = loadAndPlayRef.current;

    // Repeat current item (always honored regardless of autoplay)
    if (repeat === 'one') {
      await seek(0);
      await play();
      return;
    }

    // Check autoplay setting — if off, don't advance to next episode
    const shouldAutoplay = getSetting('autoplay');
    if (!shouldAutoplay) return;

    const total = list.length;
    if (total <= 0 || idx < 0) return;

    let nextIndex = -1;
    if (shuffle) {
      if (total === 1) {
        if (repeat === 'all') nextIndex = 0;
      } else {
        nextIndex = Math.floor(Math.random() * total);
        if (nextIndex === idx) nextIndex = (idx + 1) % total;
      }
    } else {
      if (idx < total - 1) nextIndex = idx + 1; else if (repeat === 'all') nextIndex = 0;
    }

    if (nextIndex >= 0 && nextIndex < total) {
      const item = list[nextIndex];
      if (item && item.episode) {
        // Free-tier gate: stop auto-advance at the episode/chapter limit
        if (item.podcast && !premiumRef.current) {
          if (isAudiobook(item.podcast)) {
            if (!canAccessChapter(nextIndex, false, FREE_LISTEN_CHAPTER_LIMIT)) {
              navigateRef.current(createPageUrl('Premium'));
              return;
            }
          } else if (item.podcast.is_exclusive) {
            if (!canAccessExclusiveEpisode(item.episode, item.podcast, false)) {
              navigateRef.current(createPageUrl('Premium'));
              return;
            }
          }
        }
        setQueueIndex(nextIndex);
        await loader({ podcast: item.podcast, episode: item.episode, resume: item.resume });
      }
      return;
    }

    // ── Queue exhausted: per-content-type autoplay fallback ──
    // The user finished the last item in the queue (single-item launch
    // from history/search, or worked through every episode of a show).
    // Pick a follow-up based on their Settings preference for this
    // content type. Free users are gated inside resolveAutoplayFallback
    // so we never silently bounce into a locked episode.
    const current = list[idx];
    const currentEpisode = current?.episode;
    let currentPodcast = current?.podcast;
    if (!currentPodcast || !currentEpisode) return;

    // Hydrate the show's full detail before classifying. Queue items
    // launched from history / search can carry only `{ id, title }`,
    // which is enough to play but leaves `categories` empty — so
    // isAudiobook/isMusic would misfire and we'd consult the wrong
    // per-type setting. ensureDetail caches per session so this is
    // cheap for items that were already hydrated upstream.
    try {
      if (ensureDetailRef.current && currentPodcast.id != null) {
        const detail = await ensureDetailRef.current(currentPodcast.id);
        if (detail) currentPodcast = { ...currentPodcast, ...detail };
      }
    } catch { /* fall through with whatever we have */ }

    const isAudio = isAudiobook(currentPodcast);
    const isMus = !isAudio && isMusic(currentPodcast);
    const fallbackMode = isAudio
      ? getSetting('audiobookAutoplay')
      : isMus
        ? getSetting('musicAutoplay')
        : getSetting('podcastAutoplay');
    if (!fallbackMode || fallbackMode === 'none') return;

    let fallback = null;
    try {
      fallback = await resolveAutoplayFallback({
        mode: fallbackMode,
        currentPodcast,
        currentEpisode,
        isAudiobookContent: isAudio,
        isMusicContent: isMus,
        isPremium: !!premiumRef.current,
        canViewMature: !!canViewMatureRef.current,
        ensureDetail: ensureDetailRef.current,
        catalog: podcastsCatalogRef.current,
      });
    } catch (err) {
      if (typeof console !== 'undefined') console.debug('autoplay fallback failed', err);
      return;
    }
    if (!fallback?.podcast || !fallback?.episode) return;

    // Append the fallback to the queue so:
    //   • the user sees what's playing now in the Up Next UI
    //   • the prev button can take them back to the just-finished item
    //   • the next end-of-track triggers another fallback resolve from
    //     the appended item's vantage point (rolling autoplay)
    //
    // To keep long listening sessions from growing the queue without
    // bound, trim the oldest entries once we exceed ROLLING_QUEUE_CAP.
    // The just-played item and the new fallback are always retained.
    const newItem = {
      podcast: fallback.podcast,
      episode: fallback.episode,
      resume: { progress: 0 },
    };
    setQueue(prev => {
      const grown = [...prev, newItem];
      if (grown.length <= ROLLING_QUEUE_CAP) return grown;
      return grown.slice(grown.length - ROLLING_QUEUE_CAP);
    });
    // The new item lands at the end of the queue regardless of trimming.
    // Fallback only fires when prev was already at the last index, so the
    // new last index is at most prev + 1 (and clamped at the cap).
    setQueueIndex(prev => Math.min(prev + 1, ROLLING_QUEUE_CAP - 1));
    await loader(newItem);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the ref in sync so the hook's onEnd always calls the latest logic
  useEffect(() => { onEndedRef.current = onEndedFn; }, [onEndedFn]);

  // Show player when episode is loaded + track in recentlyPlayed
  useEffect(() => {
    if (episode && podcast) {
      setShowPlayer(true);
      // Keep the recentlyPlayed list in localStorage up-to-date for Keep Listening
      try {
        const pid = podcast.id;
        if (pid) {
          const ids = JSON.parse(localStorage.getItem('recentlyPlayed') || '[]');
          const next = [pid, ...ids.filter(id => id !== pid)].slice(0, 15);
          localStorage.setItem('recentlyPlayed', JSON.stringify(next));
        }
      } catch { /* */ }
    } else if (!episode) {
      setShowPlayer(false);
      setShowExpandedPlayer(false);
    }
  }, [episode, podcast]);

  // ─── Real-time Episode Progress Tracking ──────────────────────────
  // Update the global episodeProgressMap in UserContext every 3 seconds
  // so progress bars appear on episode cards/tables in real-time.
  // The timer pauses when the tab is hidden to prevent a stampede of
  // queued callbacks from freezing the UI when the user returns.
  useEffect(() => {
    if (!episode?.id || !updateEpisodeProgress) return;
    // Update immediately when the episode changes. Time data is
    // sourced from the audio element / time store rather than React
    // state so this effect's dep array doesn't have to listen to
    // 4 Hz time ticks.
    const audio = audioRef?.current;
    const t0 = audioTimeStore.getState();
    const ct = audio ? audio.currentTime : t0.currentTime;
    const dur = audio ? (audio.duration || t0.duration) : t0.duration;
    if (dur > 0) updateEpisodeProgress(episode.id, ct, dur);

    let intervalId = null;
    const startInterval = () => {
      if (intervalId) return;
      intervalId = setInterval(() => {
        const a = audioRef?.current;
        if (!a || a.paused) return;
        const d = a.duration || audioTimeStore.getState().duration;
        if (d > 0) updateEpisodeProgress(episode.id, a.currentTime, d);
      }, 3000);
    };
    const stopInterval = () => {
      if (intervalId) { clearInterval(intervalId); intervalId = null; }
    };

    const onVisibility = () => {
      if (document.hidden) {
        stopInterval();
      } else {
        setTimeout(startInterval, 300);
      }
    };

    startInterval();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stopInterval();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [episode?.id, updateEpisodeProgress]);

  // Gate that keeps the mini player hidden until the expanded player's exit
  // animation has fully completed, so the re-entrance animation is visible.
  const [miniPlayerReady, setMiniPlayerReady] = useState(true);
  // Minimized state — shrinks mini player into a small pill/bubble
  const [isMiniPlayerMinimized, setIsMiniPlayerMinimized] = useState(false);

  const handleClosePlayer = useCallback(() => {
    pause();
    setShowPlayer(false);
    setShowExpandedPlayer(false);
    setIsMiniPlayerMinimized(false);
    setMiniPlayerReady(true);
    // Fully reset episode/podcast so re-playing the same episode triggers
    // the useEffect that shows the player again
    setEpisode(null);
    setPodcast(null);
    setQueue([]);
    setQueueIndex(-1);
    // Clear persisted state when user explicitly closes the player
    try { localStorage.removeItem('eeriecast_player_state'); } catch { /* */ }
  }, [pause, setEpisode, setPodcast]);

  // ─── Auth identity watcher ─────────────────────────────────────────
  // Any *deliberate* auth identity transition closes the mini player.
  // We close on these because the audio URL on the loaded episode was
  // resolved against the previous identity's entitlements:
  //   • anon → signed-in: the URL the audio element holds is the
  //     ad-filled stream the anonymous serializer returned. A premium
  //     account is now entitled to the ad-free stream, but the
  //     in-memory episode object doesn't have it (the ad_* fields are
  //     write_only server-side), so silently continuing playback would
  //     give a paid member ads. Closing the player and letting them
  //     re-press play means the next load resolves the URL against
  //     their new identity and they get the right stream.
  //   • logout: don't leak a signed-in user's session into a
  //     subsequent anonymous one.
  //   • account switch: don't leak user A's audio into user B.
  //
  // The critical subtlety: on a fresh page load `useUser()` reports
  // `{ user: null, loading: true }` until `fetchUser()` resolves. If
  // we treated that initial null → user.id transition as a "login",
  // we'd nuke the persisted player state on every reload — which is
  // exactly the bug the user reported (mini player not coming back
  // for an already-signed-in user after refresh). The fix is to
  // ignore everything until UserContext signals it's done loading,
  // and only THEN start tracking transitions.
  //
  // Cases handled (after `userLoading` first goes false):
  //   • prev=null, curr=null      → no-op (still anonymous)
  //   • prev=null, curr=id        → CLOSE (genuine login)
  //   • prev=id,   curr=null      → CLOSE (logout)
  //   • prev=idA,  curr=idB       → CLOSE (account switch)
  const authBootstrappedRef = useRef(false);
  const prevUserIdRef = useRef(null);
  useEffect(() => {
    // Ignore everything until the very first time UserContext
    // reports `loading: false`. That's our "auth resolved" signal.
    if (userLoading) return;
    const curr = user?.id ?? null;
    if (!authBootstrappedRef.current) {
      // First post-bootstrap observation: snapshot the resolved
      // identity as our baseline and DO NOT close. This is the path
      // that lets a signed-in user reload the page and find the
      // mini player still rehydrated to wherever they left off.
      authBootstrappedRef.current = true;
      prevUserIdRef.current = curr;
      return;
    }
    const prev = prevUserIdRef.current;
    prevUserIdRef.current = curr;
    if (prev === curr) return; // no actual change
    handleClosePlayer();
  }, [userLoading, user?.id, handleClosePlayer]);

  // Auto-close the player when mature content is disabled and the
  // currently playing podcast is mature.
  useEffect(() => {
    if (!canViewMature) {
      const currentPod = audioPlayer.podcast;
      if (currentPod && isMaturePodcast(currentPod)) {
        handleClosePlayer();
      }
    }
  }, [canViewMature, audioPlayer.podcast]);

  const handleExpandPlayer = () => {
    setShowExpandedPlayer(true);
    setIsMiniPlayerMinimized(false);
    setMiniPlayerReady(true); // not gated when expanding
  };

  const handleCollapsePlayer = () => {
    setShowExpandedPlayer(false);
    // Mini player is intentionally NOT gated here. The previous
    // gate held the mini off-screen until the expanded player
    // finished its 360 ms slide-down, producing a perceptible
    // blank moment followed by an abrupt pop-in. Mounting the
    // mini concurrently lets its spring entrance run beneath the
    // sliding-down expanded; the expanded fully covers the mini
    // area until it's ~90% off the screen, so the mini's entry
    // animation has already settled into place by the time it's
    // visible — no overlap is ever observed by the user.
    setMiniPlayerReady(true);
  };

  const handleExpandedExitComplete = () => {
    // No-op now that the mini animates in concurrently. Kept for
    // AnimatePresence's onExitComplete callback contract; we may
    // still want to hook future "post-expanded-collapse" cleanup
    // here without re-introducing the gate.
    setMiniPlayerReady(true);
  };

  const handleMinimizePlayer = () => {
    setIsMiniPlayerMinimized(true);
  };

  const handleRestorePlayer = () => {
    setIsMiniPlayerMinimized(false);
  };

  // ─── Sleep Timer ───────────────────────────────────────────────────
  const [sleepTimerEndTime, setSleepTimerEndTime] = useState(null);  // Date.now() target
  const [sleepTimerRemaining, setSleepTimerRemaining] = useState(0); // seconds left
  const sleepIntervalRef = useRef(null);
  const sleepTimeoutRef = useRef(null);

  const cancelSleepTimer = useCallback(() => {
    if (sleepTimeoutRef.current) { clearTimeout(sleepTimeoutRef.current); sleepTimeoutRef.current = null; }
    if (sleepIntervalRef.current) { clearInterval(sleepIntervalRef.current); sleepIntervalRef.current = null; }
    setSleepTimerEndTime(null);
    setSleepTimerRemaining(0);
  }, []);

  const setSleepTimer = useCallback((minutes) => {
    // Clear any existing timer first
    if (sleepTimeoutRef.current) { clearTimeout(sleepTimeoutRef.current); sleepTimeoutRef.current = null; }
    if (sleepIntervalRef.current) { clearInterval(sleepIntervalRef.current); sleepIntervalRef.current = null; }

    if (!minutes || minutes <= 0) {
      cancelSleepTimer();
      return;
    }

    const ms = minutes * 60 * 1000;
    const end = Date.now() + ms;
    setSleepTimerEndTime(end);
    setSleepTimerRemaining(Math.ceil(ms / 1000));

    // Countdown every second
    sleepIntervalRef.current = setInterval(() => {
      const left = Math.max(0, Math.ceil((end - Date.now()) / 1000));
      setSleepTimerRemaining(left);
      if (left <= 0) {
        clearInterval(sleepIntervalRef.current);
        sleepIntervalRef.current = null;
      }
    }, 1000);

    // Pause playback when timer expires
    sleepTimeoutRef.current = setTimeout(() => {
      pause();
      cancelSleepTimer();
    }, ms);
  }, [pause, cancelSleepTimer]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (sleepTimeoutRef.current) clearTimeout(sleepTimeoutRef.current);
      if (sleepIntervalRef.current) clearInterval(sleepIntervalRef.current);
    };
  }, []);

  // ─── Next / Previous Track ───────────────────────────────────────
  const playNext = useCallback(async () => {
    const list = queueRef.current || [];
    const idx = idxRef.current ?? -1;
    const total = list.length;
    if (total <= 0 || idx < 0) return;

    let nextIndex = -1;
    if (shuffleRef.current) {
      nextIndex = Math.floor(Math.random() * total);
      if (nextIndex === idx && total > 1) nextIndex = (idx + 1) % total;
    } else {
      if (idx < total - 1) nextIndex = idx + 1;
      else if (repeatRef.current === 'all') nextIndex = 0;
    }
    if (nextIndex >= 0 && nextIndex < total) {
      await playQueueIndex(nextIndex);
    }
  }, [playQueueIndex]);

  const playPrev = useCallback(async () => {
    const list = queueRef.current || [];
    const idx = idxRef.current ?? -1;
    const total = list.length;
    if (total <= 0 || idx < 0) return;

    // If more than 3 seconds in, restart current track instead
    const audio = audioRef?.current;
    if (audio && audio.currentTime > 3) {
      seek(0);
      return;
    }

    let prevIndex = -1;
    if (idx > 0) prevIndex = idx - 1;
    else if (repeatRef.current === 'all') prevIndex = total - 1;

    if (prevIndex >= 0 && prevIndex < total) {
      await playQueueIndex(prevIndex);
    }
  }, [playQueueIndex, audioRef, seek]);

  // ─── Global Keyboard Shortcuts ───────────────────────────────────
  // Space = play/pause, ←/→ = skip, M = mute. Only active while an
  // episode is loaded so shortcuts don't fire on marketing pages.
  useKeyboardShortcuts({
    isActive: !!episode,
    toggle,
    skip,
    audioRef,
    setVolume,
  });

  // ─── Lock Screen / Media Session ─────────────────────────────────
  // currentTime / duration are NOT passed here — `useMediaSession`
  // subscribes to `audioTimeStore` directly with its own throttle so
  // the OS Now-Playing position updates don't piggyback on React's
  // 4 Hz timeupdate cycle.
  useMediaSession({
    episode,
    podcast,
    isPlaying,
    playbackRate,
    onPlay: play,
    onPause: pause,
    onNext: playNext,
    onPrev: playPrev,
    onSeek: seek,
    onSkip: skip,
  });

  // ─── Add to Queue / Play Next ────────────────────────────────────
  const addToQueue = useCallback((pod, ep) => {
    if (!ep) return;
    const item = { podcast: pod, episode: ep, resume: { progress: 0 } };
    setQueue(prev => [...prev, item]);
    // If nothing is playing, start the episode immediately
    if (!episode) {
      setQueueIndex(0);
      setShowPlayer(true);
      loadAndPlaySmart({ podcast: pod, episode: ep, resume: { progress: 0 } });
    }
  }, [episode, loadAndPlaySmart]);

  const addNext = useCallback((pod, ep) => {
    if (!ep) return;
    const item = { podcast: pod, episode: ep, resume: { progress: 0 } };
    const idx = idxRef.current ?? -1;
    const insertAt = idx >= 0 ? idx + 1 : 0;
    setQueue(prev => [
      ...prev.slice(0, insertAt),
      item,
      ...prev.slice(insertAt),
    ]);
    // If nothing is playing, start the episode immediately
    if (!episode) {
      setQueueIndex(0);
      setShowPlayer(true);
      loadAndPlaySmart({ podcast: pod, episode: ep, resume: { progress: 0 } });
    }
  }, [episode, loadAndPlaySmart]);

  const removeFromQueue = useCallback((absoluteIndex) => {
    if (typeof absoluteIndex !== 'number') return;
    const currentIdx = idxRef.current ?? -1;
    // Don't remove the currently playing item
    if (absoluteIndex === currentIdx) return;

    setQueue(prev => {
      if (absoluteIndex < 0 || absoluteIndex >= prev.length) return prev;
      return [...prev.slice(0, absoluteIndex), ...prev.slice(absoluteIndex + 1)];
    });
    // Adjust queueIndex if removed item was before the current
    if (absoluteIndex < currentIdx) {
      setQueueIndex(prev => prev - 1);
    }
  }, []);

  // Reorder queue items — supports moving anywhere except the currently
  // playing track (which stays pinned). queueIndex is recalculated so
  // it continues pointing at the same item after the shuffle.
  const reorderQueue = useCallback((fromIndex, toIndex) => {
    if (typeof fromIndex !== 'number' || typeof toIndex !== 'number') return;
    if (fromIndex === toIndex) return;
    setQueue(prev => {
      if (fromIndex < 0 || fromIndex >= prev.length) return prev;
      if (toIndex < 0 || toIndex >= prev.length) return prev;
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
    // Keep queueIndex pointing at the currently playing item
    setQueueIndex(prev => {
      const cur = prev;
      if (cur < 0) return cur;
      if (cur === fromIndex) return toIndex;
      // If the moved item was above the current, the current slides up
      if (fromIndex < cur && toIndex >= cur) return cur - 1;
      // If the moved item was below the current and now lands above, slide down
      if (fromIndex > cur && toIndex <= cur) return cur + 1;
      return cur;
    });
  }, []);

  // Randomly shuffle the *upcoming* queue entries (everything after the
  // currently playing item). The current track stays pinned at its index
  // so playback isn't interrupted, and tracks already played stay in
  // listener-history order. Uses Fisher–Yates so each ordering is
  // equally likely.
  const shuffleUpNext = useCallback(() => {
    setQueue(prev => {
      const list = Array.isArray(prev) ? [...prev] : [];
      const curIdx = idxRef.current ?? -1;
      const startIdx = curIdx >= 0 ? curIdx + 1 : 0;
      const tail = list.slice(startIdx);
      if (tail.length < 2) return prev; // nothing to shuffle
      for (let i = tail.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [tail[i], tail[j]] = [tail[j], tail[i]];
      }
      return [...list.slice(0, startIdx), ...tail];
    });
  }, []);

  // Clear the queue except for the currently playing item so playback
  // isn't interrupted. If nothing is playing, clear everything.
  const clearQueue = useCallback(() => {
    const curIdx = idxRef.current ?? -1;
    const list = queueRef.current || [];
    if (curIdx >= 0 && curIdx < list.length) {
      const current = list[curIdx];
      setQueue([current]);
      setQueueIndex(0);
    } else {
      setQueue([]);
      setQueueIndex(-1);
    }
  }, []);

  // ─── Handlers to expose to UI ─────────────────────────────────────
  const toggleShuffle = useCallback(() => {
    setIsShuffling((s) => !s);
  }, []);

  const cycleRepeat = useCallback(() => {
    setRepeatMode((m) => (m === 'off' ? 'all' : m === 'all' ? 'one' : 'off'));
  }, []);

  // Memoised context value. `currentTime` / `duration` are NOT in
  // here — they live in `audioTimeStore` and consumers subscribe via
  // `useAudioTime`. Without that exclusion the value object would
  // change identity 4×/sec and every consumer of
  // `useAudioPlayerContext()` would re-render on every timeupdate,
  // which is exactly what was making scrolling and gestures stutter.
  const contextValue = useMemo(() => ({
    episode,
    podcast,
    isPlaying,
    volume,
    setVolume,
    playbackRate,
    setPlaybackRate,
    loadAndPlay: loadAndPlaySmart,
    toggle,
    play,
    pause,
    seek,
    skip,
    setEpisode,
    setPodcast,
    showPlayer,
    setShowPlayer,
    showExpandedPlayer,
    setShowExpandedPlayer,
    // queue api
    queue,
    queueIndex,
    setPlaybackQueue,
    playQueueIndex,
    // playback mode api
    isShuffling,
    repeatMode,
    toggleShuffle,
    cycleRepeat,
    // track navigation
    playNext,
    playPrev,
    // queue manipulation
    addToQueue,
    addNext,
    removeFromQueue,
    reorderQueue,
    shuffleUpNext,
    clearQueue,
    // sleep timer api
    sleepTimerRemaining,
    sleepTimerEndTime,
    setSleepTimer,
    cancelSleepTimer,
    // audio element ref (for Web Audio API waveform)
    audioRef,
    // mature content gate
    matureModalOpen,
    setMatureModalOpen,
  }), [
    episode,
    podcast,
    isPlaying,
    volume,
    setVolume,
    playbackRate,
    setPlaybackRate,
    loadAndPlaySmart,
    toggle,
    play,
    pause,
    seek,
    skip,
    setEpisode,
    setPodcast,
    showPlayer,
    showExpandedPlayer,
    queue,
    queueIndex,
    setPlaybackQueue,
    playQueueIndex,
    isShuffling,
    repeatMode,
    toggleShuffle,
    cycleRepeat,
    playNext,
    playPrev,
    addToQueue,
    addNext,
    removeFromQueue,
    reorderQueue,
    shuffleUpNext,
    clearQueue,
    sleepTimerRemaining,
    sleepTimerEndTime,
    setSleepTimer,
    cancelSleepTimer,
    audioRef,
    matureModalOpen,
  ]);

  return (
    <AudioPlayerContext.Provider value={contextValue}>
      {children}

      {/* Mature Content Warning Modal */}
      <MatureContentModal
        isOpen={matureModalOpen}
        onClose={() => { setMatureModalOpen(false); matureBlockedArgsRef.current = null; }}
        onContinue={() => {
          const args = matureBlockedArgsRef.current;
          matureBlockedArgsRef.current = null;
          setMatureModalOpen(false);
          if (args) loadAndPlaySmart(args);
        }}
      />


      {/* Expanded Player - shows when user expands (slide-up enter/exit).
          Note: currentTime / duration are NOT passed as props — the
          player subscribes to them via `useAudioTime` so timeupdate
          ticks don't force a full re-render of this entire subtree. */}
      <AnimatePresence onExitComplete={handleExpandedExitComplete}>
        {showExpandedPlayer && !hidePlayer && episode && podcast && (
          <motion.div
            key="expanded-player"
            initial={EXPANDED_PLAYER_INITIAL}
            animate={EXPANDED_PLAYER_ANIMATE}
            exit={EXPANDED_PLAYER_EXIT}
            transition={EXPANDED_PLAYER_TRANSITION}
            style={EXPANDED_PLAYER_STYLE}
          >
            <ExpandedPlayer
              podcast={podcast}
              episode={episode}
              onToggle={toggle}
              onCollapse={handleCollapsePlayer}
              onClose={handleClosePlayer}
              onSeek={seek}
              onSkip={skip}
              onNext={playNext}
              onPrev={playPrev}
              onPlay={play}
              onPause={pause}
              // shuffle/repeat props
              isShuffling={isShuffling}
              repeatMode={repeatMode}
              onShuffleToggle={toggleShuffle}
              onRepeatToggle={cycleRepeat}
              // queue props
              queue={queue}
              queueIndex={queueIndex}
              playQueueIndex={playQueueIndex}
              loadAndPlay={loadAndPlaySmart}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile Player - shows when audio is playing and not expanded.
          miniPlayerReady gates mounting until the expanded player's
          exit animation finishes so the mini doesn't pop in mid-slide.
          NOTE: This wrapper is intentionally NOT animated and NOT
          a `motion.div` — no framer-motion, no transform, no
          will-change. Any of those on the wrapper would make it a
          containing block for the inner `position:fixed` mini-full
          / pill and cause the mobile-Safari "gap on scroll" bug
          where the mini drifts off the visual viewport while the
          URL bar transitions. We instead let the inner mini-full
          / pill be `position: fixed` against the actual viewport
          (same strategy as the bottom nav). currentTime /
          duration / isPlaying are read from `audioTimeStore` via
          `useAudioTime` — see ExpandedPlayer note above. */}
      {showPlayer && !showExpandedPlayer && !hidePlayer && miniPlayerReady && episode && podcast && (
        <div
          style={MOBILE_PLAYER_STYLE}
          // z-40 by default, escalates to z-[10080] only when the
          // e-reader / comic reader is active so playback stays
          // controllable while reading. The arbitrary variant
          // matches the global rule: `<html class="ereader-active">`
          // is toggled on/off by EReader.jsx and ComicReader.jsx.
          className="z-40 [html.ereader-active_&]:z-[10080]"
        >
          <MobilePlayer
            podcast={podcast}
            episode={episode}
            volume={volume}
            onToggle={toggle}
            onExpand={handleExpandPlayer}
            onSkip={skip}
            onNext={playNext}
            onPrev={playPrev}
            onSeek={seek}
            onClose={handleClosePlayer}
            onVolumeChange={setVolume}
            // queue props
            queue={queue}
            queueIndex={queueIndex}
            // playback mode props
            isShuffling={isShuffling}
            repeatMode={repeatMode}
            onShuffleToggle={toggleShuffle}
            onRepeatToggle={cycleRepeat}
            // minimize props
            isMinimized={isMiniPlayerMinimized}
            onMinimize={handleMinimizePlayer}
            onRestore={handleRestorePlayer}
          />
        </div>
      )}
    </AudioPlayerContext.Provider>
  );
};

AudioPlayerProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export const useAudioPlayerContext = () => {
  const context = useContext(AudioPlayerContext);
  if (!context) {
    if (typeof console !== 'undefined') {
      console.warn('useAudioPlayerContext accessed before provider mounted; returning no-op context');
    }
    const noop = () => {};
    const noopAsync = async () => {};
    return {
      episode: null,
      podcast: null,
      isPlaying: false,
      currentTime: 0,
      duration: 0,
      volume: 1,
      setVolume: noop,
      playbackRate: 1,
      setPlaybackRate: noop,
      loadAndPlay: noopAsync,
      toggle: noop,
      play: noop,
      pause: noop,
      seek: noop,
      skip: noop,
      setEpisode: noop,
      setPodcast: noop,
      showPlayer: false,
      setShowPlayer: noop,
      showExpandedPlayer: false,
      setShowExpandedPlayer: noop,
      queue: [],
      queueIndex: -1,
      setPlaybackQueue: noopAsync,
      playQueueIndex: noopAsync,
      isShuffling: false,
      repeatMode: 'off',
      toggleShuffle: noop,
      cycleRepeat: noop,
      playNext: noopAsync,
      playPrev: noopAsync,
      addToQueue: noop,
      addNext: noop,
      removeFromQueue: noop,
      reorderQueue: noop,
      shuffleUpNext: noop,
      clearQueue: noop,
      sleepTimerRemaining: 0,
      sleepTimerEndTime: null,
      setSleepTimer: noop,
      cancelSleepTimer: noop,
    };
  }
  return context;
};
