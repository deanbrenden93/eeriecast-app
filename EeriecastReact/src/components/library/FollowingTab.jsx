import PropTypes from "prop-types";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Play } from "lucide-react";
import FollowingItem from "./FollowingItem";
import { useUser } from "@/context/UserContext";
import { useMemo, useState } from "react";

export default function FollowingTab({ podcasts, playlists = [], onAddToPlaylist }) {
  const { followedPodcastIds } = useUser();

  // Filter podcasts to only show followed ones
  const followingPodcasts = useMemo(() => {
    return podcasts.filter(podcast => followedPodcastIds.has(Number(podcast.id)));
  }, [podcasts, followedPodcastIds]);

  // Resolve creator name from possible shapes
  const getCreatorName = (p) => {
    if (typeof p?.author === 'string' && p.author.trim()) return p.author;
    const c = p?.creator;
    if (!c) return 'Unknown Creator';
    if (typeof c === 'string' && c.trim()) return c;
    if (typeof c === 'object') return c.display_name || c.name || c.username || 'Unknown Creator';
    return 'Unknown Creator';
  };

  // Build unique creator list for dropdown
  const creatorOptions = useMemo(() => {
    const set = new Set();
    for (const p of followingPodcasts) set.add(getCreatorName(p));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [followingPodcasts]);

  // Selected creator filter
  const [selectedCreator, setSelectedCreator] = useState('all');

  const visiblePodcasts = useMemo(() => {
    if (selectedCreator === 'all') return followingPodcasts;
    return followingPodcasts.filter(p => getCreatorName(p) === selectedCreator);
  }, [followingPodcasts, selectedCreator]);

  if (followingPodcasts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <div className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center mb-6">
          <span className="text-3xl">🎙️</span>
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">No Followed Podcasts Yet</h2>
        <p className="text-gray-400 mb-6">Start following podcasts to see them here.</p>
        <Button className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-full flex items-center gap-2">
          Browse Podcasts
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <Select value={selectedCreator} onValueChange={setSelectedCreator}>
          <SelectTrigger className="w-64 bg-gray-800 border-gray-700">
            <SelectValue placeholder="Filter by creator:" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Creators</SelectItem>
            {creatorOptions.map(name => (
              <SelectItem key={name} value={name}>{name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-full flex items-center gap-2">
          <Play className="w-4 h-4 fill-white" />
          Play All ({visiblePodcasts.length})
        </Button>
      </div>
      
      <div className="following-grid grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {visiblePodcasts.map(episode => (
          <FollowingItem
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

FollowingTab.propTypes = {
  podcasts: PropTypes.array.isRequired,
  playlists: PropTypes.array,
  onAddToPlaylist: PropTypes.func,
};
