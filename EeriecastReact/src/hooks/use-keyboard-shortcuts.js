import { useEffect, useRef } from 'react';
import { getSetting } from '@/hooks/use-settings';

/**
 * Global keyboard shortcuts for the audio player.
 *
 *   Space        → play/pause
 *   ← / →        → seek backward/forward by the user's configured skip interval
 *   M            → mute / unmute
 *
 * Shortcuts are suppressed while the user is typing in an input, textarea,
 * or contenteditable element, and when modifier keys (Ctrl/Cmd/Alt) are held.
 *
 * The caller supplies refs/functions so shortcuts always operate on the
 * latest audio state (the hook does not itself re-subscribe on every frame).
 */
export function useKeyboardShortcuts({
  isActive,
  toggle,
  skip,
  audioRef,
  setVolume,
}) {
  const prevVolumeRef = useRef(null);

  useEffect(() => {
    if (!isActive) return undefined;

    const isEditableTarget = (el) => {
      if (!el) return false;
      const tag = (el.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
      if (el.isContentEditable) return true;
      return false;
    };

    const onKeyDown = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (isEditableTarget(e.target)) return;

      switch (e.code || e.key) {
        case 'Space':
        case ' ':
        case 'Spacebar': {
          e.preventDefault();
          toggle?.();
          break;
        }
        case 'ArrowLeft': {
          e.preventDefault();
          const back = Number(getSetting('skipBackwardSeconds')) || 10;
          skip?.(-back);
          break;
        }
        case 'ArrowRight': {
          e.preventDefault();
          const fwd = Number(getSetting('skipForwardSeconds')) || 10;
          skip?.(fwd);
          break;
        }
        case 'KeyM':
        case 'm':
        case 'M': {
          e.preventDefault();
          const audio = audioRef?.current;
          if (!audio) return;
          const currentVolume = typeof audio.volume === 'number' ? audio.volume : 1;
          if (currentVolume > 0) {
            // Remember current volume so we can restore it
            prevVolumeRef.current = currentVolume;
            setVolume?.(0);
          } else {
            const restored = prevVolumeRef.current && prevVolumeRef.current > 0
              ? prevVolumeRef.current
              : 0.7;
            setVolume?.(restored);
          }
          break;
        }
        default:
          break;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isActive, toggle, skip, audioRef, setVolume]);
}
