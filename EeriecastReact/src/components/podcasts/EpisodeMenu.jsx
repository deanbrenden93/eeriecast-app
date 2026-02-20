import PropTypes from 'prop-types';
import { useRef, useState, useEffect, useCallback } from 'react';
import { MoreVertical, SkipForward, ListPlus, ListMinus, Plus, Play } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { useAudioPlayerContext } from '@/context/AudioPlayerContext';
import { toast } from '@/components/ui/use-toast';

/**
 * Three-dot overflow menu for episode actions.
 *
 * Props:
 *  - episode      – the episode object
 *  - podcast      – the parent podcast/show object
 *  - onPlayNow    – optional callback; when provided, shows "Play Now" at the top
 *  - onRemoveFromQueue – optional callback; when provided, replaces "Add to Queue" with "Remove from Queue"
 *  - onAddToPlaylist – optional callback to trigger the Add-to-Playlist modal
 *  - className    – optional extra classes on the trigger button
 *  - side         – dropdown placement side (default "bottom")
 *  - align        – dropdown alignment (default "end")
 */
export default function EpisodeMenu({
  episode,
  podcast,
  onPlayNow,
  onRemoveFromQueue,
  onAddToPlaylist,
  className = '',
  side = 'bottom',
  align = 'end',
  inline = false,
}) {
  const { addNext, addToQueue } = useAudioPlayerContext();

  // ── Controlled open state for scroll-aware behavior ──
  const [menuOpen, setMenuOpen] = useState(false);

  // Track whether the current touch gesture is a scroll (not a tap)
  const touchStartRef = useRef(null);
  const isScrollingRef = useRef(false);
  // Track whether the current interaction is touch (vs mouse)
  const isTouchRef = useRef(false);

  // Intercept pointerDown: on touch devices, prevent Radix from opening
  // the menu on touch-start. For mouse users, let it work normally.
  const handlePointerDown = (e) => {
    if (e.pointerType === 'touch') {
      // Stop Radix's onPointerDown from firing — we'll open on tap release instead
      e.preventDefault();
      isTouchRef.current = true;
    } else {
      isTouchRef.current = false;
    }
  };

  const handleTouchStart = (e) => {
    const t = e.touches[0];
    touchStartRef.current = { x: t.clientX, y: t.clientY };
    isScrollingRef.current = false;
  };

  const handleTouchMove = (e) => {
    if (!touchStartRef.current || isScrollingRef.current) return;
    const t = e.touches[0];
    const dx = Math.abs(t.clientX - touchStartRef.current.x);
    const dy = Math.abs(t.clientY - touchStartRef.current.y);
    // 10px threshold — if the finger has moved this much, it's a scroll
    if (dx > 10 || dy > 10) {
      isScrollingRef.current = true;
    }
  };

  const handleTouchEnd = (e) => {
    if (isScrollingRef.current) {
      // User was scrolling — suppress everything
      e.preventDefault();
      e.stopPropagation();
    } else if (isTouchRef.current && touchStartRef.current) {
      // Clean tap (finger didn't move) — open the menu now on release
      e.preventDefault();
      e.stopPropagation();
      setMenuOpen(true);
    }
    touchStartRef.current = null;
    isTouchRef.current = false;
    setTimeout(() => { isScrollingRef.current = false; }, 50);
  };

  // Block the menu from opening via Radix internals if user was scrolling
  const handleOpenChange = useCallback((nextOpen) => {
    if (nextOpen && isScrollingRef.current) return;
    setMenuOpen(nextOpen);
  }, []);

  // Close the menu on any scroll event (captures scrolling on any ancestor)
  useEffect(() => {
    if (!menuOpen) return;
    const dismiss = () => setMenuOpen(false);
    // Use capture phase so we catch scroll on any element (horizontal carousels, page, etc.)
    window.addEventListener('scroll', dismiss, { capture: true, passive: true });
    window.addEventListener('touchmove', dismiss, { passive: true });
    return () => {
      window.removeEventListener('scroll', dismiss, { capture: true });
      window.removeEventListener('touchmove', dismiss);
    };
  }, [menuOpen]);

  if (!episode) return null;

  const handlePlayNext = () => {
    addNext(podcast, episode);
    toast({ title: 'Playing next', description: episode.title, duration: 2000 });
  };

  const handleAddToQueue = () => {
    addToQueue(podcast, episode);
    toast({ title: 'Added to queue', description: episode.title, duration: 2000 });
  };

  const handleAddToPlaylist = () => {
    onAddToPlaylist?.(episode);
  };

  return (
    <DropdownMenu open={menuOpen} onOpenChange={handleOpenChange} modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="More options"
          className={`inline-flex items-center justify-center rounded-full p-1.5 text-white/40 hover:text-white hover:bg-white/10 transition-colors focus:outline-none ${className}`}
          onPointerDown={handlePointerDown}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <MoreVertical className="w-4 h-4" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        side={side}
        align={align}
        usePortal={!inline}
        className="min-w-[180px] bg-zinc-900/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl p-1 z-[9999]"
      >
        {onPlayNow && (
          <DropdownMenuItem
            onClick={onPlayNow}
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-white/80 hover:text-white hover:bg-white/10 cursor-pointer text-sm"
          >
            <Play className="w-4 h-4" />
            Play Now
          </DropdownMenuItem>
        )}

        <DropdownMenuItem
          onClick={handlePlayNext}
          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-white/80 hover:text-white hover:bg-white/10 cursor-pointer text-sm"
        >
          <SkipForward className="w-4 h-4" />
          Play Next
        </DropdownMenuItem>

        {onRemoveFromQueue ? (
          <DropdownMenuItem
            onClick={onRemoveFromQueue}
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-red-400/80 hover:text-red-300 hover:bg-red-500/10 cursor-pointer text-sm"
          >
            <ListMinus className="w-4 h-4" />
            Remove from Queue
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem
            onClick={handleAddToQueue}
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-white/80 hover:text-white hover:bg-white/10 cursor-pointer text-sm"
          >
            <ListPlus className="w-4 h-4" />
            Add to Queue
          </DropdownMenuItem>
        )}

        {onAddToPlaylist && (
          <>
            <DropdownMenuSeparator className="my-1 bg-white/[0.08]" />
            <DropdownMenuItem
              onClick={handleAddToPlaylist}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-white/80 hover:text-white hover:bg-white/10 cursor-pointer text-sm"
            >
              <Plus className="w-4 h-4" />
              Add to Playlist
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

EpisodeMenu.propTypes = {
  episode: PropTypes.object,
  podcast: PropTypes.object,
  onPlayNow: PropTypes.func,
  onRemoveFromQueue: PropTypes.func,
  onAddToPlaylist: PropTypes.func,
  className: PropTypes.string,
  side: PropTypes.string,
  align: PropTypes.string,
  inline: PropTypes.bool,
};
