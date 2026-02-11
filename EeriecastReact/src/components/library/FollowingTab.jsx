import PropTypes from "prop-types";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowDownUp } from "lucide-react";
import FollowingItem from "./FollowingItem";
import EpisodesTable from "@/components/podcasts/EpisodesTable";
import { useUser } from "@/context/UserContext";
import { useMemo, useState } from "react";

export default function FollowingTab({ podcasts, onAddToPlaylist, onPlayEpisode }) {
  const navigate = useNavigate();
  const { followedPodcastIds } = useUser();

  // ── Followed podcasts ──
  const followingPodcasts = useMemo(() => {
    return podcasts.filter(p => followedPodcastIds.has(Number(p.id)));
  }, [podcasts, followedPodcastIds]);

  // ── Flatten episodes from followed podcasts ──
  const allEpisodes = useMemo(() => {
    const seen = new Set();
    const episodes = [];
    for (const podcast of followingPodcasts) {
      const eps = Array.isArray(podcast.episodes) ? podcast.episodes : [];
      for (const ep of eps) {
        const id = ep.id || ep.slug;
        if (!id || seen.has(id)) continue;
        seen.add(id);
        // Attach parent podcast reference so EpisodesTable can resolve show name / art
        episodes.push({
          ...ep,
          podcast: podcast,
        });
      }
    }
    return episodes;
  }, [followingPodcasts]);

  // ── Show filter ──
  const showOptions = useMemo(() => {
    return followingPodcasts
      .map(p => ({ id: p.id, title: p.title || 'Untitled' }))
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [followingPodcasts]);

  const [selectedShow, setSelectedShow] = useState('all');

  // ── Sort ──
  const [sortOrder, setSortOrder] = useState('newest'); // 'newest' | 'oldest'

  // ── Visible episodes (filtered + sorted) ──
  const visibleEpisodes = useMemo(() => {
    let filtered = allEpisodes;
    if (selectedShow !== 'all') {
      filtered = allEpisodes.filter(ep => String(ep.podcast?.id) === String(selectedShow));
    }
    const toTs = (e) => new Date(e?.published_at || e?.created_date || e?.release_date || 0).getTime();
    const sorted = [...filtered].sort((a, b) =>
      sortOrder === 'newest' ? toTs(b) - toTs(a) : toTs(a) - toTs(b)
    );
    return sorted;
  }, [allEpisodes, selectedShow, sortOrder]);

  // ── Empty state ──
  if (followingPodcasts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <div className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center mb-6">
          <span className="text-3xl">🎙️</span>
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">No Followed Podcasts Yet</h2>
        <p className="text-gray-400 mb-6">Start following podcasts to see them here.</p>
        <Button
          onClick={() => navigate('/Discover?tab=podcasts')}
          className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white px-6 py-2 rounded-full flex items-center gap-2 shadow-[0_4px_16px_rgba(220,38,38,0.2)]"
        >
          Browse Podcasts
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ═══ Section 1: Your Shows ═══ */}
      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-400 mb-3">
          Your Shows
        </h3>
        <div
          className="flex gap-3 overflow-x-auto pb-2"
          style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}
        >
          {followingPodcasts.map(podcast => (
            <FollowingItem key={podcast.id} podcast={podcast} />
          ))}
        </div>
      </div>

      {/* ═══ Divider ═══ */}
      <div className="h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />

      {/* ═══ Section 2: Latest Episodes ═══ */}
      <div>
        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
            Latest Episodes
          </h3>
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
        </div>

        {visibleEpisodes.length === 0 ? (
          <div className="text-center text-zinc-500 py-10">
            No episodes available from your followed shows.
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
    </div>
  );
}

FollowingTab.propTypes = {
  podcasts: PropTypes.array.isRequired,
  onAddToPlaylist: PropTypes.func,
  onPlayEpisode: PropTypes.func,
};
