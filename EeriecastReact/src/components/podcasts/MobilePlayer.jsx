import PropTypes from "prop-types";
import { useState, useEffect, useMemo, useRef, memo } from "react";
import { ListMusic, Headphones, Shuffle, Repeat, X } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useAudioPlayerContext } from "@/context/AudioPlayerContext";
import { useAudioTime } from "@/hooks/use-audio-time";
import { AnimatePresence, motion } from "framer-motion";

const PlayIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
    <path d="M8 5v14l11-7z"/>
  </svg>
);

const PauseIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
    <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
  </svg>
);

const NextIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
    <path d="M5 18l10-6L5 6v12zm11-12v12h2V6h-2z"/>
  </svg>
);

const PrevIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
    <path d="M6 6h2v12H6V6zm3.5 6l8.5 6V6l-8.5 6z"/>
  </svg>
);

function PressableIconButton({ className = "", onClick, ariaLabel, children }) {
  const [pressed, setPressed] = useState(false);
  const press = () => {
    setPressed(true);
    setTimeout(() => setPressed(false), 160);
  };
  return (
    <button
      aria-label={ariaLabel}
      onMouseDown={press}
      onTouchStart={press}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      onTouchEnd={() => setPressed(false)}
      onClick={onClick}
      className={`relative transition-transform duration-150 will-change-transform ${pressed ? "scale-[0.94]" : "scale-100"} ${className}`}
    >
      {pressed && (
        <span className="pointer-events-none absolute inset-0 rounded-full animate-ping bg-white/5" />
      )}
      <span className="relative z-[1] flex items-center justify-center">
        {children}
      </span>
    </button>
  );
}

PressableIconButton.propTypes = {
  className: PropTypes.string,
  onClick: PropTypes.func,
  ariaLabel: PropTypes.string,
  children: PropTypes.node,
};

