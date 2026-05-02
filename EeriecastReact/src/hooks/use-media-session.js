import { useEffect, useRef } from 'react';
import { audioTimeStore } from '@/hooks/use-audio-time';

/**
 * Syncs playback state to the Media Session API, providing:
 *  - Lock screen / notification shade metadata (title, artist, artwork)
 *  - Lock screen transport controls (play, pause, next, prev, seek)
 *  - Hardware media key support (Bluetooth headphones, car stereos, etc.)
 *  - iOS Control Center "Now Playing" widget
 *
 * This is a pure side-effect hook — it renders nothing.
 */
export function useMediaSession({
  episode,
  podcast,
  isPlaying,
  playbackRate,
  onPlay,
  onPause,
  onNext,
  onPrev,
  onSeek,
  onSkip,
}) {
  // currentTime and duration are deliberately not parameters. They
  // come straight from `audioTimeStore` (the same source as the
  // in-app player UI) so the OS Now-Playing position update doesn't
  // have to ride React state. Keeping them out of the param list
  // also means React doesn't have to re-run this hook 4×/sec for the
  // 1 Hz position-state push the OS actually wants.
  // ── Guard: bail out if browser doesn't support Media Session ──
  const supported = typeof navigator !== 'undefined' && 'mediaSession' in navigator;

  // Keep callbacks in refs so action handlers never go stale
  const onPlayRef = useRef(onPlay);
  const onPauseRef = useRef(onPause);
  const onNextRef = useRef(onNext);
  const onPrevRef = useRef(onPrev);
  const onSeekRef = useRef(onSeek);
  const onSkipRef = useRef(onSkip);

  useEffect(() => { onPlayRef.current = onPlay; }, [onPlay]);
  useEffect(() => { onPauseRef.current = onPause; }, [onPause]);
  useEffect(() => { onNextRef.current = onNext; }, [onNext]);
  useEffect(() => { onPrevRef.current = onPrev; }, [onPrev]);
  useEffect(() => { onSeekRef.current = onSeek; }, [onSeek]);
  useEffect(() => { onSkipRef.current = onSkip; }, [onSkip]);

  // ── Register action handlers once ──────────────────────────────────
  useEffect(() => {
    if (!supported) return;
    const ms = navigator.mediaSession;

    const actions = [
      ['play', () => onPlayRef.current?.()],
      ['pause', () => onPauseRef.current?.()],
      ['nexttrack', () => onNextRef.current?.()],
      ['previoustrack', () => onPrevRef.current?.()],
      ['seekforward', (details) => onSkipRef.current?.(details?.seekOffset || 10)],
      ['seekbackward', (details) => onSkipRef.current?.(-(details?.seekOffset || 10))],
      ['seekto', (details) => {
        if (details?.seekTime != null) onSeekRef.current?.(details.seekTime);
      }],
      ['stop', () => onPauseRef.current?.()],
    ];

    const registered = [];
    for (const [action, handler] of actions) {
      try {
        ms.setActionHandler(action, handler);
        registered.push(action);
      } catch {
        // Some browsers don't support all actions (e.g. seekto) — that's fine
      }
    }

    // Cleanup: unregister all handlers on unmount
    return () => {
      for (const action of registered) {
        try { ms.setActionHandler(action, null); } catch { /* */ }
      }
    };
  }, [supported]);

  // ── Sync metadata when episode/podcast changes ─────────────────────
  useEffect(() => {
    if (!supported || !episode) return;
    const ms = navigator.mediaSession;

    const coverUrl = episode.cover_image || podcast?.cover_image || '';

    // Build artwork array with multiple sizes for best platform support
    const artwork = [];
    if (coverUrl) {
      artwork.push(
        { src: coverUrl, sizes: '96x96', type: 'image/jpeg' },
        { src: coverUrl, sizes: '128x128', type: 'image/jpeg' },
        { src: coverUrl, sizes: '192x192', type: 'image/jpeg' },
        { src: coverUrl, sizes: '256x256', type: 'image/jpeg' },
        { src: coverUrl, sizes: '384x384', type: 'image/jpeg' },
        { src: coverUrl, sizes: '512x512', type: 'image/jpeg' },
      );
    }

    try {
      ms.metadata = new MediaMetadata({
        title: episode.title || 'Unknown Episode',
        artist: podcast?.title || podcast?.author || 'Eeriecast',
        album: podcast?.title || 'Eeriecast',
        artwork,
      });
    } catch (e) {
      if (typeof console !== 'undefined') console.debug('MediaSession metadata failed', e);
    }
  }, [supported, episode?.id, episode?.title, episode?.cover_image, podcast?.title, podcast?.author, podcast?.cover_image]);

  // ── Sync playback state ────────────────────────────────────────────
  useEffect(() => {
    if (!supported) return;
    try {
      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
    } catch { /* */ }
  }, [supported, isPlaying]);

  // ── Sync position state (subscribed directly to the time store,
  //     throttled to ~1 Hz so we never trip the OS rate limiter) ────
  // Keep `playbackRate` in a ref so the subscription closure always
  // sees the latest value without having to re-bind on every change.
  const playbackRateRef = useRef(playbackRate);
  useEffect(() => { playbackRateRef.current = playbackRate; }, [playbackRate]);

  useEffect(() => {
    if (!supported) return undefined;
    let lastPushed = 0;
    const push = () => {
      const now = Date.now();
      if (now - lastPushed < 1000) return;
      const { currentTime, duration } = audioTimeStore.getState();
      if (!duration || !Number.isFinite(duration) || duration <= 0) return;
      lastPushed = now;
      const pos = Number.isFinite(currentTime)
        ? Math.max(0, Math.min(currentTime, duration))
        : 0;
      const rateRaw = playbackRateRef.current;
      const rate = Number.isFinite(rateRaw) && rateRaw > 0 ? rateRaw : 1;
      try {
        navigator.mediaSession.setPositionState({
          duration,
          playbackRate: rate,
          position: pos,
        });
      } catch {
        // Some browsers throw if position > duration due to rounding
      }
    };
    // Push once on mount so the OS has an initial position (e.g.
    // when the user resumes a saved session and never moves the
    // play head in the first second).
    push();
    return audioTimeStore.subscribe(push);
  }, [supported]);
}
