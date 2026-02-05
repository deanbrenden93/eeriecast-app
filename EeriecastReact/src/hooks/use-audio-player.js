// filepath: c:\Users\jdura\Documents\BitBenders\Eeriecast\EeriecastReact\src\hooks\use-audio-player.js
import { useCallback, useEffect, useRef, useState } from 'react';
import { getEpisodeAudioUrl } from '@/lib/utils';
import { UserLibrary } from '@/api/entities';

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

export function useAudioPlayer({ onEnd } = {}) {
  const audioRef = useRef(null);
  const heartbeatRef = useRef(null);
  const [episode, setEpisode] = useState(null);
  const [podcast, setPodcast] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(0.7); // Default 70% volume
  const deviceId = useRef(getDeviceId());

  // init audio element once
  if (!audioRef.current && typeof window !== 'undefined') {
    audioRef.current = new Audio();
    audioRef.current.preload = 'metadata';
    audioRef.current.volume = 0.7; // Set initial volume
  }

  // bind events
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => setCurrentTime(audio.currentTime || 0);
    const onMeta = () => setDuration(audio.duration || 0);
    const onPlay = async () => {
      setIsPlaying(true);
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

  const startHeartbeat = () => {
    stopHeartbeat();
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
    }, 30000); // 30s heartbeat
  };

  const stopHeartbeat = () => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
  };

  const loadAndPlay = useCallback(async ({ podcast: p, episode: ep, resume }) => {
    const audio = audioRef.current;
    if (!audio || !ep) return;

    // Resolve audio URL first; if unavailable, do not update UI state
    const url = getEpisodeAudioUrl(ep);
    if (!url) {
      if (typeof console !== 'undefined') console.debug('No audio URL for episode', ep?.id || ep?.title || ep);
      return;
    }

    try {
      // Stop any current playback and fully reset the element to avoid stale audio
      try { audio.pause(); } catch (e) { /* ignore pause error */ }
      try { audio.removeAttribute('src'); } catch (e) { /* ignore remove src error */ }
      try { audio.load(); } catch (e) { /* ignore load reset error */ }

      // Swap in the new source and resume position
      audio.src = url;

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

      try {
        await audio.play();
      } catch (e) {
        if (typeof console !== 'undefined') console.debug('autoplay blocked or play failed', e);
        // Leave paused; user interaction can trigger play
      }
    } catch (e) {
      if (typeof console !== 'undefined') console.debug('loadAndPlay failed', e);
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

  return {
    audioRef,
    episode,
    podcast,
    isPlaying,
    currentTime,
    duration,
    volume,
    setVolume,
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
