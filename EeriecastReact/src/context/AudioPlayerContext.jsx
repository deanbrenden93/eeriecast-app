/* eslint-disable no-undef, no-unused-vars */
import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import PropTypes from 'prop-types';
import { useAudioPlayer } from '@/hooks/use-audio-player';
import { getEpisodeAudioUrl, isAudiobook } from '@/lib/utils';
import { getSetting } from '@/hooks/use-settings';
import { useUser } from '@/context/UserContext.jsx';
import { canAccessChapter, canAccessExclusiveEpisode, FREE_LISTEN_CHAPTER_LIMIT } from '@/lib/freeTier';
import { createPageUrl } from '@/utils';
import MobilePlayer from '@/components/podcasts/MobilePlayer';
import ExpandedPlayer from '@/components/podcasts/ExpandedPlayer';
import { AnimatePresence, motion } from 'framer-motion';

const AudioPlayerContext = createContext();

// Routes where the mini player should never appear
const PLAYER_HIDDEN_ROUTES = new Set(['/', '/home', '/premium']);

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

  // Audio player hook
  const audioPlayer = useAudioPlayer({ onEnd: () => {} });
  const {
    audioRef,
    episode,
    podcast,
    isPlaying,
    currentTime,
    duration,
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

  // Mark state setters as referenced for ESLint in environments where closures confuse the analyzer
  useEffect(() => { /* no-op to reference setQueue */ }, [setQueue]);

  // ─── Session Persistence ──────────────────────────────────────────
  // Save current playback state to localStorage so it survives page refreshes.
  const STORAGE_KEY = 'eeriecast_player_state';
  const lastSavedRef = useRef(0);

  // Save periodically (interval-based, every 5 seconds while an episode is loaded)
  useEffect(() => {
    if (!episode?.id || !podcast?.id) return;
    const save = () => {
      try {
        const audio = audioRef?.current;
        const state = {
          episode,
          podcast,
          currentTime: audio ? audio.currentTime : currentTime,
          duration: audio ? (audio.duration || duration) : duration,
          queue: queue.slice(0, 50),
          queueIndex,
          savedAt: Date.now(),
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch { /* storage full or unavailable */ }
    };
    // Save immediately when episode changes
    save();
    const id = setInterval(save, 5000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [episode?.id, podcast?.id, queue.length, queueIndex]);

  // Also save on pause and before unload to capture the latest position
  useEffect(() => {
    const saveNow = () => {
      if (!episode?.id || !podcast?.id) return;
      try {
        const audio = audioRef?.current;
        const state = {
          episode,
          podcast,
          currentTime: audio ? audio.currentTime : currentTime,
          duration: audio ? (audio.duration || duration) : duration,
          queue: queue.slice(0, 50),
          queueIndex,
          savedAt: Date.now(),
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch { /* */ }
    };
    window.addEventListener('beforeunload', saveNow);
    return () => window.removeEventListener('beforeunload', saveNow);
  }, [episode, podcast, currentTime, duration, queue, queueIndex, audioRef]);

  // Session restore is disabled — the mini player should NOT automatically
  // appear when the user freshly opens the app. Playback state is still
  // persisted to localStorage (above) so features like "Continue Listening"
  // can reference it, but the player itself only appears after a deliberate
  // user action (pressing play).

  // ─── User Context (for real-time progress tracking + smart resume) ─
  const { updateEpisodeProgress, episodeProgressMap, isPremium } = useUser() || {};

  // ─── Free-tier chapter gating ──────────────────────────────────────
  const premiumRef = useRef(isPremium);
  useEffect(() => { premiumRef.current = isPremium; }, [isPremium]);
  const navigateRef = useRef(navigate);
  useEffect(() => { navigateRef.current = navigate; }, [navigate]);

  // ─── Smart Resume Wrapper ──────────────────────────────────────────
  // Wraps the raw loadAndPlay to automatically resume from the last known
  // position if the caller passes resume.progress === 0 (i.e. "start from
  // beginning, or wherever we left off").
  const episodeProgressMapRef = useRef(episodeProgressMap);
  useEffect(() => { episodeProgressMapRef.current = episodeProgressMap; }, [episodeProgressMap]);

  const loadAndPlaySmart = useCallback(async (args) => {
    const { episode: ep, resume, ...rest } = args;
    const eid = Number(ep?.id);
    const map = episodeProgressMapRef.current;
    const shouldRemember = getSetting('rememberPosition');

    // If "remember position" is off, always start from the beginning
    if (!shouldRemember) {
      return loadAndPlay({ ...rest, episode: ep, resume: { progress: 0 } });
    }

    // If resume.progress is 0 (default), check if we have saved progress
    if (ep && Number.isFinite(eid) && map && (!resume || resume.progress === 0 || resume.progress == null)) {
      const saved = map.get(eid);
      if (saved && saved.progress > 0 && !saved.completed) {
        return loadAndPlay({ ...rest, episode: ep, resume: { progress: saved.progress } });
      }
    }
    return loadAndPlay({ ...rest, episode: ep, resume });
  }, [loadAndPlay]);

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
          return; // do NOT play
        }
      } else if (item.podcast.is_exclusive) {
        if (!canAccessExclusiveEpisode(item.episode, item.podcast, false)) {
          navigateRef.current(createPageUrl('Premium'));
          return; // do NOT play
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
              navigateRef.current?.(createPageUrl('Premium'));
              return; // do NOT play the next item
            }
          } else if (item.podcast.is_exclusive) {
            if (!canAccessExclusiveEpisode(item.episode, item.podcast, false)) {
              navigateRef.current?.(createPageUrl('Premium'));
              return; // do NOT play the next item
            }
          }
        }
        setQueueIndex(nextIndex);
        await loader({ podcast: item.podcast, episode: item.episode, resume: item.resume });
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Attach ended listener using stable onEndedFn
  useEffect(() => {
    const audio = audioRef?.current;
    if (!audio) return;
    const handler = () => { onEndedFn(); };
    audio.addEventListener('ended', handler);
    return () => {
      audio.removeEventListener('ended', handler);
    };
  }, [audioRef, onEndedFn]);

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
  useEffect(() => {
    if (!episode?.id || !updateEpisodeProgress) return;
    // Update immediately when the episode changes
    const audio = audioRef?.current;
    const ct = audio ? audio.currentTime : currentTime;
    const dur = audio ? (audio.duration || duration) : duration;
    if (dur > 0) updateEpisodeProgress(episode.id, ct, dur);

    // Then every 3 seconds
    const id = setInterval(() => {
      const a = audioRef?.current;
      if (!a || a.paused) return;
      const d = a.duration || duration;
      if (d > 0) updateEpisodeProgress(episode.id, a.currentTime, d);
    }, 3000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [episode?.id, updateEpisodeProgress]);

  // Gate that keeps the mini player hidden until the expanded player's exit
  // animation has fully completed, so the re-entrance animation is visible.
  const [miniPlayerReady, setMiniPlayerReady] = useState(true);
  // Minimized state — shrinks mini player into a small pill/bubble
  const [isMiniPlayerMinimized, setIsMiniPlayerMinimized] = useState(false);

  const handleClosePlayer = () => {
    setShowPlayer(false);
    setShowExpandedPlayer(false);
    setIsMiniPlayerMinimized(false);
    setMiniPlayerReady(true);
    // Clear persisted state when user explicitly closes the player
    try { localStorage.removeItem('eeriecast_player_state'); } catch { /* */ }
  };

  const handleExpandPlayer = () => {
    setShowExpandedPlayer(true);
    setIsMiniPlayerMinimized(false);
    setMiniPlayerReady(true); // not gated when expanding
  };

  const handleCollapsePlayer = () => {
    setShowExpandedPlayer(false);
    setMiniPlayerReady(false); // hide mini player until expanded exit completes
  };

  const handleExpandedExitComplete = () => {
    // Expanded player has fully left the screen — let the mini player animate in
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

  // ─── Handlers to expose to UI ─────────────────────────────────────
  const toggleShuffle = useCallback(() => {
    setIsShuffling((s) => !s);
  }, []);

  const cycleRepeat = useCallback(() => {
    setRepeatMode((m) => (m === 'off' ? 'all' : m === 'all' ? 'one' : 'off'));
  }, []);

  return (
    <AudioPlayerContext.Provider
      value={{
        episode,
        podcast,
        isPlaying,
        currentTime,
        duration,
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
        // sleep timer api
        sleepTimerRemaining,
        sleepTimerEndTime,
        setSleepTimer,
        cancelSleepTimer,
      }}
    >
      {children}

      {/* Expanded Player - shows when user expands (slide-up enter/exit) */}
      <AnimatePresence onExitComplete={handleExpandedExitComplete}>
        {showExpandedPlayer && !hidePlayer && episode && podcast && (
          <motion.div
            key="expanded-player"
            initial={{ opacity: 0, y: '100%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            style={{ position: 'fixed', inset: 0, zIndex: 10100 }}
          >
            <ExpandedPlayer
              podcast={podcast}
              episode={episode}
              isPlaying={isPlaying}
              currentTime={currentTime}
              duration={duration}
              onToggle={toggle}
              onCollapse={handleCollapsePlayer}
              onClose={handleClosePlayer}
              onSeek={seek}
              onSkip={skip}
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
          miniPlayerReady gates mounting until the expanded player's exit
          animation finishes so the CSS enter animation is visible.
          NOTE: The wrapper uses opacity-only exit (no transform) because
          transform on a parent breaks position:fixed inside MobilePlayer.
          The enter animation is a CSS @keyframes on MobilePlayer's own root. */}
      <AnimatePresence>
        {showPlayer && !showExpandedPlayer && !hidePlayer && miniPlayerReady && episode && podcast && (
          <motion.div
            key="mobile-player"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            <MobilePlayer
              podcast={podcast}
              episode={episode}
              isPlaying={isPlaying}
              currentTime={currentTime}
              duration={duration}
              volume={volume}
              onToggle={toggle}
              onExpand={handleExpandPlayer}
              onSkip={skip}
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
          </motion.div>
        )}
      </AnimatePresence>
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
      sleepTimerRemaining: 0,
      sleepTimerEndTime: null,
      setSleepTimer: noop,
      cancelSleepTimer: noop,
    };
  }
  return context;
};
