import PropTypes from 'prop-types';
import { useCallback, useMemo, memo } from 'react';
import { Link } from 'react-router-dom';
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  sortableKeyboardCoordinates,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { motion, AnimatePresence } from 'framer-motion';
import { GripVertical, Play, ListMinus, MoreVertical } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { createPageUrl } from '@/utils';
import { formatDate } from '@/lib/utils';

// ── PlaylistSortableList ──────────────────────────────────────────
//
// Drag-to-reorder list shown on the Playlist detail page when the
// user is in "Custom" sort mode. Built on the same dnd-kit primitives
// the player queue uses (`ExpandedPlayer.jsx → SortableQueueItem`)
// so the feel is consistent: grip handle on the left, smooth slide
// animation on neighbours, no transform-lag on the dragged row.
//
// The parent owns the persistence side: this component just calls
// `onReorder(nextEpisodes)` after each drop. The Playlist page
// debounces that into a single PATCH so a flurry of moves only fires
// one round trip.
//
// Rows are rendered with the same shape as `EpisodesTable` rows
// (cover, two-line clamped title, show name, date) but lighter —
// the kebab here only carries playlist-relevant actions ("Add to
// another playlist" + "Remove from this playlist") so the list reads
// as the natural home for managing the playlist's contents.

function getArt(ep) {
  return ep?.image_url || ep?.artwork || ep?.cover_image || ep?.podcast?.cover_image || null;
}

function getShowName(ep) {
  if (typeof ep?.podcast === 'object') return ep.podcast?.title || '';
  return ep?.podcast_title || '';
}

function getShowId(ep) {
  if (typeof ep?.podcast === 'object') return ep.podcast?.id || ep.podcast?.slug || null;
  return ep?.podcast || null;
}

