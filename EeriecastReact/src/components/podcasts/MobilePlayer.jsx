import PropTypes from "prop-types";
import { useState, useMemo } from "react";
import { ListMusic, Headphones, Shuffle, Repeat, X } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useAudioPlayerContext } from "@/context/AudioPlayerContext";

// Custom SVG icons matching the vanilla JS version exactly
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

// Small reusable pressable icon button with pulse + scale feedback
function PressableIconButton({
  className = "",
  onClick,
  ariaLabel,
  children,
}) {
  const [pressed, setPressed] = useState(false);
  const press = () => {
    setPressed(true);
    // Auto-release in case mouseup/touchend doesn't fire (fast taps)
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
      {/* Pulse ring */}
      {pressed && (
        <span className="pointer-events-none absolute inset-0 rounded-full animate-ping bg-white/10" />
      )}
      {/* Content */}
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
  onSeek,
  volume = 0.7,
  onVolumeChange,
  // Optional visual state for buttons (can be controlled by parent)
  isShuffling,
  repeatMode, // 'off' | 'all' | 'one'
  onShuffleToggle,
  onRepeatToggle,
  // New: global queue props
  queue = [],
  queueIndex = -1,
  onClose,
}) {
  // Hooks must be declared before any early returns
  const [localShuffle, setLocalShuffle] = useState(false);
  const [localRepeatMode, setLocalRepeatMode] = useState('off');
  const [showQueue, setShowQueue] = useState(false);
  const { loadAndPlay, playQueueIndex, pause } = useAudioPlayerContext() || {};

  const shuffleActive = onShuffleToggle ? !!isShuffling : localShuffle;
  const effectiveRepeat = onRepeatToggle ? (repeatMode || 'off') : localRepeatMode;

  // compute cover safely in case podcast/episode are not provided yet
  const cover = episode?.cover_image || podcast?.cover_image;
  const pct = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;

  // Derive a lightweight Up Next list: prefer global queue if provided
  const {
    currentItem,
    upNext,
  } = useMemo(() => {
    if (Array.isArray(queue) && queue.length > 0 && queueIndex >= 0 && queueIndex < queue.length) {
      const current = queue[queueIndex];
      return {
        currentItem: current,
        upNext: queue.slice(queueIndex + 1),
      };
    }
    // Fallback: use episodes from current podcast
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
    // Fallback: directly load and play the episode if queue controls not available
    if (typeof loadAndPlay === 'function') {
      await loadAndPlay({ podcast: item.podcast, episode: item.episode, resume: item.resume || { progress: 0 } });
      setShowQueue(false);
    }
  };

  return (
    <>
      {podcast && episode && (
        <div 
          className="fixed left-0 right-0 z-[2000] min-[1001px]:max-w-[1600px] min-[1001px]:left-1/2 min-[1001px]:-translate-x-1/2 min-[1001px]:rounded-t-lg bottom-[calc(80px_+_env(safe-area-inset-bottom,0px))] min-[1001px]:bottom-0"
        >
          {/* Mini Player Bar Container with padding on left/right */}
          <div
            className="group relative h-[clamp(85px,10vh,105px)] bg-gradient-to-b from-[rgba(24,24,24,0.98)] to-[rgba(18,18,18,0.98)] backdrop-blur-[20px] saturate-[180%] shadow-[0_-4px_30px_rgba(0,0,0,0.7),0_-1px_0_rgba(255,255,255,0.1)] border-t border-t-white/5 flex items-center px-[clamp(8px,2vw,20px)] gap-[clamp(4px,1vw,12px)]"
          >
            {/* Close button (subtle) */}
            <button
              type="button"
              aria-label="Close player"
              onClick={() => { pause && pause(); onClose && onClose(); }}
              className="absolute top-1 right-1 p-1 rounded-full text-white/40 hover:text-white hover:bg-white/10 transition-colors focus:outline-none z-[10]"
              style={{ lineHeight: 0 }}
            >
              <X className="w-4 h-4" />
            </button>

            {/* Swipe indicator bar */}
            <div onClick={onExpand} style={{cursor: 'pointer'}} className="absolute top-[6px] left-1/2 -translate-x-1/2 w-8 h-1 bg-white/20 rounded-sm" />

            {/* Album Art */}
            <div
              onClick={onExpand}
              className="relative w-[clamp(36px,6vw,52px)] h-[clamp(36px,6vw,52px)] rounded-[clamp(4px,0.5vw,8px)] overflow-hidden shadow-[0_4px_15px_rgba(0,0,0,0.4)] transition-transform hover:scale-105 flex-shrink-0 cursor-pointer bg-gradient-to-br from-[#ff0040] to-[#9d00ff] flex items-center justify-center"
            >
              {cover ? (
                <img src={cover} alt={episode.title} className="w-full h-full object-cover object-center" />
              ) : (
                <Headphones className="w-[clamp(18px,3vw,26px)] h-[clamp(18px,3vw,26px)] text-white/80" />
              )}
              {/* Expand hint overlay */}
              <div className="absolute inset-0 bg-black/70 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                  <path d="M7 7h10v10M8 16L17 7"/>
                </svg>
              </div>
            </div>

            {/* Track Info */}
            <div className="flex-1 min-w-0 pr-[clamp(4px,1vw,12px)] mr-[clamp(4px,1vw,8px)]">
              <div className="text-white font-semibold text-[clamp(12px,1.8vw,15px)] mb-0.5 whitespace-nowrap overflow-hidden text-ellipsis">
                {episode.title}
              </div>
              <div className="text-[#b3b3b3] text-[clamp(10px,1.5vw,13px)] whitespace-nowrap overflow-hidden text-ellipsis">
                {podcast.title}
              </div>
            </div>

            {/* Player Controls */}
            <div className="flex items-center gap-[clamp(0px,0.5vw,4px)] flex-shrink-0 z-[3]">
              {/* Shuffle button */}
              <PressableIconButton
                ariaLabel="Shuffle"
                aria-pressed={shuffleActive}
                onClick={handleShuffle}
                className={`hidden sm:flex w-[clamp(28px,4vw,40px)] h-[clamp(28px,4vw,40px)] rounded-full transition-colors items-center justify-center flex-shrink-0 text-[#b3b3b3] hover:text-[#ff0040] ${shuffleActive ? 'text-[#ff0040]' : ''}`}
              >
                <Shuffle className="w-[clamp(14px,2vw,20px)] h-[clamp(14px,2vw,20px)]" strokeWidth={2} />
              </PressableIconButton>

              {/* Previous button */}
              <PressableIconButton
                ariaLabel="Rewind 15 seconds"
                onClick={() => onSkip && onSkip(-15)}
                className="w-[clamp(28px,4vw,40px)] h-[clamp(28px,4vw,40px)] rounded-full text-[#b3b3b3] hover:text-white hover:bg-white/5 transition-all flex items-center justify-center flex-shrink-0"
              >
                <PrevIcon />
              </PressableIconButton>

              {/* Play/Pause button */}
              <PressableIconButton
                ariaLabel={isPlaying ? 'Pause' : 'Play'}
                onClick={onToggle}
                className="w-[clamp(32px,5vw,44px)] h-[clamp(32px,5vw,44px)] rounded-full bg-gradient-to-br from-white/95 to-white/85 text-black shadow-[0_2px_8px_rgba(0,0,0,0.2)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.3)]"
              >
                <div className={`w-[clamp(16px,2.5vw,22px)] h-[clamp(16px,2.5vw,22px)] flex items-center justify-center transition-transform duration-200 ease-out ${isPlaying ? 'rotate-180' : 'rotate-0'}`}>
                  {isPlaying ? <PauseIcon /> : <PlayIcon />}
                </div>
              </PressableIconButton>

              {/* Next button */}
              <PressableIconButton
                ariaLabel="Skip 30 seconds"
                onClick={() => onSkip && onSkip(30)}
                className="w-[clamp(28px,4vw,40px)] h-[clamp(28px,4vw,40px)] rounded-full text-[#b3b3b3] hover:text-white hover:bg-white/5 transition-all flex items-center justify-center flex-shrink-0"
              >
                <NextIcon />
              </PressableIconButton>

              {/* Repeat button */}
              <PressableIconButton
                ariaLabel="Repeat"
                aria-pressed={effectiveRepeat !== 'off'}
                onClick={handleRepeat}
                className={`hidden sm:flex w-[clamp(28px,4vw,40px)] h-[clamp(28px,4vw,40px)] rounded-full transition-colors relative items-center justify-center flex-shrink-0 text-[#b3b3b3] hover:text-[#ff0040] ${effectiveRepeat !== 'off' ? 'text-[#ff0040]' : ''}`}
              >
                <Repeat className="w-[clamp(14px,2vw,20px)] h-[clamp(14px,2vw,20px)]" strokeWidth={2} />
                {effectiveRepeat === 'one' && (
                  <span className="absolute -right-0.5 -bottom-0.5 text-[10px] leading-none bg-[#ff0040] text-white rounded px-[2px] py-[1px]">1</span>
                )}
              </PressableIconButton>
            </div>

            {/* Volume section - desktop only */}
            <div className="hidden md:flex items-center gap-2 ml-[clamp(4px,1vw,8px)] flex-shrink-0">
              <div className="w-[clamp(50px,8vw,80px)] h-1 bg-white/10 hover:bg-white/15 rounded-[10px] overflow-hidden cursor-pointer transition-all" onClick={onVolumeClick}>
                <div className="h-full bg-gradient-to-r from-[#ff0040] to-[#9d00ff] rounded-[10px] transition-all duration-200" style={{ width: `${volume * 100}%` }} />
              </div>
            </div>

            {/* Queue button - desktop only */}
            <PressableIconButton ariaLabel="Queue" onClick={() => setShowQueue(true)} className="hidden md:flex p-[clamp(6px,1vw,10px)] text-[#b3b3b3] hover:text-white transition-colors flex-shrink-0">
              <ListMusic className="w-[clamp(16px,2vw,20px)] h-[clamp(16px,2vw,20px)]" strokeWidth={2} />
            </PressableIconButton>

            {/* Progress Bar - absolute at bottom */}
            <div className="absolute bottom-0 left-0 right-0 h-[clamp(2px,0.4vh,4px)] bg-white/10 cursor-pointer z-[2]" onClick={onBarClick}>
              <div
                className="h-full bg-gradient-to-r from-[#ff0040] to-[#9d00ff] transition-[width] duration-200 ease-out"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          {/* Queue Sheet */}
          <Sheet open={showQueue} onOpenChange={setShowQueue}>
            <SheetContent side="bottom" className="bg-[rgba(18,18,18,0.98)] border-t border-white/5 px-4 py-4 max-h-[70vh] overflow-y-auto">
              <SheetHeader>
                <SheetTitle className="text-white/90">Up Next</SheetTitle>
              </SheetHeader>
              <div className="mt-2 space-y-2">
                {/* Now Playing */}
                {currentItem?.episode && (
                  <div className="flex items-center gap-3 p-2 rounded-md bg-white/5">
                    <img src={currentItem.episode?.cover_image || currentItem.podcast?.cover_image || cover} alt={currentItem.episode?.title || episode.title} className="w-10 h-10 rounded object-cover" />
                    <div className="min-w-0">
                      <div className="text-white text-sm font-medium truncate">{currentItem.episode?.title || episode.title}</div>
                      <div className="text-white/50 text-xs truncate">Now Playing · {currentItem.podcast?.title || podcast.title}</div>
                    </div>
                  </div>
                )}
                {/* Up Next List */}
                {(!upNext || upNext.length === 0) && (
                  <div className="text-white/60 text-sm py-6 text-center">No upcoming episodes</div>
                )}
                {upNext && upNext.map((item, idx) => {
                  const absoluteIndex = (Array.isArray(queue) && queue.length > 0 && queueIndex >= 0) ? (queueIndex + 1 + idx) : undefined;
                  const ep = item.episode || item; // fallback
                  const pd = item.podcast || podcast;
                  const key = (ep?.id ?? ep?.slug ?? idx);
                  return (
                    <button key={key} onClick={() => handlePlayFromQueue(item, absoluteIndex)} className="w-full flex items-center gap-3 p-2 rounded-md hover:bg-white/5 transition-colors text-left">
                      {ep?.cover_image || pd?.cover_image ? (
                        <img src={ep?.cover_image || pd?.cover_image} alt={ep?.title || 'Episode'} className="w-10 h-10 rounded object-cover" />
                      ) : (
                        <div className="w-10 h-10 rounded bg-white/10 flex items-center justify-center text-white/60 text-xs">EP</div>
                      )}
                      <div className="min-w-0">
                        <div className="text-white text-sm font-medium truncate">{ep?.title || 'Episode'}</div>
                        <div className="text-white/50 text-xs truncate">{pd?.title || ''}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      )}
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
  onSeek: PropTypes.func,
  onClose: PropTypes.func,
  volume: PropTypes.number,
  onVolumeChange: PropTypes.func,
  isShuffling: PropTypes.bool,
  repeatMode: PropTypes.oneOf(['off', 'all', 'one']),
  onShuffleToggle: PropTypes.func,
  onRepeatToggle: PropTypes.func,
  // new
  queue: PropTypes.array,
  queueIndex: PropTypes.number,
};
