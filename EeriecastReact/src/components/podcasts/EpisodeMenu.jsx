import PropTypes from 'prop-types';
import { useRef, useState, useEffect, useCallback } from 'react';
import { MoreVertical, SkipForward, ListPlus, ListMinus, Plus, Play, Share2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { useAudioPlayerContext } from '@/context/AudioPlayerContext';
import { toast } from '@/components/ui/use-toast';
import { shareEpisode } from '@/lib/share';

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

  const touchStartRef = useRef(null);
  const isScrollingRef = useRef(false);
  const isTouchRef = useRef(false);

  const handlePointerDown = (e) => {
    if (e.pointerType === 'touch') {
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
    if (dx > 10 || dy > 10) {
      isScrollingRef.current = true;
    }
  };

  const handleTouchEnd = (e) => {
    if (isScrollingRef.current) {
      e.preventDefault();
      e.stopPropagation();
    } else if (isTouchRef.current && touchStartRef.current) {
      e.preventDefault();
      e.stopPropagation();
      setMenuOpen(true);
    }
    touchStartRef.current = null;
    isTouchRef.current = false;
    setTimeout(() => { isScrollingRef.current = false; }, 50);
  };

  const handleOpenChange = useCallback((nextOpen) => {
    if (nextOpen && isScrollingRef.current) return;
    setMenuOpen(nextOpen);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const dismiss = () => setMenuOpen(false);
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

  const handleShare = () => {
    shareEpisode(podcast, episode);
  };

  return (
    <DropdownMenu open={menuOpen} onOpenChange={handleOpenChange} modal={inline ? false : undefined}>
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
          <DropdownMenuItem
            onClick={handleAddToPlaylist}
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-white/80 hover:text-white hover:bg-white/10 cursor-pointer text-sm"
          >
            <Plus className="w-4 h-4" />
            Add to Playlist
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator className="my-1 bg-white/[0.08]" />
        <DropdownMenuItem
          onClick={handleShare}
          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-white/80 hover:text-white hover:bg-white/10 cursor-pointer text-sm"
        >
          <Share2 className="w-4 h-4" />
          Share
        </DropdownMenuItem>
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
