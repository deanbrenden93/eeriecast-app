import PropTypes from "prop-types";
import { useState, useEffect, useMemo, useRef } from "react";
import { ListMusic, Headphones, Shuffle, Repeat, X, ChevronDown } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useAudioPlayerContext } from "@/context/AudioPlayerContext";
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

export default function MobilePlayer({
  podcast,
  episode,
  isPlaying,
  currentTime = 0,
  duration = 0,
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

  if (!podcast || !episode) return null;

  return (
    <>
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
            className="fixed inset-0 z-[10050] pointer-events-none flex justify-center"
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
          <motion.div
            key="mini-full"
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 60, opacity: 0, scale: 0.9 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className={`fixed left-0 right-0 z-[10050] min-[1001px]:max-w-[1600px] min-[1001px]:left-1/2 min-[1001px]:-translate-x-1/2 min-[1001px]:rounded-t-xl min-[1001px]:bottom-0 ${
              eReaderOpen ? 'bottom-0' : 'bottom-[calc(var(--bottom-nav-h,70px)_+_env(safe-area-inset-bottom,0px))]'
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

              {/* Minimize handle — prominent pull-down zone at top center */}
              {onMinimize && (
                <button
                  type="button"
                  aria-label="Minimize player"
                  onClick={onMinimize}
                  className="absolute top-0 left-1/2 -translate-x-1/2 z-[10] flex flex-col items-center gap-0.5 px-6 pt-1 pb-2.5 group cursor-pointer focus:outline-none"
                >
                  <span className="w-9 h-[3px] rounded-full bg-white/20 group-hover:bg-white/40 transition-colors" />
                  <ChevronDown className="w-3.5 h-3.5 text-white/20 group-hover:text-white/50 transition-colors" />
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
                  <div className="text-white/90 font-semibold text-[clamp(12px,1.8vw,14px)] mb-0.5 whitespace-nowrap overflow-hidden text-ellipsis">
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
                      <div className="min-w-0">
                        <div className="text-white text-sm font-medium truncate">{currentItem.episode?.title || episode.title}</div>
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
                        <div className="min-w-0">
                          <div className="text-white text-sm font-medium truncate">{ep?.title || 'Episode'}</div>
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
  isPlaying: PropTypes.bool,
  currentTime: PropTypes.number,
  duration: PropTypes.number,
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
