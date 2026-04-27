import PropTypes from "prop-types";
import { Clock } from "lucide-react";
import { useMemo, useState } from "react";
import { useUser } from "@/context/UserContext";
import EpisodesTable from "@/components/podcasts/EpisodesTable";
import { FilterDropdown } from "@/components/common/FilterControls";

export default function HistoryTab({
  historyEpisodes = [],
  isLoading = false,
  onPlayEpisode,
  onAddToPlaylist,
}) {
  // ── Show filter ──
  const showOptions = useMemo(() => {
    const map = new Map();
    for (const ep of historyEpisodes) {
      const podcast = ep.podcast && typeof ep.podcast === 'object' ? ep.podcast : null;
      const id = podcast?.id;
      const title = podcast?.title || podcast?.name;
      if (id && title && !map.has(id)) map.set(id, title);
    }
    return Array.from(map.entries())
      .map(([id, title]) => ({ id, title }))
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [historyEpisodes]);

  const [selectedShow, setSelectedShow] = useState('all');

  // ── Status filter ──
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'in_progress' | 'completed'

  // Use the same progress source that EpisodesTable uses for its "played" badge
  const { episodeProgressMap } = useUser();

  // ── Helper: is an episode completed? ──
  // Checks episodeProgressMap first (real-time, same as EpisodesTable), then
  // falls back to the history API fields as a secondary source.
  const isEpisodeCompleted = (ep) => {
    const eid = Number(ep.id);
    const prog = episodeProgressMap?.get(eid);
    if (prog) {
      if (prog.completed) return true;
      if (prog.duration > 0 && prog.progress >= prog.duration * 0.95) return true;
    }
    // Fallback to history API metadata
    if (ep._history_completed) return true;
    if ((ep._history_percent ?? 0) >= 95) return true;
    return false;
  };

  // ── Filtered episodes ──
  const visibleEpisodes = useMemo(() => {
    let filtered = historyEpisodes;

    // Filter by show
    if (selectedShow !== 'all') {
      filtered = filtered.filter(ep => {
        const pid = ep.podcast?.id;
        return String(pid) === String(selectedShow);
      });
    }

    // Filter by status
    if (statusFilter === 'in_progress') {
      filtered = filtered.filter(ep => !isEpisodeCompleted(ep));
    } else if (statusFilter === 'completed') {
      filtered = filtered.filter(ep => isEpisodeCompleted(ep));
    }

    return filtered;
  }, [historyEpisodes, selectedShow, statusFilter, episodeProgressMap]);

  if (isLoading) {
    return <div className="text-zinc-500 text-center py-10">Loading history...</div>;
  }

  if (!historyEpisodes.length) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[240px] text-center">
        <Clock className="w-10 h-10 text-zinc-700 mb-4" />
        <p className="text-gray-400 mb-2">No listening history yet.</p>
        <p className="text-gray-500 text-sm">Episodes you play will appear here.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          {/* Filter by show */}
          <FilterDropdown
            value={selectedShow}
            onChange={setSelectedShow}
            placeholder="Show"
            options={[
              { value: "all", label: "All Shows" },
              ...showOptions.map((s) => ({ value: String(s.id), label: s.title })),
            ]}
          />

          {/* Status filter */}
          <FilterDropdown
            value={statusFilter}
            onChange={setStatusFilter}
            placeholder="Status"
            options={[
              { value: "all", label: "All" },
              { value: "in_progress", label: "In Progress" },
              { value: "completed", label: "Completed" },
            ]}
          />
        </div>
      </div>

      {visibleEpisodes.length === 0 ? (
        <div className="text-center text-zinc-500 py-10">
          No episodes match the current filters.
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

HistoryTab.propTypes = {
  historyEpisodes: PropTypes.array,
  isLoading: PropTypes.bool,
  onPlayEpisode: PropTypes.func,
  onAddToPlaylist: PropTypes.func,
};
