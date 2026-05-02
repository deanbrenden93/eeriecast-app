/**
 * Lightweight external store for audio playback time / playing state.
 *
 * Why this exists: audio playback emits `timeupdate` events ~4× per
 * second. Putting `currentTime` / `duration` in React state and
 * exposing it through `AudioPlayerContext` caused every consumer of
 * that context (which includes the entire player surface and several
 * page-level components) to re-render at 4 Hz the entire time audio
 * was playing. That re-render storm was the root cause of the swipe
 * / scroll / open-close stutter on the player screen.
 *
 * The fix is to keep playback time **out of React state entirely**.
 * The time store lives outside React, the audio element pushes new
 * values into it on `timeupdate` / `loadedmetadata` / `play` / `pause`,
 * and components that need to display time subscribe to it via
 * `useAudioTime` — backed by `useSyncExternalStore` so React only
 * re-renders the specific component that subscribed, never the whole
 * `AudioPlayerProvider` subtree.
 *
 * Subscribers can pass a selector to subscribe only to the slice they
 * care about (e.g. `useAudioTime(s => s.isPlaying)` for the play /
 * pause icon — that component doesn't re-render when `currentTime`
 * ticks, only when the playing state actually flips).
 */
import { useSyncExternalStore, useRef, useCallback } from 'react';

// Note: we replace the entire state object on each update rather
// than mutating the same reference. `useSyncExternalStore` compares
// snapshots with `Object.is`, so mutating in place would silently
// hide updates from any subscriber that returns the whole state
// object via the identity selector.
let state = {
  currentTime: 0,
  duration: 0,
  isPlaying: false,
};

const listeners = new Set();

function emit() {
  // Snapshot the listener set so a subscriber that unsubscribes
  // itself during its own callback doesn't mutate the iteration.
  for (const listener of Array.from(listeners)) {
    listener();
  }
}

export const audioTimeStore = {
  getState() {
    return state;
  },
  subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  setCurrentTime(t) {
    const next = Number.isFinite(t) ? t : 0;
    if (state.currentTime === next) return;
    state = { ...state, currentTime: next };
    emit();
  },
  setDuration(d) {
    const next = Number.isFinite(d) ? d : 0;
    if (state.duration === next) return;
    state = { ...state, duration: next };
    emit();
  },
  setIsPlaying(p) {
    const next = !!p;
    if (state.isPlaying === next) return;
    state = { ...state, isPlaying: next };
    emit();
  },
};

const identity = (s) => s;

/**
 * Subscribe to one or more fields from the audio time store.
 *
 * Pass a selector to scope re-renders to the slice you care about.
 * The selector return value is compared with `Object.is`; if it
 * hasn't changed the component does not re-render. This makes it
 * safe to subscribe to a derived value (e.g. progress percent) in a
 * hot path without firing on every `timeupdate`.
 *
 * Without a selector you receive the full state object — fine for
 * components that want every field, but be aware the object identity
 * changes on every event and React will re-render this component
 * every ~250 ms while audio is playing.
 */
export function useAudioTime(selector = identity) {
  // Stabilise the selector so `useSyncExternalStore` doesn't see a
  // new function identity every render (which would force a snapshot
  // re-read each time). Most callers pass an inline arrow.
  const selectorRef = useRef(selector);
  selectorRef.current = selector;

  const getSnapshot = useCallback(
    () => selectorRef.current(audioTimeStore.getState()),
    []
  );
  return useSyncExternalStore(audioTimeStore.subscribe, getSnapshot, getSnapshot);
}
