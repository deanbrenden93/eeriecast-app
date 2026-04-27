import { useEffect, useRef, useState, useCallback } from "react";
import PropTypes from "prop-types";
import { Shuffle } from "lucide-react";

/**
 * Hold-to-confirm shuffle button.
 *
 * A single tap does nothing — listeners must press and hold for the
 * full hold duration (default 700ms) for the shuffle to fire. While
 * held, a circular progress arc fills around the icon to telegraph
 * what's happening. Releasing early aborts cleanly. This makes the
 * "randomize my queue" action deliberate enough that an accidental
 * tap on the queue screen can't blow up the order the listener
 * curated.
 */
export default function HoldToShuffleButton({
  onConfirm,
  disabled = false,
  holdMs = 700,
  label = "Shuffle",
  className = "",
}) {
  const [progress, setProgress] = useState(0);
  const [confirmed, setConfirmed] = useState(false);
  const startRef = useRef(0);
  const rafRef = useRef(0);
  const firedRef = useRef(false);

  const cancel = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
    if (!firedRef.current) {
      // Snap back to empty unless we've already fired the action,
      // in which case the success flash is handled separately.
      setProgress(0);
    }
  }, []);

  const tick = useCallback(() => {
    const now = performance.now();
    const pct = Math.min(1, (now - startRef.current) / holdMs);
    setProgress(pct);
    if (pct >= 1) {
      if (!firedRef.current) {
        firedRef.current = true;
        setConfirmed(true);
        try { onConfirm?.(); } catch { /* swallow — UI already animated */ }
        // Brief success flash before resetting back to idle
        setTimeout(() => {
          setConfirmed(false);
          setProgress(0);
        }, 550);
      }
      return;
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [holdMs, onConfirm]);

  const start = useCallback((e) => {
    if (disabled) return;
    e?.preventDefault?.();
    if (firedRef.current) return; // wait for reset cycle
    startRef.current = performance.now();
    rafRef.current = requestAnimationFrame(tick);
  }, [disabled, tick]);

  const stop = useCallback(() => {
    if (firedRef.current) return; // success path is handling reset
    cancel();
    firedRef.current = false;
  }, [cancel]);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  // Reset firedRef once the success animation finishes so the button
  // can be re-armed for another shuffle.
  useEffect(() => {
    if (!confirmed && firedRef.current) {
      // Will be cleared by the timeout in tick(); guard here too.
      firedRef.current = false;
    }
  }, [confirmed]);

  // Geometry for the progress ring
  const size = 38;
  const stroke = 2.5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dashOffset = c * (1 - progress);

  return (
    <button
      type="button"
      disabled={disabled}
      onMouseDown={start}
      onMouseUp={stop}
      onMouseLeave={stop}
      onTouchStart={start}
      onTouchEnd={stop}
      onTouchCancel={stop}
      onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') start(e); }}
      onKeyUp={(e) => { if (e.key === ' ' || e.key === 'Enter') stop(); }}
      // Block context menus on long-press so mobile users can hold without
      // the OS hijacking the gesture for "Save image" etc.
      onContextMenu={(e) => e.preventDefault()}
      aria-label={`${label} (hold to confirm)`}
      title={`Hold to ${label.toLowerCase()}`}
      className={`relative inline-flex items-center justify-center rounded-full transition-all duration-200 select-none
        ${disabled
          ? 'text-white/20 cursor-not-allowed'
          : confirmed
            ? 'text-emerald-300'
            : progress > 0
              ? 'text-white scale-105'
              : 'text-white/40 hover:text-white/80'
        }
        ${className}`}
      style={{ width: size, height: size, WebkitTouchCallout: 'none' }}
    >
      <svg
        className="absolute inset-0 -rotate-90"
        width={size}
        height={size}
        aria-hidden="true"
      >
        {/* Track ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="currentColor"
          strokeOpacity="0.12"
          strokeWidth={stroke}
          fill="none"
        />
        {/* Progress ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={confirmed ? '#34d399' : '#ff0040'}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={dashOffset}
          style={{ transition: progress === 0 ? 'stroke-dashoffset 200ms ease-out' : 'none' }}
        />
      </svg>
      <Shuffle
        className={`w-4 h-4 transition-transform duration-300 ${confirmed ? 'scale-110' : progress > 0 ? 'scale-95' : ''}`}
        strokeWidth={2.2}
      />
    </button>
  );
}

HoldToShuffleButton.propTypes = {
  onConfirm: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
  holdMs: PropTypes.number,
  label: PropTypes.string,
  className: PropTypes.string,
};
