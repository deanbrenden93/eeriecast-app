import PropTypes from "prop-types";
import { useState, useMemo } from "react";
import { ListMusic, Headphones, Shuffle, Repeat, X } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useAudioPlayerContext } from "@/context/AudioPlayerContext";

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
}) {
  const [localShuffle, setLocalShuffle] = useState(false);
  const [localRepeatMode, setLocalRepeatMode] = useState('off');
  const [showQueue, setShowQueue] = useState(false);
  const { loadAndPlay, playQueueIndex, pause, sleepTimerRemaining, playbackRate } = useAudioPlayerContext() || {};
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

  return (
    <>
      {podcast && episode && (
        <div 
          className="fixed left-0 right-0 z-[2000] min-[1001px]:max-w-[1600px] min-[1001px]:left-1/2 min-[1001px]:-translate-x-1/2 min-[1001px]:rounded-t-xl bottom-[calc(var(--bottom-nav-h,70px)_+_env(safe-area-inset-bottom,0px))] min-[1001px]:bottom-0 animate-mini-player-in"
        >
          <div
            className="group relative h-[clamp(80px,10vh,100px)] eeriecast-glass border-t border-white/[0.06] flex items-center px-[clamp(8px,2vw,20px)] gap-[clamp(4px,1vw,12px)]"
          >
            {/* Close button */}
            <button
              type="button"
              aria-label="Close player"
              onClick={() => { pause && pause(); onClose && onClose(); }}
              className="absolute top-1.5 right-1.5 p-1 rounded-full text-white/30 hover:text-white hover:bg-white/5 transition-all focus:outline-none z-[10]"
              style={{ lineHeight: 0 }}
            >
              <X className="w-3.5 h-3.5" />
            </button>

            {/* Swipe indicator */}
            <div onClick={onExpand} style={{cursor: 'pointer'}} className="absolute top-[5px] left-1/2 -translate-x-1/2 w-8 h-0.5 bg-white/15 rounded-full" />

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
                ariaLabel="Rewind 15 seconds"
                onClick={() => onSkip && onSkip(-15)}
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
                ariaLabel="Skip 30 seconds"
                onClick={() => onSkip && onSkip(30)}
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
  queue: PropTypes.array,
  queueIndex: PropTypes.number,
};
