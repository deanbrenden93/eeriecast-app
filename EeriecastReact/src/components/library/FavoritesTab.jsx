import PropTypes from "prop-types";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Play, Heart, ArrowDownUp } from "lucide-react";
import { useMemo, useState } from "react";
import EpisodesTable from "@/components/podcasts/EpisodesTable";

export default function FavoritesTab({
  favoriteEpisodes = [],
  isLoading = false,
  onPlayAllFavorites = () => {},
  onPlayEpisode,
  onAddToPlaylist,
  playAllCount = 0,
}) {
  // ── Show filter ──
  const showOptions = useMemo(() => {
    const map = new Map();
    for (const ep of favoriteEpisodes) {
      const podcast = ep.podcast_data || ep.podcast;
      const id = podcast?.id;
      const title = podcast?.title;
      if (id && title && !map.has(id)) map.set(id, title);
    }
    return Array.from(map.entries())
      .map(([id, title]) => ({ id, title }))
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [favoriteEpisodes]);

  const [selectedShow, setSelectedShow] = useState('all');

  // ── Sort ──
  const [sortOrder, setSortOrder] = useState('newest');

  // ── Normalize episodes: ensure each has a `podcast` object for EpisodesTable ──
  const normalizedEpisodes = useMemo(() => {
    return favoriteEpisodes.map(ep => {
      if (ep.podcast && typeof ep.podcast === 'object') return ep;
      // Promote podcast_data to podcast so EpisodesTable can resolve show name / art
      return { ...ep, podcast: ep.podcast_data || ep.podcast || {} };
    });
  }, [favoriteEpisodes]);

  // ── Visible episodes (filtered + sorted) ──
  const visibleEpisodes = useMemo(() => {
    let filtered = normalizedEpisodes;
    if (selectedShow !== 'all') {
      filtered = normalizedEpisodes.filter(ep => {
        const pid = ep.podcast?.id || ep.podcast_data?.id;
        return String(pid) === String(selectedShow);
      });
    }
    const toTs = (e) => new Date(e?.published_at || e?.created_date || e?.release_date || 0).getTime();
    return [...filtered].sort((a, b) =>
      sortOrder === 'newest' ? toTs(b) - toTs(a) : toTs(a) - toTs(b)
    );
  }, [normalizedEpisodes, selectedShow, sortOrder]);

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
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          {/* Filter by show */}
          <Select value={selectedShow} onValueChange={setSelectedShow}>
            <SelectTrigger className="w-48 bg-gray-800 border-gray-700 text-sm h-9">
              <SelectValue placeholder="Filter by show" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Shows</SelectItem>
              {showOptions.map(s => (
                <SelectItem key={s.id} value={String(s.id)}>{s.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Sort toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSortOrder(prev => prev === 'newest' ? 'oldest' : 'newest')}
            className="h-9 px-3 bg-gray-800 border border-gray-700 hover:bg-gray-700 text-zinc-300 text-sm gap-1.5"
          >
            <ArrowDownUp className="w-3.5 h-3.5" />
            {sortOrder === 'newest' ? 'Newest' : 'Oldest'}
          </Button>
        </div>

        {/* Play All */}
        <Button
          className="bg-red-600 hover:bg-red-500 text-white px-5 py-2 rounded-full flex items-center gap-2 text-sm"
          onClick={onPlayAllFavorites}
          disabled={isLoading || playAllCount === 0}
        >
          <Play className="w-4 h-4 fill-white" />
          Play All ({playAllCount})
        </Button>
      </div>

      {visibleEpisodes.length === 0 ? (
        <div className="text-center text-zinc-500 py-10">
          No episodes match the current filter.
        </div>
      ) : (
        <EpisodesTable
          episodes={visibleEpisodes}
          show={null}
          onPlay={onPlayEpisode}
          onAddToPlaylist={onAddToPlaylist}
        />
      )}
    </div>
  );
}

FavoritesTab.propTypes = {
  favoriteEpisodes: PropTypes.array,
  isLoading: PropTypes.bool,
  onPlayAllFavorites: PropTypes.func,
  onPlayEpisode: PropTypes.func,
  onAddToPlaylist: PropTypes.func,
  playAllCount: PropTypes.number,
};
