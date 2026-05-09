import PropTypes from "prop-types";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Play } from "lucide-react";
import FollowingItem from "./FollowingItem";
import EpisodesTable from "@/components/podcasts/EpisodesTable";
import { FilterDropdown } from "@/components/common/FilterControls";
import { useUser } from "@/context/UserContext";
import { useAudioPlayerContext } from "@/context/AudioPlayerContext";
import { useMemo, useState } from "react";

export default function FollowingTab({ podcasts, onAddToPlaylist, onPlayEpisode }) {
  const navigate = useNavigate();
  const { followedPodcastIds, episodeProgressMap } = useUser();
  const { setPlaybackQueue } = useAudioPlayerContext();

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
  // 'newest' | 'oldest' | 'unplayed'.
  // "Unplayed" filters out anything the user has already finished, then
  // surfaces the freshest episodes first so they can immediately hit
  // "Play All" and have a queue ready.
  const [sortOrder, setSortOrder] = useState('newest');

  // Surfaced as a dropdown rather than a cycle button — listeners
  // expect to pick a sort directly instead of stepping through three
  // hidden states one tap at a time.
  const sortOptions = [
    { value: 'newest', label: 'Newest' },
    { value: 'oldest', label: 'Oldest' },
    { value: 'unplayed', label: 'Unplayed' },
  ];

  // ── Visible episodes (filtered + sorted) ──
  const visibleEpisodes = useMemo(() => {
    let filtered = allEpisodes;
    if (selectedShow !== 'all') {
      filtered = allEpisodes.filter(ep => String(ep.podcast?.id) === String(selectedShow));
    }
    if (sortOrder === 'unplayed') {
      filtered = filtered.filter(ep => {
        const prog = episodeProgressMap?.get(Number(ep.id));
        // "Unplayed" means "haven't started yet" — exclude both
        // completed episodes AND anything with saved progress > 0.
        // In-progress rows surface elsewhere as "X% played" so this
        // tab stays focused on truly fresh material.
        if (!prog) return true;
        if (prog.completed) return false;
        return (prog.progress || 0) <= 0;
      });
    }
    const toTs = (e) => new Date(e?.published_at || e?.created_date || e?.release_date || 0).getTime();
    const sorted = [...filtered].sort((a, b) => {
      if (sortOrder === 'oldest') return toTs(a) - toTs(b);
      // "newest" and "unplayed" both default to recency-first.
      return toTs(b) - toTs(a);
    });
    return sorted;
  }, [allEpisodes, selectedShow, sortOrder, episodeProgressMap]);

  // ── Play all unplayed episodes — kicks off a queue from the top ──
  const handlePlayAll = async () => {
    if (!visibleEpisodes.length || typeof setPlaybackQueue !== 'function') return;
    const queueItems = visibleEpisodes.map(ep => {
      const prog = episodeProgressMap?.get(Number(ep.id));
      return {
        podcast: ep.podcast,
        episode: ep,
        // Resume mid-episode if the listener was partway through but
        // hadn't finished — preserves their existing progress.
        resume: prog && !prog.completed && prog.progress > 0
          ? { progress: prog.progress }
          : { progress: 0 },
      };
    });
    try { await setPlaybackQueue(queueItems, 0); } catch { /* swallow */ }
  };

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
        {/* The outer row wraps at the H3 boundary on narrow screens so
            the heading and the control cluster always sit together
            cleanly. The inner control cluster never wraps internally —
            instead it horizontally scrolls when the selected show title
            is long enough to force overflow. That stops the Sort
            dropdown from ever dropping to a second line and keeps the
            row visually tidy regardless of show name length. */}
        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
            {sortOrder === 'unplayed' ? 'Unplayed Episodes' : 'Latest Episodes'}
          </h3>
          {/* `justify-start` (not end) anchors the leftmost control —
              "Play All" — to the start of the row, so when a long
              show title pushes total cluster width past the viewport
              the OVERFLOW lands on the right (the Sort dropdown,
              which a horizontal scroll can reveal) rather than
              clipping the most-tappable action off the left edge.
              The previous justify-end was hiding Play All by a few
              pixels on phones whenever the selected show name was
              long. */}
          <div className="flex items-center gap-2 sm:gap-3 flex-nowrap justify-start max-w-full overflow-x-auto scrollbar-none -mx-1 px-1">
            {/* Play All — only meaningful when there are episodes to queue.
                Surfaced more prominently when the listener is on the
                "Unplayed" sort because that's the moment they're most
                likely to want a hands-off catch-up session. */}
            {visibleEpisodes.length > 0 && (
              <Button
                size="sm"
                onClick={handlePlayAll}
                className={`shrink-0 h-9 px-3.5 rounded-full gap-1.5 text-sm font-semibold transition-all duration-300 ${
                  sortOrder === 'unplayed'
                    ? 'bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white shadow-[0_4px_16px_rgba(220,38,38,0.25)]'
                    : 'bg-white/[0.06] hover:bg-white/[0.1] text-white border border-white/[0.08]'
                }`}
                title={`Play ${visibleEpisodes.length} ${sortOrder === 'unplayed' ? 'unplayed' : ''} episode${visibleEpisodes.length === 1 ? '' : 's'}`}
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                Play All
              </Button>
            )}

            {/* Filter by show — pill-styled dropdown matching Discover.
                Capped width (with the SelectTrigger's built-in
                line-clamp-1) so a long show title truncates with an
                ellipsis instead of expanding the trigger. The hard
                max-width keeps the trigger from monopolizing the row
                on phones; users still see the full title in the
                dropdown menu when they tap to change. */}
            <FilterDropdown
              value={selectedShow}
              onChange={setSelectedShow}
              placeholder="Show"
              className="shrink-0 !min-w-[7rem] max-w-[7rem] sm:max-w-[14rem]"
              options={[
                { value: "all", label: "All Shows" },
                ...showOptions.map((s) => ({ value: String(s.id), label: s.title })),
              ]}
            />

            {/* Sort dropdown — Newest / Oldest / Unplayed. shrink-0 +
                flex-nowrap parent keeps it on the same line as the
                Show filter no matter how long the show name is. */}
            <FilterDropdown
              value={sortOrder}
              onChange={setSortOrder}
              placeholder="Sort"
              className="shrink-0"
              options={sortOptions}
            />
          </div>
        </div>

        {visibleEpisodes.length === 0 ? (
          <div className="text-center text-zinc-500 py-10">
            {sortOrder === 'unplayed'
              ? "You're all caught up — no unplayed episodes from your followed shows."
              : 'No episodes available from your followed shows.'}
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
