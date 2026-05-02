// filepath: c:\Users\jdura\Documents\BitBenders\Eeriecast\EeriecastReact\src\hooks\use-audio-player.js
import { useCallback, useEffect, useRef, useState } from 'react';
import { getEpisodeAudioUrl } from '@/lib/utils';
import { UserLibrary, Episode as EpisodeApi } from '@/api/entities';
import { audioTimeStore } from '@/hooks/use-audio-time';

function getDeviceId() {
  try {
    const key = 'device_id';
    let id = localStorage.getItem(key);
    if (!id) {
      id = crypto?.randomUUID?.() || Math.random().toString(36).slice(2);
      localStorage.setItem(key, id);
    }
    return id;
  } catch {
    return 'web-unknown';
  }
}

// ─── Per-show playback speed memory ────────────────────────────────
// Persists a map of { [podcastId]: playbackRate } so audiobooks can stay at 1x
// while true-story podcasts stay at 1.5x (etc.) across sessions.
const PER_SHOW_SPEED_KEY = 'eeriecast_per_show_speed';

function readPerShowSpeedMap() {
  try {
    const raw = localStorage.getItem(PER_SHOW_SPEED_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writePerShowSpeedMap(map) {
  try { localStorage.setItem(PER_SHOW_SPEED_KEY, JSON.stringify(map || {})); } catch { /* */ }
}

/** Returns the remembered playback rate for a podcast id, or null. */
export function getSavedPlaybackRateForPodcast(podcastId) {
  if (!podcastId && podcastId !== 0) return null;
  const map = readPerShowSpeedMap();
  const key = String(podcastId);
  const val = parseFloat(map[key]);
  return Number.isFinite(val) && val > 0 ? val : null;
}

/** Remember the current playback rate for a given podcast id. */
export function savePlaybackRateForPodcast(podcastId, rate) {
  if (!podcastId && podcastId !== 0) return;
  const r = parseFloat(rate);
  if (!Number.isFinite(r) || r <= 0) return;
  const map = readPerShowSpeedMap();
  map[String(podcastId)] = r;
  writePerShowSpeedMap(map);
}

export function useAudioPlayer({ onEnd } = {}) {
  const audioRef = useRef(null);
  const heartbeatRef = useRef(null);
  const [episode, setEpisode] = useState(null);
  const [podcast, setPodcast] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  // currentTime / duration deliberately do NOT live in React state.
  // They tick up to 4×/sec while audio plays, and routing them
  // through state was forcing every consumer of `AudioPlayerContext`
  // (effectively the entire player surface) to re-render at 4 Hz —
  // the root cause of the player-screen scroll/swipe stutter. They
  // now live in `audioTimeStore` and components that need them
  // subscribe via the `useAudioTime` hook, which scopes re-renders
  // to the specific element that displays time.
  const [volume, setVolumeState] = useState(0.7); // Default 70% volume
  const [playbackRate, setPlaybackRateState] = useState(() => {
    try { return parseFloat(localStorage.getItem('eeriecast_playback_rate')) || 1; } catch { return 1; }
  });
  const deviceId = useRef(getDeviceId());

  // init audio element once
  if (!audioRef.current && typeof window !== 'undefined') {
    audioRef.current = new Audio();
    audioRef.current.preload = 'metadata';
    audioRef.current.volume = 0.7; // Set initial volume
    try { audioRef.current.playbackRate = parseFloat(localStorage.getItem('eeriecast_playback_rate')) || 1; } catch { /* */ }
  }

  // bind events
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    let lastTimeUpdate = 0;
    const onTime = () => {
      const now = Date.now();
      if (now - lastTimeUpdate < 250) return;
      lastTimeUpdate = now;
      audioTimeStore.setCurrentTime(audio.currentTime || 0);
    };
    const onMeta = () => audioTimeStore.setDuration(audio.duration || 0);
    const onPlay = async () => {
      setIsPlaying(true);
      audioTimeStore.setIsPlaying(true);
      if (episode?.id) {
        try {
          await UserLibrary.updateProgress(episode.id, {
            progress: Math.floor(audio.currentTime || 0),
            duration: Math.floor(audio.duration || 0) || episode.duration || 0,
            event: 'play',
            playback_rate: audio.playbackRate || 1.0,
            source: 'web',
            device_id: deviceId.current,
          });
        } catch (e) {
          if (typeof console !== 'undefined') console.debug('progress play failed', e);
        }
      }
      startHeartbeat();
    };
    const onPause = async () => {
      setIsPlaying(false);
      audioTimeStore.setIsPlaying(false);
      stopHeartbeat();
      if (episode?.id) {
        try {
          await UserLibrary.updateProgress(episode.id, {
            progress: Math.floor(audio.currentTime || 0),
            duration: Math.floor(audio.duration || 0) || episode.duration || 0,
            event: 'pause',
            playback_rate: audio.playbackRate || 1.0,
            source: 'web',
            device_id: deviceId.current,
          });
        } catch (e) {
          if (typeof console !== 'undefined') console.debug('progress pause failed', e);
        }
      }
    };
    const onEnded = async () => {
      stopHeartbeat();
      setIsPlaying(false);
      audioTimeStore.setIsPlaying(false);
      if (episode?.id) {
        try {
          await UserLibrary.updateProgress(episode.id, {
            progress: Math.floor(audio.duration || 0) || episode.duration || 0,
            duration: Math.floor(audio.duration || 0) || episode.duration || 0,
            event: 'complete',
            playback_rate: audio.playbackRate || 1.0,
            source: 'web',
            device_id: deviceId.current,
          });
        } catch (e) {
          if (typeof console !== 'undefined') console.debug('progress complete failed', e);
        }
      }
      onEnd && onEnd();
    };

    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('loadedmetadata', onMeta);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnded);

    return () => {
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('loadedmetadata', onMeta);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnded);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [episode?.id]);

  const visHandlerRef = useRef(null);

  const startHeartbeat = () => {
    stopHeartbeat();
    const runInterval = () => {
      heartbeatRef.current = setInterval(async () => {
        const audio = audioRef.current;
        if (!audio || !episode?.id || audio.paused) return;
        try {
          await UserLibrary.updateProgress(episode.id, {
            progress: Math.floor(audio.currentTime || 0),
            duration: Math.floor(audio.duration || 0) || episode.duration || 0,
            event: 'heartbeat',
            playback_rate: audio.playbackRate || 1.0,
            source: 'web',
            device_id: deviceId.current,
          });
        } catch (e) {
          if (typeof console !== 'undefined') console.debug('progress heartbeat failed', e);
        }
      }, 30000);
    };

    if (visHandlerRef.current) {
      document.removeEventListener('visibilitychange', visHandlerRef.current);
    }
    const onVis = () => {
      if (document.hidden) {
        if (heartbeatRef.current) { clearInterval(heartbeatRef.current); heartbeatRef.current = null; }
      } else {
        if (!heartbeatRef.current) runInterval();
      }
    };
    visHandlerRef.current = onVis;
    document.addEventListener('visibilitychange', onVis);

    runInterval();
  };

  const stopHeartbeat = () => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
    if (visHandlerRef.current) {
      document.removeEventListener('visibilitychange', visHandlerRef.current);
      visHandlerRef.current = null;
    }
  };

  const loadAndPlay = useCallback(async ({ podcast: p, episode: ep, resume, autoplay = true }) => {
    const audio = audioRef.current;
    if (!audio || !ep) return false;

    // Resolve audio URL first; if unavailable, try the public episode endpoint
    // (no auth required), then fall back to the authenticated history endpoint.
    let url = getEpisodeAudioUrl(ep);
    if (!url && ep?.id) {
      // 1. Try the public episode detail endpoint (works for all users)
      try {
        const fullEp = await EpisodeApi.get(ep.id);
        if (fullEp) {
          url = getEpisodeAudioUrl(fullEp) || fullEp.audio_url;
          if (url) ep = { ...ep, audio_url: url };
        }
      } catch { /* endpoint unavailable */ }
    }
    if (!url && ep?.id) {
      // 2. Fall back to the authenticated history endpoint
      try {
        const histResp = await UserLibrary.updateProgress(ep.id, {
          progress: Math.floor(resume?.progress || 0),
          duration: Math.floor(ep.duration || 0),
          event: 'play',
          source: 'web',
          device_id: deviceId.current,
        });
        if (histResp?.episode_detail) {
          url = getEpisodeAudioUrl(histResp.episode_detail);
          if (url) ep = { ...ep, audio_url: url };
        }
      } catch { /* not authenticated or endpoint unavailable */ }
    }
    if (!url) {
      console.warn('[Eeriecast] No audio URL for episode:', ep?.id, ep?.title);
      return false;
    }

    try {
      // Stop any current playback and fully reset the element to avoid stale audio
      try { audio.pause(); } catch (e) { /* ignore pause error */ }
      try { audio.removeAttribute('src'); } catch (e) { /* ignore remove src error */ }
      try { audio.load(); } catch (e) { /* ignore load reset error */ }

      // Swap in the new source and resume position. Reset the
      // external time store so the UI doesn't flash the previous
      // episode's elapsed/total time during the brief window before
      // the new media's `loadedmetadata` / first `timeupdate` fires.
      audioTimeStore.setCurrentTime(Math.max(0, Math.floor(resume?.progress || 0)));
      audioTimeStore.setDuration(0);
      audio.src = url;
      // Apply playback rate: prefer per-show memory (so audiobooks stay at 1x
      // while podcasts remember 1.5x), then fall back to the global default.
      try {
        const perShow = getSavedPlaybackRateForPodcast(p?.id || podcast?.id);
        const fallback = parseFloat(localStorage.getItem('eeriecast_playback_rate')) || 1;
        const rate = perShow || fallback;
        audio.playbackRate = rate;
        setPlaybackRateState(rate);
      } catch { /* */ }

      const resumeSeconds = Math.max(0, Math.floor(resume?.progress || 0));
      // Best-effort: set immediately (may be ignored until metadata loads)
      try { if (resumeSeconds > 0) audio.currentTime = resumeSeconds; } catch {}

      // Once metadata is available, re-apply seek to guarantee resume works
      const ensureResume = () => {
        if (resumeSeconds > 0) {
          try {
            const dur = Number.isFinite(audio.duration) ? Math.max(0, audio.duration) : 0;
            const target = dur > 0 ? Math.min(resumeSeconds, Math.max(0, dur - 0.5)) : resumeSeconds;
            audio.currentTime = target;
          } catch { /* ignore */ }
        }
        audio.removeEventListener('loadedmetadata', ensureResume);
        audio.removeEventListener('canplay', ensureResume);
      };
      audio.addEventListener('loadedmetadata', ensureResume);
      audio.addEventListener('canplay', ensureResume);

      // Update UI state after we have a valid source set
      setPodcast(p || podcast);
      setEpisode(ep);

      if (autoplay) {
        try {
          await audio.play();
        } catch (e) {
          if (typeof console !== 'undefined') console.debug('autoplay blocked or play failed', e);
          // Leave paused; user interaction can trigger play
        }
      }
      // When `autoplay === false` we deliberately leave the audio
      // loaded-but-paused. This is the rehydration path: the mini
      // player needs an episode in state and a real `src` on the
      // audio element so the user's first tap on play actually
      // starts the track instead of doing nothing.
      return true;
    } catch (e) {
      if (typeof console !== 'undefined') console.debug('loadAndPlay failed', e);
      return false;
    }
  }, [podcast]);

  const toggle = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      try { await audio.play(); } catch (e) { if (typeof console !== 'undefined') console.debug('play failed', e); }
    } else {
      audio.pause();
    }
  }, []);

  const pause = useCallback(() => {
    const audio = audioRef.current;
    if (audio && !audio.paused) audio.pause();
  }, []);

  const play = useCallback(async () => {
    const audio = audioRef.current;
    if (audio && audio.paused) {
      try { await audio.play(); } catch (e) { if (typeof console !== 'undefined') console.debug('play failed', e); }
    }
  }, []);

  const seek = useCallback(async (seconds) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.min(Math.max(0, seconds), audio.duration || seconds);
    if (episode?.id) {
      try {
        await UserLibrary.updateProgress(episode.id, {
          progress: Math.floor(audio.currentTime || 0),
          duration: Math.floor(audio.duration || 0) || episode.duration || 0,
          event: 'seek',
          playback_rate: audio.playbackRate || 1.0,
          source: 'web',
          device_id: deviceId.current,
        });
      } catch (e) {
        if (typeof console !== 'undefined') console.debug('seek failed', e);
      }
    }
  }, [episode?.id, episode?.duration]);

  const skip = useCallback((delta) => {
    const audio = audioRef.current;
    if (!audio) return;
    seek((audio.currentTime || 0) + delta);
  }, [seek]);

  const setVolume = useCallback((vol) => {
    const audio = audioRef.current;
    if (!audio) return;
    const newVolume = Math.max(0, Math.min(1, vol));
    audio.volume = newVolume;
    setVolumeState(newVolume);
  }, []);

  const setPlaybackRate = useCallback((rate) => {
    const audio = audioRef.current;
    const r = Math.max(0.5, Math.min(3, rate));
    if (audio) audio.playbackRate = r;
    setPlaybackRateState(r);
    try { localStorage.setItem('eeriecast_playback_rate', String(r)); } catch { /* */ }
    // Remember this rate for the currently playing show so it sticks next time
    if (podcast?.id != null) savePlaybackRateForPodcast(podcast.id, r);
  }, [podcast?.id]);

  return {
    audioRef,
    episode,
    podcast,
    isPlaying,
    // currentTime / duration are intentionally NOT returned here —
    // see `audioTimeStore` / `useAudioTime` in
    // `@/hooks/use-audio-time`. Anything that needs to display
    // playback time should subscribe through the store so a
    // 4 Hz tick doesn't cascade through `AudioPlayerContext`.
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
  };
}