const SortableRow = memo(function SortableRow({ episode, onPlay, onAddToPlaylist, onRemoveFromPlaylist, isRemoving }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: String(episode.id) });

  // See `ExpandedPlayer → SortableQueueItem` for why the dragged row
  // explicitly disables transitions: dnd-kit applies per-frame
  // transforms and any `transition-all` will lag the pointer.
  const style = useMemo(() => ({
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? 'none' : transition,
    zIndex: isDragging ? 50 : 'auto',
    opacity: isDragging ? 0.92 : 1,
    willChange: 'transform',
    WebkitTapHighlightColor: 'transparent',
    touchAction: 'manipulation',
  }), [transform, transition, isDragging]);

  const handlePlay = useCallback(() => {
    if (!isRemoving) onPlay?.(episode);
  }, [onPlay, episode, isRemoving]);

  const showId = getShowId(episode);
  const showName = getShowName(episode);
  const art = getArt(episode);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 sm:gap-4 p-3 rounded-xl transition-colors duration-150 ${
        isDragging
          ? 'bg-white/[0.06] shadow-2xl shadow-black/50 ring-1 ring-violet-400/20'
          : 'hover:bg-white/[0.03]'
      } ${isRemoving ? 'opacity-50 pointer-events-none' : ''}`}
    >
      {/* Drag handle */}
      <button
        type="button"
        className="flex-shrink-0 -ml-1 p-1.5 text-white/30 hover:text-white/70 cursor-grab active:cursor-grabbing touch-none rounded-md transition-colors"
        aria-label="Drag to reorder"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="w-4 h-4" />
      </button>

      {/* Artwork */}
      <button
        type="button"
        onClick={handlePlay}
        className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-lg overflow-hidden bg-white/[0.04] flex-shrink-0 group/art ring-1 ring-white/[0.04]"
        aria-label={`Play ${episode?.title || 'episode'}`}
      >
        {art ? (
          <img src={art} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white/20 text-lg">🎧</div>
        )}
        <div className="absolute inset-0 bg-black/0 group-hover/art:bg-black/40 flex items-center justify-center opacity-0 group-hover/art:opacity-100 transition-all duration-200">
          <Play className="w-4 h-4 text-white fill-white" />
        </div>
      </button>

      {/* Title block */}
      <div className="flex-1 min-w-0">
        <h3
          title={episode?.title || 'Episode'}
          onClick={handlePlay}
          className="font-semibold text-sm sm:text-base text-white hover:text-violet-300 transition-colors cursor-pointer mb-0.5 line-clamp-2 break-words"
        >
          {episode?.title || 'Episode'}
        </h3>
        <div className="flex items-center gap-2 text-xs text-zinc-500 min-w-0">
          {showId && showName ? (
            <Link
              to={`${createPageUrl('Episodes')}?id=${encodeURIComponent(showId)}`}
              onClick={(e) => e.stopPropagation()}
              className="text-violet-400/90 hover:text-violet-300 truncate transition-colors"
            >
              {showName}
            </Link>
          ) : showName ? (
            <span className="text-violet-400/90 truncate">{showName}</span>
          ) : null}
          {showName && (episode?.published_at || episode?.created_date || episode?.release_date) && (
            <span className="text-zinc-700">·</span>
          )}
          {(episode?.published_at || episode?.created_date || episode?.release_date) && (
            <span className="truncate">{formatDate(episode?.published_at || episode?.created_date || episode?.release_date)}</span>
          )}
        </div>
      </div>

      {/* Kebab — playlist-scoped actions */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Episode options"
            className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-full text-zinc-500 hover:text-white hover:bg-white/[0.06] transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreVertical className="w-4 h-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="bg-[#18181f] border-white/[0.08] text-zinc-300">
          {onAddToPlaylist && (
            <DropdownMenuItem
              onClick={() => onAddToPlaylist(episode)}
              className="cursor-pointer focus:bg-white/[0.06] focus:text-white"
            >
              <Play className="w-4 h-4 mr-2" /> Add to another playlist
            </DropdownMenuItem>
          )}
          {onAddToPlaylist && onRemoveFromPlaylist && (
            <DropdownMenuSeparator className="bg-white/[0.06]" />
          )}
          {onRemoveFromPlaylist && (
            <DropdownMenuItem
              onClick={() => onRemoveFromPlaylist(episode)}
              className="cursor-pointer text-red-400 focus:bg-red-500/10 focus:text-red-300"
            >
              <ListMinus className="w-4 h-4 mr-2" /> Remove from playlist
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
});
SortableRow.propTypes = {
  episode: PropTypes.object.isRequired,
  onPlay: PropTypes.func,
  onAddToPlaylist: PropTypes.func,
  onRemoveFromPlaylist: PropTypes.func,
  isRemoving: PropTypes.bool,
};

export default function PlaylistSortableList({
  episodes,
  exitingId = null,
  removingEpisodeId = null,
  onPlay,
  onReorder,
  onRemoveFromPlaylist,
  onAddToPlaylist,
}) {
  // Sensor config matches the player queue: short activation distances
  // so the drag starts crisply on both desktop and touch, with a tiny
  // touch delay to keep tap-to-play snappy.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const ids = useMemo(() => episodes.map((e) => String(e.id)), [episodes]);

  const handleDragEnd = useCallback((event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(episodes, oldIndex, newIndex);
    onReorder?.(next);
  }, [ids, episodes, onReorder]);

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div className="space-y-1.5">
          <AnimatePresence initial={false}>
            {episodes.map((ep) => (
              <motion.div
                key={ep.id}
                layout
                initial={{ opacity: 0, y: 6 }}
                animate={{
                  opacity: exitingId === ep.id ? 0 : 1,
                  y: 0,
                  height: exitingId === ep.id ? 0 : 'auto',
                }}
                exit={{ opacity: 0, height: 0, marginTop: 0, marginBottom: 0 }}
                transition={{ duration: 0.22, ease: 'easeOut' }}
              >
                <SortableRow
                  episode={ep}
                  onPlay={onPlay}
                  onAddToPlaylist={onAddToPlaylist}
                  onRemoveFromPlaylist={onRemoveFromPlaylist}
                  isRemoving={removingEpisodeId === ep.id}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </SortableContext>
    </DndContext>
  );
}

PlaylistSortableList.propTypes = {
  episodes: PropTypes.array.isRequired,
  exitingId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  removingEpisodeId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  onPlay: PropTypes.func,
  onReorder: PropTypes.func.isRequired,
  onRemoveFromPlaylist: PropTypes.func,
  onAddToPlaylist: PropTypes.func,
};
