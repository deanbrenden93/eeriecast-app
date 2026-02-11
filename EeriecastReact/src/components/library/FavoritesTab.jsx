import PropTypes from "prop-types";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Play, Heart, ArrowDownUp, ListPlus } from "lucide-react";
import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import EpisodesTable from "@/components/podcasts/EpisodesTable";
import { useAudioPlayerContext } from "@/context/AudioPlayerContext";
import { useUser } from "@/context/UserContext";

export default function FavoritesTab({
  favoriteEpisodes = [],
  isLoading = false,
  onPlayEpisode,
  onAddToPlaylist,
}) {
  const { episode: currentEpisode, setPlaybackQueue, addToQueue } = useAudioPlayerContext();
  const { favoriteEpisodeIds } = useUser();
  const somethingPlaying = !!currentEpisode;

  // ── Local episode list: mirrors favoriteEpisodes but delays removals for animation ──
  const [localEpisodes, setLocalEpisodes] = useState(favoriteEpisodes);
  const [dismissingIds, setDismissingIds] = useState(() => new Set());
  const dismissTimers = useRef(new Map());

  // Sync: detect additions and removals from the context
  useEffect(() => {
    const contextIds = favoriteEpisodeIds;
    const localIdSet = new Set(localEpisodes.map(ep => ep.id));

    // Detect removals: episodes in local list whose IDs are no longer in context
    const removedIds = localEpisodes
      .map(ep => ep.id)
      .filter(id => !contextIds.has(id) && !dismissingIds.has(id));

    if (removedIds.length > 0) {
      // Mark as dismissing (triggers CSS animation)
      setDismissingIds(prev => {
        const next = new Set(prev);
        removedIds.forEach(id => next.add(id));
        return next;
      });

      // After animation completes, actually remove from local list
      removedIds.forEach(id => {
        if (dismissTimers.current.has(id)) clearTimeout(dismissTimers.current.get(id));
        const timer = setTimeout(() => {
          setLocalEpisodes(prev => prev.filter(ep => ep.id !== id));
          setDismissingIds(prev => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
          dismissTimers.current.delete(id);
        }, 400);
        dismissTimers.current.set(id, timer);
      });
    }

    // Detect additions: episodes in context that aren't in local list
    const added = favoriteEpisodes.filter(ep => !localIdSet.has(ep.id));
    if (added.length > 0) {
      setLocalEpisodes(prev => [...prev, ...added]);
    }

    // Clean up timers on unmount
    return () => {
      dismissTimers.current.forEach(t => clearTimeout(t));
    };
  }, [favoriteEpisodeIds]); // eslint-disable-line react-hooks/exhaustive-deps

  // Also reset local list when favoriteEpisodes fully reloads (e.g. login/logout)
  const prevFavLenRef = useRef(favoriteEpisodes.length);
  useEffect(() => {
    // If the favorites went from 0 to something (initial load) or completely changed, reset
    if (prevFavLenRef.current === 0 && favoriteEpisodes.length > 0) {
      setLocalEpisodes(favoriteEpisodes);
    }
    prevFavLenRef.current = favoriteEpisodes.length;
  }, [favoriteEpisodes]);

  // ── Normalize: ensure each episode has a `podcast` object for EpisodesTable ──
  const normalizedEpisodes = useMemo(() => {
    return localEpisodes.map(ep => {
      if (ep.podcast && typeof ep.podcast === 'object') return ep;
      return { ...ep, podcast: ep.podcast_data || ep.podcast || {} };
    });
  }, [localEpisodes]);

  // ── Show filter ──
  const showOptions = useMemo(() => {
    const map = new Map();
    for (const ep of normalizedEpisodes) {
      const podcast = ep.podcast_data || ep.podcast;
      const id = podcast?.id;
      const title = podcast?.title;
      if (id && title && !map.has(id)) map.set(id, title);
    }
    return Array.from(map.entries())
      .map(([id, title]) => ({ id, title }))
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [normalizedEpisodes]);

  const [selectedShow, setSelectedShow] = useState('all');
  const [sortOrder, setSortOrder] = useState('newest');

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

  // ── Play All: replace current queue with visible favorites ──
  const handlePlayAll = useCallback(async () => {
    if (!visibleEpisodes.length) return;
    const queueItems = visibleEpisodes.map(ep => ({
      podcast: ep.podcast || ep.podcast_data || {},
      episode: ep,
      resume: { progress: 0 },
    }));
    await setPlaybackQueue(queueItems, 0);
  }, [visibleEpisodes, setPlaybackQueue]);

  // ── Add All to Queue: append visible favorites to end of current queue ──
  const handleAddAllToQueue = useCallback(() => {
    for (const ep of visibleEpisodes) {
      addToQueue(ep.podcast || ep.podcast_data || {}, ep);
    }
  }, [visibleEpisodes, addToQueue]);

  // ── Count of non-dismissing episodes for display ──
  const activeCount = visibleEpisodes.filter(ep => !dismissingIds.has(ep.id)).length;

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

        <div className="flex items-center gap-2">
          {/* Add All to Queue — only visible when something is already playing */}
          {somethingPlaying && activeCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleAddAllToQueue}
              className="h-9 px-4 bg-gray-800 border border-gray-700 hover:bg-gray-700 text-zinc-300 text-sm gap-1.5 rounded-full"
            >
              <ListPlus className="w-4 h-4" />
              Add to Queue
            </Button>
          )}

          {/* Play All */}
          <Button
            className="bg-red-600 hover:bg-red-500 text-white px-5 py-2 rounded-full flex items-center gap-2 text-sm"
            onClick={handlePlayAll}
            disabled={activeCount === 0}
          >
            <Play className="w-4 h-4 fill-white" />
            Play All ({activeCount})
          </Button>
        </div>
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
          dismissingIds={dismissingIds}
        />
      )}
    </div>
  );
}

FavoritesTab.propTypes = {
  favoriteEpisodes: PropTypes.array,
  isLoading: PropTypes.bool,
  onPlayEpisode: PropTypes.func,
  onAddToPlaylist: PropTypes.func,
};
