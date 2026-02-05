import PropTypes from "prop-types";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Play } from "lucide-react";
import FavoriteItem from "./FavoriteItem";
import { useMemo, useState } from "react";

export default function FavoritesTab({ podcasts, playlists = [], onAddToPlaylist, favoritesPodcasts = [], isLoading = false, onPlayAllFavorites = () => {}, playAllCount = 0 }) {
  const favoritePodcastsNorm = useMemo(() => (Array.isArray(favoritesPodcasts) ? favoritesPodcasts : []), [favoritesPodcasts]);

  // Build unique shows list for dropdown
  const showOptions = useMemo(() => {
    const set = new Set();
    for (const p of favoritePodcastsNorm) if (p?.title) set.add(p.title);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [favoritePodcastsNorm]);

  const [selectedShow, setSelectedShow] = useState('all');

  const visiblePodcasts = useMemo(() => {
    if (selectedShow === 'all') return favoritePodcastsNorm;
    return favoritePodcastsNorm.filter(p => p?.title === selectedShow);
  }, [favoritePodcastsNorm, selectedShow]);

  if (isLoading) {
    return <div className="text-white text-center py-10">Loading favorites...</div>;
  }

  if (!visiblePodcasts || visiblePodcasts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[240px] text-center">
        <p className="text-gray-400 mb-4">You don&apos;t have any favorites yet.</p>
        <p className="text-gray-500 text-sm">Tap the heart next to a show or episode to add it to your favorites.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <Select value={selectedShow} onValueChange={setSelectedShow}>
          <SelectTrigger className="w-64 bg-gray-800 border-gray-700">
            <SelectValue placeholder="Filter by show:" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Shows</SelectItem>
            {showOptions.map(name => (
              <SelectItem key={name} value={name}>{name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-full flex items-center gap-2"
          onClick={onPlayAllFavorites}
          disabled={isLoading || playAllCount === 0}
        >
          <Play className="w-4 h-4 fill-white" />
          Play All ({playAllCount})
        </Button>
      </div>

      <div className="favorites-grid grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {visiblePodcasts.map(episode => (
          <FavoriteItem
            key={episode.id}
            episode={episode}
            playlists={playlists}
            onAddToPlaylist={onAddToPlaylist}
          />
        ))}
      </div>
    </div>
  );
}

FavoritesTab.propTypes = {
  podcasts: PropTypes.array.isRequired,
  playlists: PropTypes.array,
  onAddToPlaylist: PropTypes.func,
  favoritesPodcasts: PropTypes.array,
  isLoading: PropTypes.bool,
  onPlayAllFavorites: PropTypes.func,
  playAllCount: PropTypes.number,
};
