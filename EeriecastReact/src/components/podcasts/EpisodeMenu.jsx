import PropTypes from 'prop-types';
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
    <DropdownMenu modal={inline ? false : undefined}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="More options"
          className={`inline-flex items-center justify-center rounded-full p-1.5 text-white/40 hover:text-white hover:bg-white/10 transition-colors focus:outline-none ${className}`}
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
