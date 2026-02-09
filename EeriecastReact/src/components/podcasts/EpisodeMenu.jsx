import PropTypes from 'prop-types';
import { MoreVertical, SkipForward, ListPlus, Plus } from 'lucide-react';
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
 * Provides "Play Next", "Add to Queue", and optionally "Add to Playlist".
 *
 * Props:
 *  - episode      – the episode object
 *  - podcast      – the parent podcast/show object
 *  - onAddToPlaylist – optional callback to trigger the Add-to-Playlist modal
 *  - className    – optional extra classes on the trigger button
 *  - side         – dropdown placement side (default "bottom")
 *  - align        – dropdown alignment (default "end")
 */
export default function EpisodeMenu({
  episode,
  podcast,
  onAddToPlaylist,
  className = '',
  side = 'bottom',
  align = 'end',
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
    <DropdownMenu>
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
        className="min-w-[180px] bg-zinc-900/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl p-1"
      >
        <DropdownMenuItem
          onClick={handlePlayNext}
          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-white/80 hover:text-white hover:bg-white/10 cursor-pointer text-sm"
        >
          <SkipForward className="w-4 h-4" />
          Play Next
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={handleAddToQueue}
          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-white/80 hover:text-white hover:bg-white/10 cursor-pointer text-sm"
        >
          <ListPlus className="w-4 h-4" />
          Add to Queue
        </DropdownMenuItem>

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
  onAddToPlaylist: PropTypes.func,
  className: PropTypes.string,
  side: PropTypes.string,
  align: PropTypes.string,
};
