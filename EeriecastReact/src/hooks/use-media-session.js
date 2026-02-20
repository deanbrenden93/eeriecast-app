import { useEffect, useRef, useCallback } from 'react';

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
  currentTime,
  duration,
  playbackRate,
  onPlay,
  onPause,
  onNext,
  onPrev,
  onSeek,
  onSkip,
}) {
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

  // ── Sync position state (throttled to avoid excessive calls) ───────
  const lastPositionUpdateRef = useRef(0);

  const updatePositionState = useCallback(() => {
    if (!supported) return;
    // Only update once per second to avoid performance issues
    const now = Date.now();
    if (now - lastPositionUpdateRef.current < 1000) return;
    lastPositionUpdateRef.current = now;

    // setPositionState requires valid finite values; skip if not ready
    if (!duration || !Number.isFinite(duration) || duration <= 0) return;
    const pos = Number.isFinite(currentTime) ? Math.max(0, Math.min(currentTime, duration)) : 0;
    const rate = Number.isFinite(playbackRate) && playbackRate > 0 ? playbackRate : 1;

    try {
      navigator.mediaSession.setPositionState({
        duration,
        playbackRate: rate,
        position: pos,
      });
    } catch {
      // Some browsers throw if position > duration due to rounding
    }
  }, [supported, currentTime, duration, playbackRate]);

  useEffect(() => {
    updatePositionState();
  }, [updatePositionState]);
}