function MobilePlayer({
  podcast,
  episode,
  onToggle,
  onExpand,
  onSkip,
  onNext,
  onPrev,
  onSeek,
  volume = 0.7,
  onVolumeChange,
  isShuffling,
  repeatMode,
  onShuffleToggle,
  onRepeatToggle,
  queue = [],
  queueIndex = -1,
  onClose,
  isMinimized = false,
  onMinimize,
  onRestore,
}) {
  // currentTime / duration / isPlaying come from `audioTimeStore` so
  // the parent provider's render cycle is not coupled to 4 Hz time
  // updates. See `@/hooks/use-audio-time` for the rationale.
  const audioTime = useAudioTime();
  const currentTime = audioTime.currentTime;
  const duration = audioTime.duration;
  const isPlaying = audioTime.isPlaying;
  const [localShuffle, setLocalShuffle] = useState(false);
  const [localRepeatMode, setLocalRepeatMode] = useState('off');
  const [showQueue, setShowQueue] = useState(false);
  const { loadAndPlay, playQueueIndex, pause, sleepTimerRemaining, playbackRate } = useAudioPlayerContext() || {};

  // Detect when the e-reader overlay is open so we can drop to the very bottom
  const [eReaderOpen, setEReaderOpen] = useState(
    () => document.documentElement.classList.contains('ereader-active')
  );
  useEffect(() => {
    const obs = new MutationObserver(() => {
      setEReaderOpen(document.documentElement.classList.contains('ereader-active'));
    });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);
  const sleepTimerActive = sleepTimerRemaining > 0;
  const speedActive = playbackRate != null && playbackRate !== 1;

  const shuffleActive = onShuffleToggle ? !!isShuffling : localShuffle;
  const effectiveRepeat = onRepeatToggle ? (repeatMode || 'off') : localRepeatMode;

  const cover = episode?.cover_image || podcast?.cover_image;
  const pct = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;

  const { currentItem, upNext } = useMemo(() => {
    if (Array.isArray(queue) && queue.length > 0 && queueIndex >= 0 && queueIndex < queue.length) {
      const current = queue[queueIndex];
      return { currentItem: current, upNext: queue.slice(queueIndex + 1) };
    }
    const allEps = Array.isArray(podcast?.episodes) ? podcast.episodes : [];
    const currentId = episode?.id ?? episode?.slug;
    const idx = allEps.findIndex((e) => (e?.id ?? e?.slug) === currentId);
    const nextList = idx >= 0 ? allEps.slice(idx + 1).map((ep) => ({ podcast, episode: ep })) : allEps.slice(0, 10).map((ep) => ({ podcast, episode: ep }));
    return { currentItem: { podcast, episode }, upNext: nextList };
  }, [queue, queueIndex, podcast, episode]);

  const onBarClick = (e) => {
    if (!onSeek || duration <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    onSeek(ratio * duration);
  };

  const onVolumeClick = (e) => {
    if (!onVolumeChange) return;
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    onVolumeChange(ratio);
  };

  const handleShuffle = () => {
    if (onShuffleToggle) return onShuffleToggle();
    setLocalShuffle((s) => !s);
  };

  const handleRepeat = () => {
    if (onRepeatToggle) return onRepeatToggle();
    setLocalRepeatMode((m) => (m === 'off' ? 'all' : m === 'all' ? 'one' : 'off'));
  };

  const handlePlayFromQueue = async (item, indexInQueue) => {
    if (!item) return;
    if (typeof playQueueIndex === 'function' && typeof indexInQueue === 'number') {
      await playQueueIndex(indexInQueue);
      setShowQueue(false);
      return;
    }
    if (typeof loadAndPlay === 'function') {
      await loadAndPlay({ podcast: item.podcast, episode: item.episode, resume: item.resume || { progress: 0 } });
      setShowQueue(false);
    }
  };

  // Refs for the pill drag boundary and drag-vs-click detection
  const pillBoundsRef = useRef(null);
  const didDragRef = useRef(false);

  const handlePillRestore = () => {
    // Don't fire restore if the user was dragging
    if (didDragRef.current) { didDragRef.current = false; return; }
    onRestore?.();
  };

  // ── Mini-player swipe gestures ───────────────────────────────────
  // Four intent-mapped gestures on the full-width mini player:
  //   • Swipe up    → expand into the full player
  //   • Swipe down  → minimize to the floating pill
  //   • Swipe ←/→   → close (pauses + dismisses)
  //
  // Implementation note: an earlier version of this tried to play
  // a "fly-off" animation BEFORE calling the parent handler, both
  // via reactive animate-prop changes and via imperative
  // useAnimationControls. Both routes fought with framer's drag
  // release snap-back, race-conditioned with AnimatePresence's
  // mode="wait" outer transitions, and produced the cascading
  // "gesture animates twice / pill never appears / re-tap into
  // mini disappears for good" bugs. The simple approach below —
  // detect commit on dragEnd, fire the parent handler
  // immediately, let the existing AnimatePresence variants handle
  // the visual transition — is what works.
  //
  // dragConstraints={{0,0,0,0}} + dragElastic gives the gesture
  // its physical "give" during the drag itself. dragMomentum=
  // false stops kinetic coast on release, so the bar always
  // returns to rest when no commit threshold was met.
  const SWIPE_AXIS_PX = 56;
  const SWIPE_AXIS_VELOCITY = 500;
  // Slightly more generous tap guard than the original 10 px —
  // touch input on phones routinely drifts 12–14 px during a
  // "stationary" tap, especially with a thumb on a glass surface.
  // At 10 px those drifts were classifying clean taps as drags
  // and `handleFullClickCapture` was swallowing the synthetic
  // click, producing the "first tap on the mini doesn't register"
  // bug. 18 px is still well below any of the directional commit
  // thresholds (≥56 px) so real swipes are unaffected.
  const SWIPE_TAP_GUARD = 18;
  const fullPlayerDraggedRef = useRef(false);

  // Defensive reset: any time the mini-full node mounts (the bar
  // came back from the pill or from the expanded player) we clear
  // the dragged flag. Previously, a swipe-to-minimize would set
  // the flag to true and then unmount mini-full before the
  // synthetic click reached `handleFullClickCapture` to clear it
  // — so the FIRST click on the next mini-full instance would
  // hit a stale `true` and get swallowed. Resetting on mount
  // guarantees every fresh bar starts in a clean state.
  useEffect(() => {
    if (!isMinimized) {
      fullPlayerDraggedRef.current = false;
    }
  }, [isMinimized]);

  const handleFullDragStart = () => {
    fullPlayerDraggedRef.current = false;
  };

  const handleFullDrag = (_e, info) => {
    if (
      Math.abs(info.offset.x) > SWIPE_TAP_GUARD ||
      Math.abs(info.offset.y) > SWIPE_TAP_GUARD
    ) {
      fullPlayerDraggedRef.current = true;
    }
  };

  const handleFullDragEnd = (_e, info) => {
    if (!fullPlayerDraggedRef.current) return;
    const dx = info.offset.x;
    const dy = info.offset.y;
    const vx = info.velocity.x;
    const vy = info.velocity.y;
    const horizontalDominant = Math.abs(dx) >= Math.abs(dy);

    // Swipe UP → expand. The expanded player has its own slide-
    // up enter animation that visually replaces the mini bar, so
    // we just hand off — no need to pre-animate the mini.
    if (!horizontalDominant && (dy < -SWIPE_AXIS_PX || vy < -SWIPE_AXIS_VELOCITY)) {
      onExpand?.();
      return;
    }

    // Swipe DOWN → minimize. AnimatePresence mode="wait" handles
    // the mini-full → pill crossfade.
    if (!horizontalDominant && (dy > SWIPE_AXIS_PX || vy > SWIPE_AXIS_VELOCITY)) {
      onMinimize?.();
      return;
    }

    // Swipe SIDEWAYS → close. Pause first so the bar's exit
    // doesn't overlap with audible playback.
    if (
      horizontalDominant &&
      (Math.abs(dx) > SWIPE_AXIS_PX || Math.abs(vx) > SWIPE_AXIS_VELOCITY)
    ) {
      try { pause && pause(); } catch { /* ignore */ }
      onClose?.();
      return;
    }

    // Otherwise dragConstraints + dragElastic snap the bar back
    // automatically — no action needed here.
  };

  // Suppress synthetic clicks fired after a drag — without this, a
  // swipe-to-close that ends on the album-art zone would also pop
  // the expanded player open. Same pattern as the notification
  // swipe-to-delete in the layout shell.
  const handleFullClickCapture = (e) => {
    if (fullPlayerDraggedRef.current) {
      e.preventDefault();
      e.stopPropagation();
      fullPlayerDraggedRef.current = false;
    }
  };

  if (!podcast || !episode) return null;

  return (
    <>
      {/* AnimatePresence with `initial={true}` (the default) so the
          mini-full / pill node animates in on every mount —
          including the first time MobilePlayer is mounted by
          AudioPlayerContext (e.g. after collapsing the expanded
          player back down). The wrapper in AudioPlayerContext is
          intentionally NOT a `motion.div` (see the long note in
          AudioPlayerContext where this wrapper is rendered for the
          mobile-Safari containing-block reasoning), so this inner
          AnimatePresence is the ONLY place the mini gets an
          entrance animation — without it the bar would snap in at
          full opacity and the expanded → mini hand-off would feel
          choppy. `mode="wait"` is preserved so a swap between the
          full bar and the pill (minimize ↔ restore) doesn't briefly
          double-up. */}
      <AnimatePresence mode="wait">
        {isMinimized ? (
          /* ─── Minimized Pill ─────────────────────────────────────── */
          /* Full-viewport boundary keeps the pill on screen when dragged */
          <motion.div
            key="mini-pill-bounds"
            ref={pillBoundsRef}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            // Z-INDEX POLICY (mini player layer)
            // ─────────────────────────────────
            // Default: `z-40` — above page content + bottom nav, but
            // BELOW splash (z-100), onboarding (z-100), and every
            // modal in the app (z-50 → z-[10200]). This keeps the
            // mini from ever floating over a dialog, drawer, sheet,
            // landing/splash, premium page, or onboarding flow.
            // When the e-reader / comic reader takes over the
            // viewport (z-[9999]) we deliberately bump above it so
            // playback can still be controlled while reading. The
            // expanded player (z-[10100]) and shadcn dialogs
            // (z-[10200]) still sit above us in that mode.
            className={`fixed inset-0 ${eReaderOpen ? 'z-[10080]' : 'z-40'} pointer-events-none flex justify-center`}
            style={{
              alignItems: 'flex-end',
              paddingBottom: eReaderOpen
                ? '12px'
                : 'calc(var(--bottom-nav-h, 70px) + env(safe-area-inset-bottom, 0px) + 14px)',
            }}
          >
            <motion.div
              initial={{ scale: 0.3, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.3, opacity: 0, y: 20 }}
              transition={{ type: 'spring', damping: 22, stiffness: 350 }}
              drag
              dragConstraints={pillBoundsRef}
              dragElastic={0.12}
              dragMomentum={false}
              whileDrag={{ scale: 1.08 }}
              onDrag={() => { didDragRef.current = true; }}
              className="pointer-events-auto cursor-grab active:cursor-grabbing"
            >
              <button
                type="button"
                onClick={handlePillRestore}
                className="group flex items-center gap-1.5 p-1.5 rounded-full bg-[#18181f]/95 backdrop-blur-xl border border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.5),_0_0_0_1px_rgba(255,255,255,0.04)] hover:border-white/[0.15] hover:shadow-[0_8px_32px_rgba(220,38,38,0.15)] transition-all duration-300"
              >
                {/* Art */}
                <div className="relative w-10 h-10 rounded-full overflow-hidden flex-shrink-0 ring-1 ring-white/[0.08]">
                  {cover ? (
                    <img src={cover} alt={episode.title} className="w-full h-full object-cover" draggable={false} />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-red-600/30 to-eeriecast-violet/30 flex items-center justify-center">
                      <Headphones className="w-4 h-4 text-white/50" />
                    </div>
                  )}
                  {/* Playing indicator ring */}
                  {isPlaying && (
                    <div className="absolute inset-0 rounded-full border-2 border-red-500/60 animate-pulse" />
                  )}
                </div>

                {/* Play/Pause */}
                <div
                  onClick={(e) => { e.stopPropagation(); if (!didDragRef.current) onToggle?.(); didDragRef.current = false; }}
                  className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors flex-shrink-0"
                >
                  <div className="w-4 h-4 flex items-center justify-center text-white">
                    {isPlaying ? <PauseIcon /> : <PlayIcon />}
                  </div>
                </div>
              </button>

              {/* Tiny progress bar under the pill */}
              <div className="mt-1 mx-auto w-full h-[2px] bg-white/[0.06] rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-red-600 to-red-500 rounded-full transition-[width] duration-1000 ease-linear"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </motion.div>
          </motion.div>
        ) : (
          /* ─── Full Mini Player ──────────────────────────────────── */
          /* This is the full-width mini player. The wrapper provided
             by AudioPlayerContext is intentionally NOT animated and
             has no `transform` / `will-change: transform` (those on
             an ancestor would make the wrapper a containing block
             for this `position: fixed` element and cause the mobile
             Safari "gap on scroll" bug — the wrapper now mirrors
             the bottom nav's static `position: fixed` strategy).
             The `initial={false}` on the parent AnimatePresence
             still prevents the variant motion from running on
             first mount of MobilePlayer; the internal motion props
             here remain scoped to the *minimize ↔ restore*
             transition only and use a tiny, transform-only slide so
             they don't trigger a backdrop-filter recomposite. */
          <motion.div
            key="mini-full"
            // Opacity-only entrance — NO y translation. A
            // translated entrance (initial y: 12 → animate y: 0)
            // mounted the bar 12 px below its rest position and
            // slid it up, which (a) read to users as "the bar
            // jumped down a few pixels", and (b) made the first
            // tap land on a moving target — the framer drag
            // gesture interpreted the small finger drift as drag
            // intent and `handleFullClickCapture` swallowed the
            // synthetic click. Fading at the rest position fixes
            // both at once: nothing visibly translates, so taps
            // land where the user expects.
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            // The exit keeps a y-translation (slide-down + fade)
            // because that's an unmount path — the bar isn't
            // accepting taps as it leaves, and the downward
            // motion is what makes the minimize transition feel
            // satisfying as it hands off to the pill's spring
            // entrance.
            exit={{ y: 64, opacity: 0 }}
            transition={{ type: 'tween', duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
            drag
            dragDirectionLock
            dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
            dragElastic={0.18}
            dragMomentum={false}
            onDragStart={handleFullDragStart}
            onDrag={handleFullDrag}
            onDragEnd={handleFullDragEnd}
            onClickCapture={handleFullClickCapture}
            // pointer-events-auto: the AudioPlayerContext wrapper is
            // pointer-events-none (so it doesn't swallow taps on
            // page content behind the mini player); we re-enable
            // them here for the actual interactive surface.
            // See "Z-INDEX POLICY" comment on the minimized pill
            // above for the full reasoning. Same rule applies here:
            // sit below all modals/overlays in normal mode, above
            // the e-reader specifically so playback stays
            // controllable while reading.
            className={`fixed left-0 right-0 pointer-events-auto ${eReaderOpen ? 'z-[10080]' : 'z-40'} ${
              eReaderOpen ? 'bottom-0' : 'max-[1000px]:bottom-[calc(var(--bottom-nav-h,70px)_+_env(safe-area-inset-bottom,0px))] min-[1001px]:bottom-0'
            }`}
          >
            <div
              className="group relative h-[clamp(80px,10vh,100px)] eeriecast-glass border-t border-white/[0.06] flex items-center px-[clamp(8px,2vw,20px)] gap-[clamp(4px,1vw,12px)]"
            >
              {/* Close button — top left corner, above album art */}
              <button
                type="button"
                aria-label="Close player"
                onClick={() => { pause && pause(); onClose && onClose(); }}
                className="absolute -top-2 left-1 z-[10] p-1 rounded-full bg-zinc-800/90 border border-white/10 text-white/50 hover:text-white hover:bg-zinc-700 transition-all focus:outline-none"
                style={{ lineHeight: 0 }}
              >
                <X className="w-3.5 h-3.5" />
              </button>

              {/* Minimize handle — the nib alone is universally
                  understood as "drag/swipe me down" (every iOS
                  sheet, Android bottom sheet, and Apple Music mini
                  player uses the same affordance). The previous
                  ChevronDown duplicated the signal and added visual
                  weight without communicating anything new, so it's
                  gone. The hit zone stays the same generous 48×24
                  pull-down strip so a tap on the nib still
                  minimizes for users who prefer that to a swipe. */}
              {onMinimize && (
                <button
                  type="button"
                  aria-label="Minimize player"
                  onClick={onMinimize}
                  className="absolute top-0 left-1/2 -translate-x-1/2 z-[10] flex flex-col items-center gap-0.5 px-6 pt-1.5 pb-3 group cursor-pointer focus:outline-none"
                >
                  <span className="w-9 h-[3px] rounded-full bg-white/20 group-hover:bg-white/40 transition-colors" />
                </button>
              )}

              {/* Clickable left zone: art + info → opens expanded player */}
              <div
                onClick={onExpand}
                className="flex items-center gap-[clamp(4px,1vw,12px)] flex-1 min-w-0 cursor-pointer"
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onExpand?.(); }}
                aria-label="Expand player"
              >
                {/* Album Art */}
                <div
                  className="relative w-[clamp(36px,6vw,50px)] h-[clamp(36px,6vw,50px)] rounded-lg overflow-hidden shadow-[0_4px_15px_rgba(0,0,0,0.4)] transition-transform hover:scale-105 flex-shrink-0 bg-gradient-to-br from-red-600/20 to-eeriecast-violet/20 flex items-center justify-center ring-1 ring-white/[0.06]"
                >
                  {cover ? (
                    <img src={cover} alt={episode.title} className="w-full h-full object-cover object-center" />
                  ) : (
                    <Headphones className="w-[clamp(18px,3vw,24px)] h-[clamp(18px,3vw,24px)] text-white/50" />
                  )}
                </div>

                {/* Track Info */}
                <div className="flex-1 min-w-0 pr-[clamp(4px,1vw,12px)] mr-[clamp(4px,1vw,8px)]">
                  <div
                    title={episode.title}
                    className="text-white/90 font-semibold text-[clamp(12px,1.8vw,14px)] mb-0.5 line-clamp-2 break-words"
                  >
                    {episode.title}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-zinc-500 text-[clamp(10px,1.5vw,12px)] whitespace-nowrap overflow-hidden text-ellipsis">
                      {podcast.title}
                    </div>
                    {speedActive && (
                      <span className="inline-flex items-center text-[10px] font-semibold text-indigo-400 bg-indigo-400/10 border border-indigo-400/20 rounded-full px-1.5 py-0.5 flex-shrink-0 tabular-nums">
                        {playbackRate}x
                      </span>
                    )}
                    {sleepTimerActive && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-full px-1.5 py-0.5 font-mono flex-shrink-0 tabular-nums">
                        <span className="relative flex h-1.5 w-1.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-400" />
                        </span>
                        {(() => { const m = Math.floor(sleepTimerRemaining / 60); const s = sleepTimerRemaining % 60; return `${m}:${s.toString().padStart(2, '0')}`; })()}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Controls */}
              <div className="flex items-center gap-[clamp(0px,0.5vw,4px)] flex-shrink-0 z-[3]">
                <PressableIconButton
                  ariaLabel="Shuffle"
                  aria-pressed={shuffleActive}
                  onClick={handleShuffle}
                  className={`hidden sm:flex w-[clamp(28px,4vw,38px)] h-[clamp(28px,4vw,38px)] rounded-full transition-colors items-center justify-center flex-shrink-0 ${shuffleActive ? 'text-red-500' : 'text-zinc-500 hover:text-red-400'}`}
                >
                  <Shuffle className="w-[clamp(14px,2vw,18px)] h-[clamp(14px,2vw,18px)]" strokeWidth={2} />
                </PressableIconButton>

                <PressableIconButton
                  ariaLabel="Previous track"
                  onClick={() => onPrev && onPrev()}
                  className="w-[clamp(28px,4vw,38px)] h-[clamp(28px,4vw,38px)] rounded-full text-zinc-400 hover:text-white hover:bg-white/[0.04] transition-all flex items-center justify-center flex-shrink-0"
                >
                  <PrevIcon />
                </PressableIconButton>

                <PressableIconButton
                  ariaLabel={isPlaying ? 'Pause' : 'Play'}
                  onClick={onToggle}
                  className="w-[clamp(32px,5vw,42px)] h-[clamp(32px,5vw,42px)] rounded-full bg-gradient-to-br from-red-600 to-red-700 text-white shadow-[0_2px_12px_rgba(220,38,38,0.25)] hover:shadow-[0_4px_16px_rgba(220,38,38,0.35)]"
                >
                  <div className={`w-[clamp(16px,2.5vw,20px)] h-[clamp(16px,2.5vw,20px)] flex items-center justify-center transition-transform duration-200 ease-out ${isPlaying ? 'rotate-180' : 'rotate-0'}`}>
                    {isPlaying ? <PauseIcon /> : <PlayIcon />}
                  </div>
                </PressableIconButton>

                <PressableIconButton
                  ariaLabel="Next track"
                  onClick={() => onNext && onNext()}
                  className="w-[clamp(28px,4vw,38px)] h-[clamp(28px,4vw,38px)] rounded-full text-zinc-400 hover:text-white hover:bg-white/[0.04] transition-all flex items-center justify-center flex-shrink-0"
                >
                  <NextIcon />
                </PressableIconButton>

                <PressableIconButton
                  ariaLabel="Repeat"
                  aria-pressed={effectiveRepeat !== 'off'}
                  onClick={handleRepeat}
                  className={`hidden sm:flex w-[clamp(28px,4vw,38px)] h-[clamp(28px,4vw,38px)] rounded-full transition-colors relative items-center justify-center flex-shrink-0 ${effectiveRepeat !== 'off' ? 'text-red-500' : 'text-zinc-500 hover:text-red-400'}`}
                >
                  <Repeat className="w-[clamp(14px,2vw,18px)] h-[clamp(14px,2vw,18px)]" strokeWidth={2} />
                  {effectiveRepeat === 'one' && (
                    <span className="absolute -right-0.5 -bottom-0.5 text-[10px] leading-none bg-red-600 text-white rounded px-[2px] py-[1px]">1</span>
                  )}
                </PressableIconButton>
              </div>

              {/* Volume - desktop */}
              <div className="hidden md:flex items-center gap-2 ml-[clamp(4px,1vw,8px)] flex-shrink-0">
                <div className="w-[clamp(50px,8vw,80px)] h-1 bg-white/[0.06] hover:bg-white/[0.08] rounded-full overflow-hidden cursor-pointer transition-all" onClick={onVolumeClick}>
                  <div className="h-full bg-gradient-to-r from-red-600 to-red-500 rounded-full transition-all duration-200" style={{ width: `${volume * 100}%` }} />
                </div>
              </div>

              {/* Queue button - desktop */}
              <PressableIconButton ariaLabel="Queue" onClick={() => setShowQueue(true)} className="hidden md:flex p-[clamp(6px,1vw,10px)] text-zinc-500 hover:text-white transition-colors flex-shrink-0">
                <ListMusic className="w-[clamp(16px,2vw,18px)] h-[clamp(16px,2vw,18px)]" strokeWidth={2} />
              </PressableIconButton>

              {/* Progress Bar */}
              <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-white/[0.06] cursor-pointer z-[2]" onClick={onBarClick}>
                <div
                  className="h-full bg-gradient-to-r from-red-600 to-red-500 transition-[width] duration-200 ease-out shadow-[0_0_8px_rgba(220,38,38,0.3)]"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>

            {/* Queue Sheet */}
            <Sheet open={showQueue} onOpenChange={setShowQueue}>
              <SheetContent side="bottom" className="eeriecast-glass border-t border-white/[0.06] px-4 py-4 max-h-[70vh] overflow-y-auto">
                <SheetHeader>
                  <SheetTitle className="text-white/90">Up Next</SheetTitle>
                </SheetHeader>
                <div className="mt-2 space-y-1">
                  {currentItem?.episode && (
                    <div className="flex items-center gap-3 p-2.5 rounded-lg bg-white/[0.04] ring-1 ring-white/[0.06]">
                      <img src={currentItem.episode?.cover_image || currentItem.podcast?.cover_image || cover} alt={currentItem.episode?.title || episode.title} className="w-10 h-10 rounded-lg object-cover" />
                      <div className="min-w-0 flex-1">
                        <div
                          title={currentItem.episode?.title || episode.title}
                          className="text-white text-sm font-medium line-clamp-2 break-words"
                        >
                          {currentItem.episode?.title || episode.title}
                        </div>
                        <div className="text-zinc-500 text-xs truncate">Now Playing · {currentItem.podcast?.title || podcast.title}</div>
                      </div>
                    </div>
                  )}
                  {(!upNext || upNext.length === 0) && (
                    <div className="text-zinc-600 text-sm py-6 text-center">No upcoming episodes</div>
                  )}
                  {upNext && upNext.map((item, idx) => {
                    const absoluteIndex = (Array.isArray(queue) && queue.length > 0 && queueIndex >= 0) ? (queueIndex + 1 + idx) : undefined;
                    const ep = item.episode || item;
                    const pd = item.podcast || podcast;
                    const key = (ep?.id ?? ep?.slug ?? idx);
                    return (
                      <button key={key} onClick={() => handlePlayFromQueue(item, absoluteIndex)} className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-white/[0.04] transition-colors text-left">
                        {ep?.cover_image || pd?.cover_image ? (
                          <img src={ep?.cover_image || pd?.cover_image} alt={ep?.title || 'Episode'} className="w-10 h-10 rounded-lg object-cover" />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-white/[0.06] flex items-center justify-center text-zinc-600 text-xs">EP</div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div
                            title={ep?.title || 'Episode'}
                            className="text-white text-sm font-medium line-clamp-2 break-words"
                          >
                            {ep?.title || 'Episode'}
                          </div>
                          <div className="text-zinc-500 text-xs truncate">{pd?.title || ''}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </SheetContent>
            </Sheet>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

MobilePlayer.propTypes = {
  podcast: PropTypes.object,
  episode: PropTypes.object,
  // isPlaying / currentTime / duration are sourced from `useAudioTime`,
  // not props — see `@/hooks/use-audio-time`.
  onToggle: PropTypes.func,
  onExpand: PropTypes.func,
  onSkip: PropTypes.func,
  onNext: PropTypes.func,
  onPrev: PropTypes.func,
  onSeek: PropTypes.func,
  onClose: PropTypes.func,
  volume: PropTypes.number,
  onVolumeChange: PropTypes.func,
  isShuffling: PropTypes.bool,
  repeatMode: PropTypes.oneOf(['off', 'all', 'one']),
  onShuffleToggle: PropTypes.func,
  onRepeatToggle: PropTypes.func,
  queue: PropTypes.array,
  queueIndex: PropTypes.number,
  isMinimized: PropTypes.bool,
  onMinimize: PropTypes.func,
  onRestore: PropTypes.func,
};

// Memoised — see ExpandedPlayer.jsx for the rationale. Time-driven
// UI subscribes to `audioTimeStore` directly, so re-rendering this
// tree on every parent state change is wasted work.
const MemoMobilePlayer = memo(MobilePlayer);
export default MemoMobilePlayer;
