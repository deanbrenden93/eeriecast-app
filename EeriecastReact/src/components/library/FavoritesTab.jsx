import PropTypes from "prop-types";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Play, Heart, Headphones } from "lucide-react";
import { useMemo, useState } from "react";
import { useAudioPlayerContext } from "@/context/AudioPlayerContext";

export default function FavoritesTab({
  favoriteEpisodes = [],
  isLoading = false,
  onPlayAllFavorites = () => {},
  playAllCount = 0,
}) {
  const { loadAndPlay } = useAudioPlayerContext();

  // Build unique show names for filter dropdown
  const showOptions = useMemo(() => {
    const set = new Set();
    for (const ep of favoriteEpisodes) {
      const name = ep.podcast_data?.title || ep.podcast?.title;
      if (name) set.add(name);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [favoriteEpisodes]);

  const [selectedShow, setSelectedShow] = useState('all');

  const visibleEpisodes = useMemo(() => {
    if (selectedShow === 'all') return favoriteEpisodes;
    return favoriteEpisodes.filter(ep => {
      const name = ep.podcast_data?.title || ep.podcast?.title;
      return name === selectedShow;
    });
  }, [favoriteEpisodes, selectedShow]);

  const formatDuration = (seconds) => {
    if (!seconds) return '';
    const m = Math.floor(seconds / 60);
    if (m < 60) return `${m} min`;
    const h = Math.floor(m / 60);
    const rm = m % 60;
    return rm > 0 ? `${h}h ${rm}m` : `${h}h`;
  };

  if (isLoading) {
    return <div className="text-white text-center py-10">Loading favorites...</div>;
  }

  if (!favoriteEpisodes || favoriteEpisodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[240px] text-center">
        <Heart className="w-10 h-10 text-red-500/30 mb-4" />
        <p className="text-gray-400 mb-2">No favorite episodes yet.</p>
        <p className="text-gray-500 text-sm">Tap the heart on any episode to save it here.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <Select value={selectedShow} onValueChange={setSelectedShow}>
          <SelectTrigger className="w-64 bg-gray-800 border-gray-700">
            <SelectValue placeholder="Filter by show" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Shows</SelectItem>
            {showOptions.map(name => (
              <SelectItem key={name} value={name}>{name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          className="bg-red-600 hover:bg-red-500 text-white px-5 py-2 rounded-full flex items-center gap-2 text-sm"
          onClick={onPlayAllFavorites}
          disabled={isLoading || playAllCount === 0}
        >
          <Play className="w-4 h-4 fill-white" />
          Play All ({playAllCount})
        </Button>
      </div>

      <div className="space-y-2">
        {visibleEpisodes.map(ep => {
          const cover = ep.cover_image || ep.podcast_data?.cover_image;
          const showName = ep.podcast_data?.title || ep.podcast?.title || '';
          const podcast = ep.podcast_data || ep.podcast || {};

          return (
            <button
              key={ep.id}
              type="button"
              onClick={() => loadAndPlay({ episode: ep, podcast })}
              className="w-full flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.04] hover:bg-white/[0.06] hover:border-white/[0.08] transition-all text-left group"
            >
              {/* Cover */}
              <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-white/[0.06]">
                {cover ? (
                  <img src={cover} alt={ep.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Headphones className="w-5 h-5 text-white/20" />
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium truncate group-hover:text-white/90">{ep.title}</p>
                <p className="text-white/40 text-xs truncate mt-0.5">
                  {showName}
                  {ep.duration ? ` · ${formatDuration(ep.duration)}` : ''}
                </p>
              </div>

              {/* Heart indicator */}
              <Heart className="w-4 h-4 text-red-500 fill-red-500 flex-shrink-0 opacity-50" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

FavoritesTab.propTypes = {
  favoriteEpisodes: PropTypes.array,
  isLoading: PropTypes.bool,
  onPlayAllFavorites: PropTypes.func,
  playAllCount: PropTypes.number,
};
