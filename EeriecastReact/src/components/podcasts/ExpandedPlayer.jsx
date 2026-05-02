import { useState, useEffect, useMemo, useRef, useCallback, memo } from "react";
import PropTypes from "prop-types";
import { Heart, X, Plus, Settings2, UserPlus, UserCheck, Share2, GripVertical, Trash2 } from "lucide-react";
import { shareEpisode } from "@/lib/share";
import ShareEpisodeDialog from "@/components/podcasts/ShareEpisodeDialog";
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AnimatePresence, motion, useDragControls, useMotionValue, useTransform, animate } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useUser } from "@/context/UserContext.jsx";
import { usePlaylistContext } from "@/context/PlaylistContext.jsx";
import { useAuthModal } from "@/context/AuthModalContext.jsx";
import { useAudioPlayerContext } from "@/context/AudioPlayerContext.jsx";
import { useAudioTime } from "@/hooks/use-audio-time";
import { Podcast, Episode, UserLibrary } from "@/api/entities";
import { useSettings } from "@/hooks/use-settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/utils";
import { getContentRating } from "@/lib/showRatings";
import { FREE_FAVORITE_LIMIT } from "@/lib/freeTier";
import { toast } from "@/components/ui/use-toast";
import { createPageUrl } from "@/utils";
import { isAudiobook } from "@/lib/utils";
import EpisodeMenu from "@/components/podcasts/EpisodeMenu";
import HoldToShuffleButton from "@/components/common/HoldToShuffleButton";
import ScrollingTitle from "@/components/common/ScrollingTitle";
import AddToPlaylistModal from "@/components/library/AddToPlaylistModal";
import { Capacitor } from '@capacitor/core';

// Feature flag: offline downloads are an app-only feature. The player's
// Options modal exposes a "Download episode" action behind this flag;
// flip it back to `true` once the Capacitor mobile build is shipping so
// the section reappears for premium members.
const DOWNLOAD_SECTION_ENABLED = false;

// Custom SVG icons matching the MobilePlayer exactly
const PlayIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
    <path d="M8 5v14l11-7z"/>
  </svg>
);
const PauseIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
    <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
  </svg>
);
const NextIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M5 18l10-6L5 6v12zm11-12v12h2V6h-2z"/></svg>
);
const PrevIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
    <path d="M6 6h2v12H6V6zm3.5 6l8.5 6V6l-8.5 6z"/>
  </svg>
);
// Stroke icons from original code
const ShuffleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/></svg>
);
const RepeatIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
);
const DownloadIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
);
const ListMusicIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15V6"/><path d="M18.5 18a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z"/><path d="M12 12H3"/><path d="M16 6H3"/><path d="M12 18H3"/></svg>
);
const BackwardIcon = ({ seconds = 10 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <text x="50%" y="50%" textAnchor="middle" dy=".35em" fontSize="12" fontWeight="700" fill="currentColor" stroke="none" fontFamily="Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif">{`-${seconds}`}</text>
  </svg>
);
BackwardIcon.propTypes = { seconds: PropTypes.number };
const ForwardIcon = ({ seconds = 10 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <text x="50%" y="50%" textAnchor="middle" dy=".35em" fontSize="12" fontWeight="700" fill="currentColor" stroke="none" fontFamily="Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif">{`+${seconds}`}</text>
  </svg>
);
ForwardIcon.propTypes = { seconds: PropTypes.number };

function formatTime(s) {
  if (!s && s !== 0) return "0:00";
  const sec = Math.floor(s);
  const m = Math.floor(sec / 60);
  const r = sec % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

function formatTimerDisplay(totalSeconds) {
  if (!totalSeconds || totalSeconds <= 0) return '0:00';
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const ClockIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
  </svg>
);

// NOTE: The inline `InlineAddToPlaylistModal` previously defined here
// has been retired. The whole app — including the player — now uses
// the shared `AddToPlaylistModal` from `@/components/library/...`.
// Its mosaic thumbnails, multi-select, search, "already in" badges,
// and success animation work identically here. The Radix Dialog
// renders into a high-z portal so player z-stacking is no longer an
// issue.

/** Strips HTML tags to plain text for description preview. */
function stripHtmlToText(html) {
  if (!html) return '';
  // Remove script blocks, then tags, decode entities
  let str = html.replace(/<script[\s\S]*?<\/script>/gi, '');
  str = str.replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n\n').replace(/<[^>]+>/g, '');
  str = str.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ');
  return str.replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Sanitize a show-notes HTML blob to the small subset of tags we want to
 * preserve (paragraphs, line breaks, inline emphasis, and links). Anything
 * else is dropped. The result is safe to inject via dangerouslySetInnerHTML.
 */
function sanitizeShowNotes(html) {
  if (!html) return '';
  const allowed = /^(p|br|strong|b|em|i|u|ul|ol|li|a)$/i;
  let str = String(html).replace(/<script[\s\S]*?<\/script>/gi, '');
  str = str.replace(/<style[\s\S]*?<\/style>/gi, '');
  // Drop disallowed tags entirely
  str = str.replace(/<\/?([a-zA-Z0-9]+)([^>]*)>/g, (match, tagName, attrs) => {
    if (!allowed.test(tagName)) return '';
    const tag = tagName.toLowerCase();
    const closing = match.startsWith('</') ? '/' : '';
    if (tag === 'a' && !closing) {
      // Extract href only, force safe attributes
      const hrefMatch = attrs.match(/href\s*=\s*("([^"]*)"|'([^']*)')/i);
      const href = hrefMatch ? (hrefMatch[2] || hrefMatch[3] || '').trim() : '';
      if (!/^https?:\/\//i.test(href)) return '';
      return `<a href="${href}" target="_blank" rel="noopener noreferrer nofollow" class="text-red-400 hover:underline">`;
    }
    return `<${closing}${tag}>`;
  });
  // Collapse excessive whitespace
  return str.trim();
}

// Marquee helpers (`MarqueeText` / `MarqueeTitle`) used to live here.
// They were promoted to the shared `ScrollingTitle` primitive at
// `@/components/common/ScrollingTitle` so every surface in the app
// (episode tables, home rows, the mini player, the queue, search,
// history, etc.) gets the same overflow-detected ping-pong scroll.

/** Expandable episode show-notes block with basic rich formatting preserved.
 *
 * Open/close is animated via Framer Motion so the "Show more" reveal feels
 * physical rather than a hard CSS snap. We measure the inner content with
 * a `ResizeObserver` and animate `height` between the collapsed cap
 * (`COLLAPSED_HEIGHT`) and the measured `contentHeight`. Animating to a
 * pixel value (rather than `auto`) lets us cross-fade the gradient mask
 * during the same beat without the browser short-circuiting the
 * transition.
 */
const COLLAPSED_NOTES_HEIGHT = 140;
function ExpandableShowNotes({ html }) {
  const [expanded, setExpanded] = useState(false);
  const [contentHeight, setContentHeight] = useState(0);
  const bodyRef = useRef(null);

  const sanitized = useMemo(() => sanitizeShowNotes(html), [html]);
  const looksLikeHtml = useMemo(() => /<[a-z][\s\S]*>/i.test(html || ''), [html]);
  const plainText = useMemo(() => stripHtmlToText(html), [html]);

  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    const measure = () => setContentHeight(el.scrollHeight);
    measure();
    // Re-measure on viewport / font / image-load size changes so the
    // expanded panel always animates to the correct full height.
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [sanitized, plainText, html]);

  if (!plainText) return null;

  // We only show the toggle once the body is meaningfully taller than
  // the collapsed cap. Using a 10px buffer prevents a flicker where a
  // body that's a hair over 140px shows a useless "Show more" button.
  const overflows = contentHeight > COLLAPSED_NOTES_HEIGHT + 10;
  const targetHeight = expanded
    ? Math.max(contentHeight, COLLAPSED_NOTES_HEIGHT)
    : Math.min(COLLAPSED_NOTES_HEIGHT, contentHeight || COLLAPSED_NOTES_HEIGHT);

  return (
    <div className="w-full max-w-2xl mt-6">
      <h3 className="text-[10px] font-bold tracking-[0.2em] text-white/40 uppercase mb-3">Show Notes</h3>
      <div className="relative rounded-xl bg-white/[0.04] border border-white/[0.06] overflow-hidden">
        <motion.div
          initial={false}
          animate={{ height: contentHeight ? targetHeight : COLLAPSED_NOTES_HEIGHT }}
          transition={{ duration: 0.42, ease: [0.25, 0.1, 0.25, 1] }}
          style={{ overflow: 'hidden' }}
        >
          <div
            ref={bodyRef}
            className="p-4 text-sm text-white/75 leading-relaxed show-notes-body"
          >
            {looksLikeHtml ? (
              <div dangerouslySetInnerHTML={{ __html: sanitized }} />
            ) : (
              <p className="whitespace-pre-line">{plainText}</p>
            )}
          </div>
        </motion.div>
        <AnimatePresence>
          {!expanded && overflows && (
            <motion.div
              key="fade"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-[#0a0a0f] via-[#0a0a0f]/80 to-transparent pointer-events-none"
            />
          )}
        </AnimatePresence>
        {(overflows || expanded) && (
          <div className="px-4 pb-3 pt-1 relative">
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="inline-flex items-center gap-1 text-[11px] font-semibold tracking-wider uppercase text-red-400 hover:text-red-300 transition-colors"
            >
              <span>{expanded ? 'Show less' : 'Show more'}</span>
              <motion.svg
                xmlns="http://www.w3.org/2000/svg"
                width="11"
                height="11"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                animate={{ rotate: expanded ? 180 : 0 }}
                transition={{ duration: 0.32, ease: [0.25, 0.1, 0.25, 1] }}
              >
                <polyline points="6 9 12 15 18 9" />
              </motion.svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
ExpandableShowNotes.propTypes = { html: PropTypes.string };

/**
 * Drag-sortable row in the Up Next queue drawer.
 *
 * Memoized because the parent `ExpandedPlayer` re-renders on every audio
 * `currentTime` tick (multiple times per second during playback). Without
 * memoization every queue row also re-renders on each tick, which fights
 * dnd-kit's transform animation and makes drag feel laggy. With stable
 * props from the parent (`item`, `podcast`, `onPlay` — a useCallback
 * receiving `item` + `index` — and a primitive `id`), rows now only
 * re-render when the drag itself moves them.
 */
const SortableQueueItem = memo(function SortableQueueItem({ id, index, item, podcast, onPlay }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = useMemo(() => ({
    transform: CSS.Transform.toString(transform),
    // Explicitly kill any transition on the row being dragged — otherwise
    // Tailwind utility classes on the element can re-introduce a transition
    // on `transform`, causing the card to lag behind the pointer. Non-
    // dragging rows still get dnd-kit's smooth slide-to-new-position.
    transition: isDragging ? 'none' : transition,
    zIndex: isDragging ? 50 : 'auto',
    opacity: isDragging ? 0.85 : 1,
    // Promote to its own compositor layer so transforms don't repaint the
    // entire list; dnd-kit only updates `transform` during a drag.
    willChange: 'transform',
    // Disable the browser's synthetic 300ms tap-delay highlight that can
    // otherwise cause a one-frame visual pause when the drag begins.
    WebkitTapHighlightColor: 'transparent',
    touchAction: 'manipulation',
  }), [transform, transition, isDragging]);

  const ep = item?.episode || item;
  const pd = item?.podcast || podcast;

  const handleClick = useCallback(() => {
    onPlay?.(item, index);
  }, [onPlay, item, index]);

  return (
    <div
      ref={setNodeRef}
      style={style}
      // IMPORTANT: do NOT use `transition-all` here. `transition-all` also
      // transitions `transform`, which fights dnd-kit's per-frame transform
      // updates on the dragged row and makes it lag the pointer. Only fade
      // background-color on hover/drag state changes.
      className={`w-full flex items-center gap-3 p-3 rounded-2xl transition-colors duration-150 text-left ${
        isDragging
          ? 'bg-white/10 shadow-2xl shadow-black/50 ring-1 ring-white/10'
          : 'hover:bg-white/5'
      }`}
    >
      <button
        type="button"
        className="flex-shrink-0 p-1 -ml-1 text-white/30 hover:text-white/70 cursor-grab active:cursor-grabbing touch-none"
        aria-label="Drag to reorder"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={handleClick}
        className="flex-1 flex items-center gap-4 min-w-0 group text-left"
      >
        <div className="w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 bg-white/5 group-hover:shadow-lg transition-shadow">
          {(ep?.cover_image || pd?.cover_image) ? (
            <img src={ep?.cover_image || pd?.cover_image} alt={ep?.title || 'Episode'} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-white/20 text-[10px] font-bold">EP</div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <ScrollingTitle
            as="div"
            text={ep?.title || 'Episode'}
            className="text-white text-sm font-semibold mb-0.5 group-hover:text-[#ff0040] transition-colors"
          />
          <div className="text-white/40 text-xs truncate uppercase tracking-wider">{pd?.title || ''}</div>
        </div>
      </button>
    </div>
  );
});
SortableQueueItem.propTypes = {
  id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  index: PropTypes.number,
  item: PropTypes.object,
  podcast: PropTypes.object,
  onPlay: PropTypes.func,
};

/**
 * Isolated drag-list wrapper. Pulling this out means the DndContext /
 * SortableContext only re-render when the queue composition actually
 * changes — not on every `currentTime` tick propagating through the
 * parent player. ids and the onPlay trampoline are both memoized so row
 * children hit React.memo's bail-out during playback.
 */
const QueueDragList = memo(function QueueDragList({
  upNext,
  queue,
  queueIndex,
  podcast,
  sensors,
  onDragEnd,
  onPlay,
}) {
  const hasAbsoluteIndex = Array.isArray(queue) && queue.length > 0 && queueIndex >= 0;
  const offset = hasAbsoluteIndex ? queueIndex + 1 : 0;

  const ids = useMemo(
    () => upNext.map((_, idx) => String(offset + idx)),
    [upNext, offset],
  );

  const handleRowPlay = useCallback((item, absoluteIndex) => {
    onPlay?.(item, hasAbsoluteIndex ? absoluteIndex : undefined);
  }, [onPlay, hasAbsoluteIndex]);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div className="space-y-1.5">
          {upNext.map((item, idx) => {
            const absoluteIndex = offset + idx;
            return (
              <SortableQueueItem
                key={absoluteIndex}
                id={String(absoluteIndex)}
                index={absoluteIndex}
                item={item}
                podcast={podcast}
                onPlay={handleRowPlay}
              />
            );
          })}
        </div>
      </SortableContext>
    </DndContext>
  );
});
QueueDragList.propTypes = {
  upNext: PropTypes.array.isRequired,
  queue: PropTypes.array,
  queueIndex: PropTypes.number,
  podcast: PropTypes.object,
  sensors: PropTypes.any,
  onDragEnd: PropTypes.func.isRequired,
  onPlay: PropTypes.func.isRequired,
};

function ExpandedPlayer({
  podcast,
  episode,
  onToggle,
  onCollapse,
  onSeek,
  onSkip,
  onNext,
  onPrev,
  isShuffling,
  repeatMode,
  onShuffleToggle,
  onRepeatToggle,
  queue = [],
  queueIndex = -1,
  playQueueIndex,
  loadAndPlay
}) {
  // currentTime / duration / isPlaying come from the external audio
  // time store rather than props so the parent provider doesn't have
  // to re-render this entire tree on every `timeupdate` event. We
  // pull all three via a single subscription to keep it cheap; the
  // store de-duplicates updates so this component only re-renders
  // when one of these three primitives actually changes.
  const audioTime = useAudioTime();
  const currentTime = audioTime.currentTime;
  const duration = audioTime.duration;
  const isPlaying = audioTime.isPlaying;
  const navigate = useNavigate();
  const [isLiked, setIsLiked] = useState(false);
  const { isAuthenticated, user, refreshFavorites, favoriteEpisodeIds, isPremium, followedPodcastIds, refreshFollowings } = useUser();
  const { playlists, addPlaylist, updatePlaylist } = usePlaylistContext();
  const { openAuth } = useAuthModal();

  // Sleep timer & playback speed from context
  const {
    sleepTimerRemaining,
    setSleepTimer,
    cancelSleepTimer,
    playbackRate,
    setPlaybackRate,
    audioRef,
    removeFromQueue,
    reorderQueue,
    shuffleUpNext,
    clearQueue,
  } = useAudioPlayerContext();
  const sleepTimerActive = sleepTimerRemaining > 0;

  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const [favLoading, setFavLoading] = useState(false);
  // Defer rendering of the atmospheric blur orbs until after the
  // open slide-up has finished. Each orb is a 70-80 px-radius
  // backdrop blur over a 25-40 rem element — that's a meaningful
  // amount of GPU work to commit on the very first frame of the
  // slide, on top of laying out and painting the rest of the player
  // tree for the first time. Holding them back by ~one slide
  // duration shifts that cost out of the user-visible animation
  // window so the open feels snappier; the orbs then fade in once
  // the player is at rest.
  const [orbsReady, setOrbsReady] = useState(false);
  useEffect(() => {
    // 380 ms ≈ slightly longer than the wrapper's 360 ms slide so
    // we don't accidentally paint orbs into the last keyframe of
    // the slide. setTimeout (rather than onAnimationComplete) keeps
    // ExpandedPlayer self-contained — it doesn't have to know
    // anything about the wrapper's animation timing.
    const id = window.setTimeout(() => setOrbsReady(true), 380);
    return () => window.clearTimeout(id);
  }, []);
  // Tracks a just-completed like-toggle for the player heart's
  // celebration animation. Mirrors the `followAnim` state machine
  // used by the Follow capsule below — `'liked'` triggers the
  // particle burst + ring pulse, `'unliked'` triggers a quieter
  // dip, `null` is the resting state. Auto-clears after 900 ms.
  const [likeAnim, setLikeAnim] = useState(null);
  // Custom sleep timer input (minutes)
  const [customSleepMinutes, setCustomSleepMinutes] = useState('');
  // Share-choice dialog — only shown when the listener is past the
  // intro so there's an actual choice to make between "share the
  // moment I'm on" and "share from the top". For the first few seconds
  // we skip the dialog entirely and just fire a clean share link.
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareDialogTs, setShareDialogTs] = useState(0);

  // Follow state
  const isFollowing = followedPodcastIds?.has(Number(podcast?.id));
  const [isFollowingLoading, setIsFollowingLoading] = useState(false);
  const [followAnim, setFollowAnim] = useState(null);

  const handleFollowToggle = async () => {
    if (!podcast?.id) return;
    if (!isAuthenticated) { openAuth('login'); return; }
    const wasFollowing = isFollowing;
    setIsFollowingLoading(true);
    try {
      if (wasFollowing) {
        await UserLibrary.unfollowPodcast(podcast.id);
      } else {
        await UserLibrary.followPodcast(podcast.id);
      }
      await refreshFollowings();
      setFollowAnim(wasFollowing ? 'unfollowed' : 'followed');
      setTimeout(() => setFollowAnim(null), 900);
    } catch (e) {
      console.error('Failed to toggle follow', e);
    } finally {
      setIsFollowingLoading(false);
    }
  };

  // Configurable skip intervals from user settings
  const { settings } = useSettings();
  const skipBack = Number(settings?.skipBackwardSeconds) || 10;
  const skipFwd = Number(settings?.skipForwardSeconds) || 10;

  // New: Queue sheet state
  const [showQueue, setShowQueue] = useState(false);

  // ── Drag & drop sensors for Up Next reordering ──
  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleQueueDragEnd = useCallback((event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    // Item ids use the absolute queue index so we can translate directly.
    const fromIdx = Number(active.id);
    const toIdx = Number(over.id);
    if (!Number.isFinite(fromIdx) || !Number.isFinite(toIdx)) return;
    if (typeof reorderQueue === 'function') reorderQueue(fromIdx, toIdx);
  }, [reorderQueue]);

  // ──────────────────────────────────────────────────────────────────
  // Player-level gestures
  // ──────────────────────────────────────────────────────────────────
  // Two coexisting gestures:
  //
  //   1. Swipe-down to collapse — the entire player container is a
  //      `motion.div` with `drag="y"`, but `dragListener={false}` means
  //      it only enters drag mode when the HEADER calls
  //      `dragControls.start(e)`. This keeps the rest of the page
  //      scrollable normally and stops the user from accidentally
  //      dismissing the player while reading show notes far down the
  //      view.
  //
  //   2. Horizontal swipe deck — wraps the action-buttons row, the
  //      waveform, and the transport controls (the "interactive
  //      zone" — roughly the bottom third of the screen, exactly
  //      where the thumb naturally sits one-handed). A horizontal
  //      flick or drag past the threshold triggers `onNext` / `onPrev`.
  //      Both gestures are in entirely separate elements so they
  //      never compete for the same pointer events.
  //
  // While any modal is open (Options / Add-to-Playlist / Queue /
  // Share) the dismiss gesture is disabled so a stray drag inside a
  // modal doesn't yank the player out from under it. The check is
  // inlined at the JSX `drag` prop because some of those state
  // variables are declared further down in the component body.
  const dragControls = useDragControls();

  // ── Swipe-deck horizontal motion ────────────────────────────────
  // The horizontal swipe deck (cover + title + actions + waveform +
  // transport controls — everything that visually represents the
  // CURRENT track) shares a single `useMotionValue` for its `x`
  // translation. Framer-Motion's drag writes to it during touch,
  // and we drive it manually with `animate(...)` to play the
  // out-then-in carousel transition when a swipe commits.
  const deckX = useMotionValue(0);
  // While the carousel is mid-animation we lock out drag so the
  // user can't double-fire next/prev or fight the running tween.
  const [isSwiping, setIsSwiping] = useState(false);
  // Tactile feedback during drag/transition: the deck fades and
  // shrinks slightly as it moves away from center, so the drag
  // feels like a physical card being lifted off the surface
  // rather than a flat translate. The 600 px range is generous
  // enough that the carousel exit (animate to ±innerWidth) fades
  // the outgoing deck cleanly to 0 on the way out.
  const deckOpacity = useTransform(deckX, [-600, 0, 600], [0, 1, 0]);
  const deckScale = useTransform(deckX, [-600, 0, 600], [0.86, 1, 0.86]);

  // ── One-time gesture hint ───────────────────────────────────────
  // Originally we floated two glassy pills over the player; users
  // (rightly) hated them — they felt detached, ugly, and noisy. The
  // new approach is much more contextual:
  //   • The standard iOS drag-handle bar at the very top is the
  //     "swipe down to dismiss" affordance. No words needed.
  //   • On first open, the swipe deck performs a quick "wiggle"
  //     that visually demonstrates the swipe-to-skip gesture using
  //     the actual UI element it applies to. The wiggle plays
  //     once, then the localStorage flag is set so returning users
  //     never see it again.
  const HINT_STORAGE_KEY = 'eeriecast_player_gesture_hint_shown';
  const wigglePlayedRef = useRef(false);

  useEffect(() => {
    if (wigglePlayedRef.current) return;
    try {
      if (localStorage.getItem(HINT_STORAGE_KEY) === '1') {
        wigglePlayedRef.current = true;
        return;
      }
    } catch { /* localStorage unavailable — show the hint anyway */ }
    // Wait long enough for the player's own entrance animation to
    // settle so the wiggle reads as a deliberate hint, not part of
    // the entrance.
    const t = setTimeout(() => {
      if (wigglePlayedRef.current) return;
      wigglePlayedRef.current = true;
      // Damped oscillation: -28, +14, -16, settle. Keyframes timed
      // unevenly so it feels like a quick flick + bounce-back, not
      // a metronome. Total ~1.1 s.
      animate(deckX, [0, -28, 14, -16, 0], {
        duration: 1.1,
        ease: [0.25, 0.1, 0.25, 1],
        times: [0, 0.28, 0.55, 0.78, 1],
        onComplete: () => {
          try { localStorage.setItem(HINT_STORAGE_KEY, '1'); } catch { /* ignore */ }
        },
      });
    }, 700);
    return () => clearTimeout(t);
  }, [deckX]);

  const dismissGestureHint = useCallback(() => {
    wigglePlayedRef.current = true;
    try { localStorage.setItem(HINT_STORAGE_KEY, '1'); } catch { /* ignore */ }
  }, []);

  const handlePlayerDragEnd = useCallback((_, info) => {
    // Any drag means the user has discovered the gesture — no need
    // to keep teasing it.
    dismissGestureHint();
    // 120 px or a clearly downward flick (>600 px/s) commits the
    // dismiss. Anything less elastic-snaps back to position.
    if (info.offset.y > 120 || info.velocity.y > 600) {
      onCollapse?.();
    }
  }, [onCollapse, dismissGestureHint]);

  const handleHeaderPointerDown = useCallback((e) => {
    // Tapping the X / queue button shouldn't initiate a drag — the
    // button's own onClick still needs to fire cleanly.
    if (e.target instanceof HTMLElement && e.target.closest('button')) return;
    dragControls.start(e);
  }, [dragControls]);

  const handleSwipeDeckEnd = useCallback((_, info) => {
    dismissGestureHint();
    // Commit threshold tuned for "tap won't fire it but a confident
    // flick will". 80 px works on phones; the velocity branch
    // catches users who flick fast over a smaller distance.
    const SWIPE_DISTANCE = 80;
    const SWIPE_VELOCITY = 500;
    const dx = info.offset.x;
    const vx = info.velocity.x;
    if (Math.abs(dx) <= SWIPE_DISTANCE && Math.abs(vx) <= SWIPE_VELOCITY) {
      // Below threshold — let dragElastic snap back naturally.
      return;
    }
    // If a previous transition is still mid-flight, ignore the new
    // swipe so we don't end up in a stacked-animation race.
    if (isSwiping) return;

    setIsSwiping(true);
    // direction: -1 = swipe left = onNext (next track comes from
    // the right), +1 = swipe right = onPrev (previous track comes
    // from the left). The exiting deck CONTINUES in the swipe
    // direction; the new deck arrives from the OPPOSITE side. Get
    // these signs wrong (as the previous version did) and the
    // animation reads as "rubber-band fling" instead of "card
    // swipe".
    const direction = dx < 0 ? -1 : 1;
    const screenWidth = (typeof window !== 'undefined' ? window.innerWidth : 480);
    // Exit: same sign as the swipe — finger went left, card
    // continues left to off-screen.
    const exitX = direction * screenWidth;
    // Incoming: the OPPOSITE side from the exit, since the new
    // card slides in from where the user just opened space.
    const incomingX = -direction * screenWidth;

    animate(deckX, exitX, {
      duration: 0.22,
      ease: [0.32, 0.0, 0.67, 0.0], // accelerate-out
      onComplete: () => {
        // Fire the track change so the new episode hydrates
        // while the deck is still off-screen.
        if (direction < 0) onNext?.();
        else onPrev?.();
        // Jump to the opposite side (no animation — this is the
        // "incoming" start position).
        deckX.set(incomingX);
        // Slide the new card in to center.
        animate(deckX, 0, {
          duration: 0.34,
          ease: [0.16, 1, 0.3, 1], // decelerate-in (cubic-bezier "ease-out-quint")
          onComplete: () => setIsSwiping(false),
        });
      },
    });
  }, [onNext, onPrev, deckX, isSwiping, dismissGestureHint]);

  // (Header menu state removed — favorite & playlist moved to toolbar)

  // Derive a lightweight Up Next list: prefer global queue if provided
  const {
    currentItem,
    upNext,
  } = useMemo(() => {
    if (Array.isArray(queue) && queue.length > 0 && queueIndex >= 0 && queueIndex < queue.length) {
      const current = queue[queueIndex];
      return {
        currentItem: current,
        upNext: queue.slice(queueIndex + 1),
      };
    }
    // Fallback: use episodes from current podcast
    const allEps = Array.isArray(podcast?.episodes) ? podcast.episodes : [];
    const currentId = episode?.id ?? episode?.slug;
    const idx = allEps.findIndex((e) => (e?.id ?? e?.slug) === currentId);
    
    // Limit fallback to 5 items to avoid "ton of items"
    const nextList = idx >= 0 ? allEps.slice(idx + 1, idx + 6).map((ep) => ({ podcast, episode: ep })) : [];
    return { currentItem: { podcast, episode }, upNext: nextList };
  }, [queue, queueIndex, podcast, episode]);

  const handlePlayFromQueue = useCallback(async (item, indexInQueue) => {
    if (!item) return;
    if (typeof playQueueIndex === 'function' && typeof indexInQueue === 'number') {
      await playQueueIndex(indexInQueue);
      setShowQueue(false);
      return;
    }
    if (typeof loadAndPlay === 'function') {
      await loadAndPlay({ podcast: item.podcast, episode: item.episode, resume: item.resume || { progress: 0 } });
      setShowQueue(false);
    }
  }, [playQueueIndex, loadAndPlay]);

  const [downloading, setDownloading] = useState(false);
  const handleDownload = async () => {
    if (!isPremium) {
      toast({ title: "Premium feature", description: "Downloads are available for premium members.", variant: "destructive" });
      return;
    }
    // On web browsers, offline downloads aren't supported — nudge toward the app
    if (!Capacitor.isNativePlatform()) {
      toast({ title: "Available on the app", description: "Download episodes for offline listening on the Eeriecast mobile app." });
      return;
    }
    const audioUrl = episode?.audio_url || episode?.ad_free_audio_url;
    if (!audioUrl) {
      toast({ title: "Unavailable", description: "Audio URL not available for download.", variant: "destructive" });
      return;
    }
    try {
      setDownloading(true);
      const res = await fetch(audioUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${(episode.title || 'episode').replace(/[^\w\s-]/g, '')}.mp3`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: "Download failed", description: "Please try again.", variant: "destructive" });
    } finally {
      setDownloading(false);
    }
  };

  useEffect(() => {
    const eid = episode?.id;
    if (!eid) { setIsLiked(false); return; }
    setIsLiked(!!favoriteEpisodeIds && favoriteEpisodeIds.has(Number(eid)));
  }, [episode?.id, favoriteEpisodeIds]);


  // Local fallbacks if parent doesn't control shuffle/repeat
  const [localShuffle, setLocalShuffle] = useState(false);
  const [localRepeatMode, setLocalRepeatMode] = useState('off');

  const shuffleActive = onShuffleToggle ? !!isShuffling : localShuffle;
  const effectiveRepeat = onRepeatToggle ? (repeatMode || 'off') : localRepeatMode;

  const handleShuffle = () => {
    if (onShuffleToggle) return onShuffleToggle();
    setLocalShuffle((s) => !s);
  };

  const handleRepeat = () => {
    if (onRepeatToggle) return onRepeatToggle();
    setLocalRepeatMode((m) => (m === 'off' ? 'all' : m === 'all' ? 'one' : 'off'));
  };

  useEffect(() => {
    // Prevent background page from scrolling when expanded player is open
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  const cover = episode?.cover_image || podcast?.cover_image;

  const handleFavoriteClick = async () => {
    const eid = episode?.id;
    if (!eid || favLoading) return;
    const userId = user?.id || user?.user?.id || user?.pk;
    if (!userId || !isAuthenticated) {
      openAuth('login');
      return;
    }
    const alreadyLiked = isLiked;
    if (!alreadyLiked && !isPremium && favoriteEpisodeIds.size >= FREE_FAVORITE_LIMIT) {
      toast({
        title: "Favorite limit reached",
        description: `Free accounts can save up to ${FREE_FAVORITE_LIMIT} favorites. Upgrade to premium for unlimited.`,
        variant: "destructive",
      });
      return;
    }
    try {
      setFavLoading(true);
      setIsLiked(!alreadyLiked);
      // Fire the celebration animation IMMEDIATELY on click — users
      // get instant feedback even if the network round-trip takes a
      // beat. Auto-clears after the longest individual sub-animation
      // (~700 ms) plus a small breathing buffer.
      setLikeAnim(alreadyLiked ? 'unliked' : 'liked');
      window.setTimeout(() => setLikeAnim(null), 900);
      if (alreadyLiked) {
        await UserLibrary.removeFavorite('episode', eid);
      } else {
        await UserLibrary.addFavorite('episode', eid);
      }
      await refreshFavorites();
    } catch (err) {
      setIsLiked(alreadyLiked);
      // Cancel a celebration mid-flight if the API rejected the
      // toggle — otherwise we'd briefly cheer for an action the
      // server didn't actually accept.
      setLikeAnim(null);
      if (typeof console !== 'undefined') console.debug('episode favorite toggle failed', err);
    } finally {
      setFavLoading(false);
    }
  };

  // New state for managing Add to Playlist modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [episodeToAdd, setEpisodeToAdd] = useState(null);
  const [openingAdd, setOpeningAdd] = useState(false);

  // Generic "Add to Playlist" handler for any episode (used by EpisodeMenu in sub-sections)
  const handleAddAnyToPlaylist = (ep) => {
    if (!isAuthenticated) { openAuth('login'); return; }
    if (!isPremium) { window.location.assign('/Premium'); return; }
    setEpisodeToAdd(ep);
    setShowAddModal(true);
  };

  // ── Below-controls content: More episodes & Recommendations ──
  const [showEpisodes, setShowEpisodes] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [sectionsLoading, setSectionsLoading] = useState(true);

  // Fetch more episodes from the same podcast
  useEffect(() => {
    let cancelled = false;
    const podId = podcast?.id;
    const epId = episode?.id;
    setSectionsLoading(true);
    if (!podId) { setShowEpisodes([]); setSectionsLoading(false); return; }
    (async () => {
      try {
        const detail = await Podcast.get(podId);
        const eps = Array.isArray(detail?.episodes)
          ? detail.episodes
          : (detail?.episodes?.results || []);
        // Exclude the currently playing episode
        if (!cancelled) setShowEpisodes(eps.filter(e => e.id !== epId).slice(0, 6));
      } catch { if (!cancelled) setShowEpisodes([]); }
      if (!cancelled) setSectionsLoading(false);
    })();
    return () => { cancelled = true; };
  }, [podcast?.id, episode?.id]);

  // Fetch recommended episodes (free DB for free/unauth, full non-audiobook DB for premium)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Fetch episodes and podcasts in parallel
        const [epResult, podResult] = await Promise.all([
          Episode.list('-published_at', 60),
          Podcast.list(undefined, 200),
        ]);
        const allEps = Array.isArray(epResult) ? epResult : (epResult?.results || []);
        const allPods = Array.isArray(podResult) ? podResult : (podResult?.results || []);

        // Build podcast lookup for filtering
        const podMap = {};
        const audiobookIds = new Set();
        for (const p of allPods) {
          podMap[p.id] = p;
          if (isAudiobook(p)) audiobookIds.add(p.id);
        }

        let filtered = allEps.filter(ep => {
          const podId = typeof ep.podcast === 'object' ? ep.podcast?.id : ep.podcast;
          // Exclude audiobooks
          if (audiobookIds.has(podId)) return false;
          // Exclude current episode
          if (ep.id === episode?.id) return false;
          // Free/unauth users only see free episodes
          if (!isPremium) {
            const pod = podMap[podId];
            if (ep.is_premium || pod?.is_exclusive) return false;
          }
          return true;
        });

        // Enrich with podcast data
        filtered = filtered.map(ep => {
          const podId = typeof ep.podcast === 'object' ? ep.podcast?.id : ep.podcast;
          return { ...ep, _podcast: podMap[podId] || null };
        });

        if (!cancelled) setRecommendations(filtered.slice(0, 10));
      } catch { if (!cancelled) setRecommendations([]); }
    })();
    return () => { cancelled = true; };
  }, [podcast?.id, episode?.id, isPremium]);


  // Resolve an episode just like EpisodeCard/Show flows BEFORE opening
  // the modal. Previously the modal opened immediately and showed a
  // "Preparing episode…" placeholder; with the shared `AddToPlaylistModal`
  // (which already feels rich the moment it appears) it's a much better
  // UX to block on the resolve and open the polished modal in one beat.
  // The resolve itself is fast — most paths hit either a primed
  // `episode` prop or the cached `Episode.get`.
  const handleOpenAddToPlaylist = async () => {
    if (!isAuthenticated) { openAuth('login'); return; }
    // Playlists are a premium feature
    if (!isPremium) { window.location.assign('/Premium'); return; }
    if (openingAdd) return;
    setOpeningAdd(true);
    setEpisodeToAdd(null);
    try {
      let ep = episode;
      let pd = podcast;

      // If episode missing, try to resolve from podcast detail and resume
      if (!ep?.id && pd?.id) {
        try {
          const detail = await Podcast.get(pd.id);
          if (detail) pd = { ...pd, ...detail };
        } catch {/* ignore */}
        let eps = Array.isArray(pd?.episodes) ? pd.episodes : (pd?.episodes?.results || []);
        if (!eps.length) {
          try {
            const detail2 = await Podcast.get(pd.id);
            eps = Array.isArray(detail2?.episodes) ? detail2.episodes : (detail2?.episodes?.results || []);
            if (detail2) pd = { ...pd, ...detail2 };
          } catch {/* ignore */}
        }
        try {
          const resume = await UserLibrary.resumeForPodcast(pd.id);
          if (resume?.episode_detail) {
            const found = eps.find((e) => e.id === resume.episode_detail.id);
            ep = found || resume.episode_detail;
          }
        } catch {/* ignore */}
        if (!ep && eps.length) ep = eps[0];
      }

      // Verify episode exists; fallback to latest by podcast
      if (ep?.id) {
        try {
          const fetched = await Episode.get(ep.id);
          if (fetched?.id) ep = fetched;
        } catch {
          if (pd?.id) {
            try {
              const res = await Episode.filter({ podcast: pd.id }, '-created_date', 1);
              const arr = Array.isArray(res) ? res : (res?.results || []);
              if (arr[0]?.id) ep = arr[0];
            } catch {/* ignore */}
          }
        }
      } else if (pd?.id) {
        try {
          const res = await Episode.filter({ podcast: pd.id }, '-created_date', 1);
          const arr = Array.isArray(res) ? res : (res?.results || []);
          if (arr[0]?.id) ep = arr[0];
        } catch {/* ignore */}
      }

      if (!ep?.id) return;
      // Episode is ready — flip the modal open in a single batch with
      // the resolved episode so users never see a blank placeholder.
      setEpisodeToAdd(ep);
      setShowAddModal(true);
    } finally {
      setOpeningAdd(false);
    }
  };

  return (
    <motion.div
      // ── Outer container: drag-y SURFACE only ─────────────────────
      // This element handles the swipe-down-to-dismiss gesture and
      // nothing else. CRUCIALLY it has NO `overflow-*` — putting
      // overflow + drag on the same element causes the browser's
      // native scroll machinery to fight Framer-Motion for pointer
      // ownership, which is why the previous swipe-down was silently
      // doing nothing. Scrolling now lives on the inner wrapper.
      //
      // `dragListener={false}` means Framer doesn't auto-bind a
      // pointerdown listener; the drag is started imperatively from
      // the drag-handle bar via `dragControls.start(e)`. So no other
      // touches anywhere else in the player can begin a vertical
      // dismiss drag — only the handle.
      drag={(showOptionsModal || showAddModal || showQueue || shareDialogOpen || isSwiping) ? false : 'y'}
      dragControls={dragControls}
      dragListener={false}
      dragConstraints={{ top: 0, bottom: 0 }}
      // Asymmetric elastic resistance — the container can rubber-band
      // downward (so the user feels the drag) but resists upward
      // travel entirely. There's no "up" semantic here; the player is
      // already at the top of its z-stack.
      dragElastic={{ top: 0, bottom: 0.5 }}
      onDragEnd={handlePlayerDragEnd}
      className="fixed inset-0 z-[3000] flex flex-col"
      style={{ background: '#0a0a0f' }}
    >
      {/* Animated atmospheric background.
          Gated on `orbsReady` so the heavy first-frame blur work
          doesn't compete with the player's open slide-up — see the
          `orbsReady` declaration at the top of this component for
          the rationale. The orbs use a brief CSS opacity fade-in so
          they don't pop in jarringly when they finally render.

          Each orb is a heavily-blurred radial gradient — the visual
          cost is the blur, which the GPU caches as a bitmap on a
          dedicated compositor layer. Two important perf invariants
          for these orbs:
            1. The CSS keyframes only animate `translate`, never
               `scale` (or anything that changes the element's
               intrinsic size). Scaling forces the browser to
               re-rasterize and re-blur the orb on every keyframe
               step; pure translation lets it just composite the
               cached bitmap at a different position. The previous
               keyframes scaled to 1.15× / 1.10× / 1.20×, which is
               why open/close (and any other big animation that
               happened to coincide with a keyframe boundary) was
               stuttering.
            2. Blur radius is capped at ~80px. The eye doesn't see
               the difference between blur(80px) and blur(160px) on
               an opacity-0.05 colour wash, but the GPU work scales
               with radius². 80px is ~25% of the cost of 160px.
            3. `will-change: transform` keeps the layer alive across
               the keyframe so the bitmap doesn't get evicted
               between cycles.                              */}
      {orbsReady && (
        <div
          className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
          style={{ animation: 'ep-orbs-fade-in 320ms ease-out both' }}
        >
          <div className="absolute w-[40rem] h-[40rem] rounded-full blur-[80px] opacity-[0.07]"
            style={{
              background: 'radial-gradient(circle, #dc2626, transparent 70%)',
              top: '-10%', left: '-15%',
              animation: 'ep-drift-1 25s ease-in-out infinite alternate',
              willChange: 'transform',
            }}
          />
          <div className="absolute w-[35rem] h-[35rem] rounded-full blur-[80px] opacity-[0.05]"
            style={{
              background: 'radial-gradient(circle, #7c3aed, transparent 70%)',
              bottom: '-10%', right: '-10%',
              animation: 'ep-drift-2 30s ease-in-out infinite alternate',
              willChange: 'transform',
            }}
          />
          <div className="absolute w-[25rem] h-[25rem] rounded-full blur-[70px] opacity-[0.04]"
            style={{
              background: 'radial-gradient(circle, #0ea5e9, transparent 70%)',
              top: '40%', left: '50%',
              animation: 'ep-drift-3 20s ease-in-out infinite alternate',
              willChange: 'transform',
            }}
          />
          {/* Subtle noise texture overlay */}
          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/%3E%3C/svg%3E")', backgroundSize: '128px 128px' }} />
        </div>
      )}

      {/* Keyframes for background animation. Translate-only — see
          the orb comment block above for why scale is forbidden.
          `ep-orbs-fade-in` runs once on the orb container after the
          deferred mount, so the orbs ease in instead of popping. */}
      <style>{`
        @keyframes ep-drift-1 {
          0% { transform: translate(0, 0); }
          100% { transform: translate(60px, 40px); }
        }
        @keyframes ep-drift-2 {
          0% { transform: translate(0, 0); }
          100% { transform: translate(-50px, -30px); }
        }
        @keyframes ep-drift-3 {
          0% { transform: translate(-50%, -50%); }
          100% { transform: translate(calc(-50% + 40px), calc(-50% - 30px)); }
        }
        @keyframes ep-orbs-fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>

      {/* ─── Inner scroll container ─────────────────────────────────
          All scrollable player content lives here. Separating
          scroll from drag is what makes both gestures work
          reliably: the outer `motion.div` only handles drag-y, this
          inner `<div>` only handles overflow. `touch-pan-y` allows
          native vertical scroll inside while leaving horizontal
          gestures (the swipe deck below) free for Framer. */}
      <div className="relative z-[1] flex-1 flex flex-col overflow-y-auto overscroll-contain touch-pan-y">

      {/* ─── Combined header + drag-down handle ─────────────────────
          One unified drag-actionable region: a small visual
          handle bar at the top is the affordance, and the entire
          row (X / NOW PLAYING / Queue) below it is the drag
          surface. `touch-none` overrides the parent's `touch-pan-y`
          for this region only, so vertical drags here go straight
          to Framer's `dragControls.start(e)` instead of the
          browser's native scroll.

          The whole block lives INSIDE the scroll container so it
          scrolls away with content when the user pulls show notes
          / Up Next up — same behaviour as the original player; we
          don't permanently cost any vertical real estate. The X
          and Queue buttons each stay individually clickable
          because `handleHeaderPointerDown` short-circuits when the
          touch target is inside a real `<button>`. */}
      <div
        onPointerDown={handleHeaderPointerDown}
        className="relative z-[2] select-none touch-none"
        role="button"
        aria-label="Drag down to dismiss player"
      >
        <div className="flex justify-center pt-2 pb-1.5">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>
        <div className="relative flex items-center justify-between px-6 py-3">
          <button
            onClick={onCollapse}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-black/40 text-white/70 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white font-medium text-xs tracking-[0.2em] pointer-events-none select-none max-w-[calc(100%-120px)] truncate">NOW PLAYING</span>

          <div className="relative">
            <button
              onClick={() => setShowQueue(true)}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-black/40 text-white/70 hover:text-white transition-colors"
              aria-label="View Queue"
            >
              <ListMusicIcon />
              {upNext.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-[#ff0040] text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center shadow-lg">
                  {upNext.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="relative z-[1] flex-1 flex flex-col justify-start items-center px-6 pt-2 pb-4">
        {/* ═══════════════════════════════════════════════════════════
            SWIPE DECK (horizontal)
            ═══════════════════════════════════════════════════════════
            Wraps EVERYTHING that visually represents the current
            track — cover, title block, action buttons, waveform,
            and transport controls — so the swipe-to-skip gesture
            slides the entire "card" off-screen as a unit while the
            new track's card slides in from the opposite side.
            (Sliding only the controls, as it did before, was the
            UX equivalent of changing the steering wheel and
            leaving everything else still — felt fake.)

            Mechanics:
              • `style={{ x: deckX }}` shares a motion value with
                Framer's drag, so we can imperatively `animate(deckX,
                ...)` to perform the carousel transition AND to
                play the one-time wiggle hint on first open.
              • Below threshold the elastic snap-back returns it to
                center naturally.
              • Above threshold (in `handleSwipeDeckEnd`) we
                continue the slide off-screen, fire `onNext` /
                `onPrev`, jump to the opposite side, and slide back.
              • While `isSwiping` is true the drag is disabled so
                the user can't restart a swipe mid-transition.

            Vertical pointer movement inside the deck doesn't
            trigger any drag (drag is locked to "x"), so the show
            notes / Up Next / "More from this show" sections below
            stay freely scrollable.
        */}
        <motion.div
          drag={isSwiping ? false : 'x'}
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.18}
          dragMomentum={false}
          onDragEnd={handleSwipeDeckEnd}
          style={{ x: deckX, opacity: deckOpacity, scale: deckScale }}
          className="w-full flex flex-col items-center will-change-transform"
        >
        {/* Album Art
            ──────────
            Wrapped in a `motion.div` for a soft spring entrance — gives
            the screen a sense of "settling" instead of just popping.
            The ambient halo behind it (a blurred, slightly larger copy
            of the cover) adds depth without competing with the
            atmospheric background orbs that already drift behind the
            whole screen. Halo only renders when we have a real cover
            image — fallback art doesn't get a glow.
        */}
        {/* Cover art hero. The mount animation that used to live
            here (spring-scale + opacity + y) was firing
            simultaneously with the wrapper's slide-up, doubling up
            paint work for the whole player tree on the very frames
            where the GPU was already busy compositing the slide.
            Dropping it makes opening the player feel snappier — the
            slide is enough visual feedback. */}
        <div className="relative mx-auto mb-5">
          {cover && (
            <div
              aria-hidden="true"
              className="absolute inset-0 -m-6 rounded-[28px] opacity-50 blur-3xl pointer-events-none"
              style={{
                backgroundImage: `url(${cover})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                transform: 'scale(1.05)',
              }}
            />
          )}
          <div className="relative w-[260px] h-[260px] sm:w-[320px] sm:h-[320px] rounded-2xl overflow-hidden shadow-2xl shadow-black/60 ring-1 ring-white/[0.06]">
            {cover ? (
              <img
                src={cover}
                alt={episode?.title || 'Episode cover'}
                className="w-full h-full object-cover"
                loading="eager"
                decoding="async"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center">
                <span className="text-8xl">🎧</span>
              </div>
            )}
          </div>
        </div>

        {/* Track Info
            ──────────
            Three-tier hierarchy with a unified show/follow capsule so
            nothing fights for space anymore:
              1. Released-date cap with optional content-rating chip
              2. Episode title — the hero, gets full width to scroll
              3. Single sleek capsule: [Show Name] | [Follow]
                 — both halves are independently clickable; the
                 vertical hairline divider keeps them visually
                 distinct without spending a full row on each.

            Date is no longer a `suffix` on the scrolling title (which
            used to scroll along with the title and disappear on long
            episode names) — it now sits as a fixed cap above the title
            so the released date is always visible at a glance. The
            content rating joins the cap line because a quiet "META •
            META" header reads cleanly and doesn't ask the eye to make
            two stops the way a separate badge row did.
        */}
        {/* Metadata block (date / rating cap, title, show capsule).
            Mount-time fade-and-rise was removed for the same reason
            as the cover-art block above — it stacked on top of the
            wrapper's slide-up and forced extra paint work during
            the only frames where the GPU was already maxed out. */}
        <div className="mb-4 text-center w-full max-w-md overflow-hidden">
          {/* 1. Released-date + rating cap line */}
          {(() => {
            const releaseDate = episode?.published_at || episode?.created_date || episode?.release_date;
            const rating = getContentRating(podcast);
            if (!releaseDate && !rating) return null;
            // Per-rating tone palette stays consistent with the rest
            // of the app (Settings, EpisodeMenu, etc.).
            const ratingTone =
              rating === 'R'
                ? 'text-red-300 border-red-400/35 bg-red-500/[0.12]'
                : rating === 'PG-13'
                  ? 'text-amber-300 border-amber-400/30 bg-amber-400/[0.10]'
                  : rating === 'PG'
                    ? 'text-emerald-300 border-emerald-400/30 bg-emerald-500/[0.10]'
                    : 'text-sky-300 border-sky-400/30 bg-sky-500/[0.10]';
            return (
              <div className="flex items-center justify-center gap-2 mb-2">
                {releaseDate && (
                  <span className="text-[10px] font-semibold tracking-[0.18em] text-white/30 uppercase">
                    {formatDate(releaseDate)}
                  </span>
                )}
                {releaseDate && rating && (
                  <span className="text-white/15 text-[10px]" aria-hidden="true">•</span>
                )}
                {rating && (
                  <span
                    title={`Rated ${rating}`}
                    className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold tracking-wide leading-none select-none border ${ratingTone}`}
                  >
                    {rating}
                  </span>
                )}
              </div>
            );
          })()}

          {/* 2. Episode title — hero */}
          <ScrollingTitle
            as="h1"
            text={episode?.title || ''}
            className="text-white text-2xl sm:text-[26px] font-bold tracking-tight text-center mb-3"
          />

          {/* 3. Show + Follow capsule
                 ────────────────────────
                 A single pill split by a vertical hairline. Left half
                 navigates to the show, right half toggles follow.
                 Each half has its own hover state so the divider also
                 functions as a visual touch-target boundary.

                 Follow-toggle motion design:
                   • Icon + label crossfade (popLayout mode) — the old
                     state slides up & fades out while the new state
                     slides up from below. Stable min-width on the
                     button keeps the capsule from jittering as
                     "Follow" (6) ↔ "Following" (9) swap.
                   • A spring scale bounce on the right half on
                     commit, scoped to that half so the show-name
                     label doesn't twitch in sympathy.
                   • A radial ring pulse expands out from the icon on
                     a *new follow* — only on follow, never on
                     unfollow (positive reinforcement only). Two
                     concentric rings staggered by 80ms give it a
                     proper "tap-impact" feel without being noisy.
                   • Border tint transitions between neutral and
                     red — same 300ms ease as the rest of the player
                     so the change feels of a piece, not bolted on.
          */}
          <motion.div
            animate={{
              borderColor: isFollowing ? 'rgba(239, 68, 68, 0.35)' : 'rgba(255, 255, 255, 0.10)',
              boxShadow: followAnim === 'followed'
                ? '0 0 0 4px rgba(239, 68, 68, 0)'
                : '0 0 0 0 rgba(239, 68, 68, 0)',
            }}
            transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
            className="inline-flex items-stretch h-8 rounded-full border bg-white/[0.04] overflow-hidden align-middle"
          >
            <button
              type="button"
              onClick={() => {
                const pid = podcast?.id || podcast?.slug;
                if (pid) {
                  onCollapse?.();
                  navigate(`/Episodes?id=${pid}`);
                }
              }}
              className="px-3.5 inline-flex items-center text-[13px] font-medium text-white/70 hover:text-white hover:bg-white/[0.05] transition-colors max-w-[55vw] truncate"
              title={podcast?.title ? `Go to ${podcast.title}` : 'Go to show'}
            >
              <span className="truncate">{podcast?.title || ''}</span>
            </button>

            {/* Hairline divider — inset slightly so it doesn't kiss
                the rounded ends of the capsule. */}
            <span className="w-px my-1.5 bg-white/10" aria-hidden="true" />

            <motion.button
              type="button"
              onClick={handleFollowToggle}
              disabled={isFollowingLoading}
              animate={
                followAnim === 'followed'
                  ? { scale: [1, 1.06, 0.98, 1] }
                  : followAnim === 'unfollowed'
                    ? { scale: [1, 0.94, 1] }
                    : { scale: 1 }
              }
              transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1], times: [0, 0.35, 0.7, 1] }}
              className={`relative px-3 inline-flex items-center justify-center gap-1.5 text-[12px] font-semibold tracking-wide transition-colors duration-200 min-w-[88px] overflow-visible ${
                isFollowing
                  ? 'text-red-400 hover:bg-red-500/10'
                  : 'text-white/80 hover:text-white hover:bg-white/[0.05]'
              } ${isFollowingLoading ? 'opacity-60 cursor-not-allowed' : ''}`}
              aria-pressed={!!isFollowing}
              title={isFollowing ? 'Unfollow show' : 'Follow show'}
            >
              {/* Radial ring burst — only on follow, never on
                  unfollow. Two staggered rings expand outward and
                  fade so the tap reads as a positive "click". The
                  rings live above the button text/icon (z-10) but
                  stay non-interactive (pointer-events-none). */}
              <AnimatePresence>
                {followAnim === 'followed' && (
                  <>
                    <motion.span
                      key="ring-1"
                      initial={{ opacity: 0.55, scale: 0.55 }}
                      animate={{ opacity: 0, scale: 1.55 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.7, ease: [0.25, 0.4, 0.3, 1] }}
                      className="pointer-events-none absolute inset-0 rounded-full border border-red-500/70"
                    />
                    <motion.span
                      key="ring-2"
                      initial={{ opacity: 0.35, scale: 0.4 }}
                      animate={{ opacity: 0, scale: 1.9 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.85, ease: [0.25, 0.4, 0.3, 1], delay: 0.08 }}
                      className="pointer-events-none absolute inset-0 rounded-full border border-red-500/45"
                    />
                  </>
                )}
              </AnimatePresence>

              {/* Icon + label crossfade. `mode="popLayout"` lets the
                  exiting state float out of layout while the new
                  state takes its place, so the spring scale on the
                  parent doesn't get broken up by a measured layout
                  swap mid-animation. */}
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span
                  key={isFollowing ? 'following' : 'follow'}
                  initial={{ opacity: 0, y: 8, scale: 0.92 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.92 }}
                  transition={{ duration: 0.24, ease: [0.25, 0.1, 0.25, 1] }}
                  className="inline-flex items-center gap-1.5"
                >
                  {isFollowing
                    ? <UserCheck className="w-3.5 h-3.5" />
                    : <UserPlus className="w-3.5 h-3.5" />
                  }
                  <span>{isFollowing ? 'Following' : 'Follow'}</span>
                </motion.span>
              </AnimatePresence>
            </motion.button>
          </motion.div>
        </div>

        {/* Action buttons — compact icon-only row. Download lives in Options modal. */}
        <div className="player-controls-section">
          <div className="player-action-buttons">
            {/* Like / Unlike — celebration motion design
                   ───────────────────────────────────────
                   On *like*:
                     • Six small red particles radiate from the heart's
                       center, fade as they travel (~24 px out).
                     • A red ring pulses outward from the circle.
                     • The heart icon bounces with a subtle rotation
                       (`scale: 1 → 1.35 → 0.92 → 1`, `rotate ±8°`).
                     • Label crossfades "Like" → "Liked".
                   On *unlike*:
                     • Quieter scale dip (`1 → 0.82 → 1`) — no
                       particles, no ring. Negative state changes
                       shouldn't celebrate.
                     • Label crossfades "Liked" → "Like".
                   Resting state plays no animation, so re-renders
                   triggered by audio time-ticks don't re-fire it.
            */}
            <button
              type="button"
              className={`player-action-icon-btn ${isLiked ? 'liked' : ''}`}
              onClick={handleFavoriteClick}
              title={isLiked ? 'Favorited' : 'Add to favorites'}
              aria-pressed={isLiked}
              disabled={favLoading}
            >
              <span className="pi-circle relative">
                {/* Particle burst + ring pulse — only on a fresh
                    LIKE. AnimatePresence lets us animate them out
                    cleanly if the user un-likes mid-animation. */}
                <AnimatePresence>
                  {likeAnim === 'liked' && (
                    <>
                      {[0, 1, 2, 3, 4, 5].map((i) => {
                        const angle = (i / 6) * Math.PI * 2;
                        const distance = 22;
                        return (
                          <motion.span
                            key={`p-${i}`}
                            initial={{ x: 0, y: 0, scale: 0.5, opacity: 0.95 }}
                            animate={{
                              x: Math.cos(angle) * distance,
                              y: Math.sin(angle) * distance,
                              scale: [0.5, 1, 0.4],
                              opacity: [0.95, 0.75, 0],
                            }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.62, ease: [0.2, 0.8, 0.3, 1] }}
                            className="pointer-events-none absolute top-1/2 left-1/2 -mt-[2.5px] -ml-[2.5px] w-[5px] h-[5px] rounded-full bg-red-400"
                          />
                        );
                      })}
                      <motion.span
                        key="like-ring"
                        initial={{ opacity: 0.55, scale: 0.5 }}
                        animate={{ opacity: 0, scale: 1.95 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.7, ease: [0.25, 0.4, 0.3, 1] }}
                        className="pointer-events-none absolute inset-0 rounded-full border border-red-500/60"
                      />
                    </>
                  )}
                </AnimatePresence>

                {/* Heart icon — bounces on like, dips on unlike.
                    Wrapper is `inline-flex` so the transform pivots
                    cleanly around the icon's geometric center. */}
                <motion.span
                  animate={
                    likeAnim === 'liked'
                      ? { scale: [1, 1.35, 0.92, 1], rotate: [0, -8, 5, 0] }
                      : likeAnim === 'unliked'
                        ? { scale: [1, 0.82, 1] }
                        : { scale: 1, rotate: 0 }
                  }
                  transition={{ duration: 0.55, ease: [0.25, 0.1, 0.25, 1], times: [0, 0.32, 0.68, 1] }}
                  className="inline-flex items-center justify-center"
                >
                  <Heart
                    className={`w-[18px] h-[18px] transition-colors duration-200 ${isLiked ? 'fill-red-500 text-red-500' : ''}`}
                  />
                </motion.span>
              </span>

              <span className="pi-label">
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.span
                    key={isLiked ? 'liked-label' : 'unliked-label'}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
                    className="inline-block"
                  >
                    {isLiked ? 'Liked' : 'Like'}
                  </motion.span>
                </AnimatePresence>
              </span>
            </button>

            <button
              type="button"
              className="player-action-icon-btn"
              onClick={() => {
                // Past the intro? Let the sharer choose which entry
                // point the recipient lands on. Otherwise skip the
                // prompt and just fire a clean episode link — no one
                // wants a modal for "share from 0:02".
                if (currentTime > 5) {
                  setShareDialogTs(currentTime);
                  setShareDialogOpen(true);
                } else {
                  shareEpisode(podcast, episode);
                }
              }}
              title={currentTime > 5 ? 'Share episode' : 'Share episode'}
            >
              <span className="pi-circle">
                <Share2 className="w-[18px] h-[18px]" />
              </span>
              <span className="pi-label">Share</span>
            </button>

            <button
              type="button"
              className="player-action-icon-btn"
              onClick={handleOpenAddToPlaylist}
              title="Add to playlist"
            >
              <span className="pi-circle">
                <Plus className="w-[18px] h-[18px]" />
              </span>
              <span className="pi-label">Playlist</span>
            </button>

            <button
              type="button"
              className={`player-action-icon-btn ${sleepTimerActive || playbackRate !== 1 ? 'active' : ''}`}
              onClick={() => setShowOptionsModal(true)}
              aria-haspopup="dialog"
              aria-expanded={showOptionsModal}
              title="Player options"
            >
              <span className="pi-circle">
                <Settings2 className="w-[18px] h-[18px]" />
                {(sleepTimerActive || playbackRate !== 1) && <span className="pi-dot" />}
              </span>
              <span className="pi-label tabular-nums">
                {sleepTimerActive
                  ? formatTimerDisplay(sleepTimerRemaining)
                  : playbackRate !== 1
                  ? `${playbackRate}x`
                  : 'Options'}
              </span>
            </button>
          </div>
        </div>

        {/* Waveform + Progress */}
        <div className="w-full max-w-2xl my-3">
          <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>

          <div className="player-waveform-section">
            <div
              className="waveform-container"
              onClick={(e) => {
                if (!onSeek || !duration) return;
                const rect = e.currentTarget.getBoundingClientRect();
                const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                onSeek(ratio * duration);
              }}
            >
              <div className={`waveform-wave ${isPlaying ? 'playing' : ''}`} />
              <div className="waveform-played" style={{ '--progress': `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }} />
              <div className="progress-indicator" style={{ left: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }} />
            </div>
          </div>
        </div>

        {/* Playback Controls */}
        <div className="player-controls-section">
          <div className="player-controls-large">
            <button
              className={`player-control-large shuffle-btn ${shuffleActive ? 'active' : ''}`}
              title="Shuffle"
              aria-pressed={!!shuffleActive}
              onClick={handleShuffle}
            >
              <span className="icon"><ShuffleIcon /></span>
            </button>
            <button className="player-control-large seek-btn backward-btn" title={`Back ${skipBack}`} onClick={() => onSkip && onSkip(-skipBack)}>
              <span className="icon"><BackwardIcon seconds={skipBack} /></span>
            </button>
            <button className="player-control-large prev-btn" title="Previous track" onClick={() => onPrev && onPrev()}>
              <span className="icon"><PrevIcon /></span>
            </button>
            <button
              className="player-control-large play-pause"
              title={isPlaying ? 'Pause' : 'Play'}
              aria-pressed={!!isPlaying}
              onClick={onToggle}
            >
              <span className="icon">{isPlaying ? <PauseIcon /> : <PlayIcon />}</span>
            </button>
            <button className="player-control-large next-btn" title="Next track" onClick={() => onNext && onNext()}>
              <span className="icon"><NextIcon /></span>
            </button>
            <button className="player-control-large seek-btn forward-btn" title={`Forward ${skipFwd}`} onClick={() => onSkip && onSkip(skipFwd)}>
              <span className="icon"><ForwardIcon seconds={skipFwd} /></span>
            </button>
            <button
              className={`player-control-large repeat-btn ${effectiveRepeat !== 'off' ? 'active' : ''} ${effectiveRepeat === 'one' ? 'repeat-one' : ''}`}
              title="Repeat"
              aria-pressed={effectiveRepeat !== 'off'}
              onClick={handleRepeat}
            >
              <span className="icon"><RepeatIcon /></span>
            </button>
          </div>
        </div>
        </motion.div>
        {/* /Swipe Deck */}

        {/* ═══════════════════════════════════════════════════════════
            BELOW-CONTROLS CONTENT SECTIONS
            ═══════════════════════════════════════════════════════════ */}

        {/* ── 1. Episode Show Notes (expandable) ── */}
        {(episode?.description || episode?.summary) && (
          <ExpandableShowNotes html={episode?.description || episode?.summary || ''} />
        )}

        {/* ── Loading indicator for below-controls sections ── */}
        {sectionsLoading && upNext.length === 0 && recommendations.length === 0 && showEpisodes.length === 0 && (
          <div className="w-full max-w-2xl mt-8 flex flex-col items-center gap-3 py-6">
            <div className="relative w-8 h-8">
              <div className="absolute inset-0 rounded-full border-2 border-white/[0.06]" />
              <div className="absolute inset-0 rounded-full border-2 border-t-red-500/60 border-r-transparent border-b-transparent border-l-transparent animate-spin" />
            </div>
            <span className="text-[11px] text-white/25 tracking-wider uppercase">Loading</span>
          </div>
        )}

        {/* ── 2. Up Next ── */}
        {upNext.length > 0 && (
          <div className="w-full max-w-2xl mt-8">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[10px] font-bold tracking-[0.2em] text-white/40 uppercase">Up Next</h3>
              <button
                onClick={() => setShowQueue(true)}
                className="text-[10px] font-semibold tracking-wider text-white/30 hover:text-white/60 uppercase transition-colors"
              >
                View Queue
              </button>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-0" style={{ scrollbarWidth: 'none' }}>
              {upNext.slice(0, 8).map((item, idx) => {
                const ep = item.episode || item;
                const pd = item.podcast || podcast;
                const absoluteIndex = (Array.isArray(queue) && queue.length > 0 && queueIndex >= 0) ? (queueIndex + 1 + idx) : undefined;
                return (
                  <div key={ep?.id || idx} className="flex-shrink-0 w-28 group relative">
                    {/* Thumbnail */}
                    <div
                      className="relative w-28 h-28 rounded-lg overflow-hidden bg-white/5 mb-2 shadow-lg group-hover:shadow-xl transition-shadow cursor-pointer"
                      onClick={() => handlePlayFromQueue(item, absoluteIndex)}
                    >
                      <img
                        src={ep?.cover_image || pd?.cover_image || cover}
                        alt={ep?.title || 'Episode'}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      {/* Triple-dot menu */}
                      <div className="absolute bottom-1 right-1 z-[5]" onClick={(e) => e.stopPropagation()}>
                        <EpisodeMenu
                          episode={ep}
                          podcast={pd}
                          className="bg-black/60 backdrop-blur-sm"
                          side="right"
                          inline
                          onRemoveFromQueue={typeof absoluteIndex === 'number' ? () => removeFromQueue(absoluteIndex) : undefined}
                          onAddToPlaylist={handleAddAnyToPlaylist}
                        />
                      </div>
                    </div>
                    {/* Title + Show */}
                    <div className="w-28 cursor-pointer" onClick={() => handlePlayFromQueue(item, absoluteIndex)}>
                      <ScrollingTitle
                        as="span"
                        text={ep?.title || 'Episode'}
                        className="text-xs font-semibold text-white/90"
                      />
                      <p className="text-[10px] text-white/40 mt-0.5 truncate">{pd?.title || ''}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── 3. Recommended Episodes ── */}
        {recommendations.length > 0 && (
          <div className="w-full mt-8 max-w-2xl">
            <h3 className="text-[10px] font-bold tracking-[0.2em] text-white/40 uppercase mb-3">Recommended for You</h3>
            <div className="space-y-2">
              {recommendations.map((rec) => {
                const recPod = rec._podcast || {};
                return (
                  <div
                    key={rec.id}
                    className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/[0.04] transition-colors group"
                  >
                    <div
                      className="w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 bg-white/5 shadow-md cursor-pointer"
                      onClick={() => {
                        if (typeof loadAndPlay === 'function') {
                          loadAndPlay({ podcast: recPod, episode: rec, resume: { progress: 0 } });
                        }
                      }}
                    >
                      {(rec.cover_image || recPod.cover_image) ? (
                        <img src={rec.cover_image || recPod.cover_image} alt={rec.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-white/20 text-lg">🎧</div>
                      )}
                    </div>
                    <div
                      className="flex-1 min-w-0 cursor-pointer"
                      onClick={() => {
                        if (typeof loadAndPlay === 'function') {
                          loadAndPlay({ podcast: recPod, episode: rec, resume: { progress: 0 } });
                        }
                      }}
                    >
                      <ScrollingTitle
                        as="div"
                        text={rec.title}
                        className="text-sm font-semibold text-white/90 group-hover:text-white transition-colors"
                      />
                      <div className="text-[11px] text-white/35 truncate mt-0.5">{recPod.title || ''}</div>
                    </div>
                    <div onClick={(e) => e.stopPropagation()}>
                      <EpisodeMenu
                        episode={rec}
                        podcast={recPod}
                        side="left"
                        inline
                        onPlayNow={() => {
                          if (typeof loadAndPlay === 'function') {
                            loadAndPlay({ podcast: recPod, episode: rec, resume: { progress: 0 } });
                          }
                        }}
                        onAddToPlaylist={handleAddAnyToPlaylist}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── 4. More from this Show ── */}
        {showEpisodes.length > 0 && (
          <div className="w-full mt-8 max-w-2xl mb-8">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[10px] font-bold tracking-[0.2em] text-white/40 uppercase">More from {podcast?.title || 'this Show'}</h3>
              <button
                onClick={() => {
                  const pid = podcast?.id || podcast?.slug;
                  if (pid) { onCollapse?.(); navigate(`${createPageUrl('Episodes')}?id=${encodeURIComponent(pid)}`); }
                }}
                className="text-[10px] font-semibold tracking-wider text-white/30 hover:text-white/60 uppercase transition-colors"
              >
                View All
              </button>
            </div>
            <div className="flex gap-3 sm:gap-4 items-start">
              {/* Left: Podcast cover art */}
              <button
                onClick={() => {
                  const pid = podcast?.id || podcast?.slug;
                  if (pid) { onCollapse?.(); navigate(`${createPageUrl('Episodes')}?id=${encodeURIComponent(pid)}`); }
                }}
                className="flex-shrink-0 w-[120px] sm:w-[140px] group"
              >
                <div className="w-full aspect-square rounded-xl overflow-hidden shadow-xl bg-white/5">
                  <img
                    src={podcast?.cover_image || cover}
                    alt={podcast?.title || 'Podcast'}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                </div>
                <p className="text-xs font-semibold text-white/70 mt-2 text-center truncate group-hover:text-white transition-colors">{podcast?.title || ''}</p>
              </button>

              {/* Right: Stacked episode cards */}
              <div className="flex-1 min-w-0 flex flex-col gap-2">
                {showEpisodes.slice(0, 3).map((ep) => (
                  <div
                    key={ep.id}
                    className="w-full flex items-center gap-3 p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.05] hover:bg-white/[0.06] transition-colors group"
                  >
                    <div
                      className="w-11 h-11 rounded-lg overflow-hidden flex-shrink-0 bg-white/5 cursor-pointer"
                      onClick={() => {
                        if (typeof loadAndPlay === 'function') {
                          loadAndPlay({ podcast, episode: ep, resume: { progress: 0 } });
                        }
                      }}
                    >
                      <img
                        src={ep.cover_image || podcast?.cover_image || cover}
                        alt={ep.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div
                      className="flex-1 min-w-0 cursor-pointer"
                      onClick={() => {
                        if (typeof loadAndPlay === 'function') {
                          loadAndPlay({ podcast, episode: ep, resume: { progress: 0 } });
                        }
                      }}
                    >
                      <ScrollingTitle
                        as="div"
                        text={ep.title}
                        className="text-xs font-semibold text-white/80 group-hover:text-white transition-colors"
                      />
                      <div className="text-[10px] text-white/30 mt-0.5 truncate">{ep.published_at ? formatDate(ep.published_at) : ''}</div>
                    </div>
                    <div onClick={(e) => e.stopPropagation()}>
                      <EpisodeMenu
                        episode={ep}
                        podcast={podcast}
                        inline
                        onPlayNow={() => {
                          if (typeof loadAndPlay === 'function') {
                            loadAndPlay({ podcast, episode: ep, resume: { progress: 0 } });
                          }
                        }}
                        onAddToPlaylist={handleAddAnyToPlaylist}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Bottom spacer for safe area */}
        <div className="h-8" />
      </div>
      {/* /Inner scroll container */}
      </div>

      {/* Player Options Modal (Sleep Timer + Playback Speed) */}
      <AnimatePresence>
        {showOptionsModal && (
          <div className="fixed inset-0 z-[3500] flex items-center justify-center">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => setShowOptionsModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 20 }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="relative w-[92vw] max-w-[400px] max-h-[85vh] bg-gradient-to-br from-[#0d0d12] via-[#141418] to-[#1a1a22] text-white border border-white/[0.06] rounded-2xl shadow-2xl shadow-black/60 overflow-hidden"
            >
              {/* Subtle glows */}
              <div className="absolute -top-20 -right-20 w-56 h-56 bg-amber-500/8 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -bottom-20 -left-20 w-56 h-56 bg-indigo-500/6 rounded-full blur-3xl pointer-events-none" />

              <div className="relative p-6 overflow-y-auto max-h-[85vh]" style={{ scrollbarWidth: 'none' }}>
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-bold tracking-tight">Player Options</h2>
                  <button
                    type="button"
                    onClick={() => setShowOptionsModal(false)}
                    className="p-1.5 rounded-full hover:bg-white/10 text-white/50 hover:text-white transition-colors"
                    aria-label="Close options"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* ── Sleep Timer Section ── */}
                <div className="mb-6">
                  <div className="flex items-center gap-2.5 mb-3">
                    <div className="w-7 h-7 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-400">
                      <ClockIcon />
                    </div>
                    <h3 className="text-sm font-semibold text-white/90 uppercase tracking-wider">Sleep Timer</h3>
                  </div>

                  {sleepTimerActive && (
                    <div className="mb-3 p-3 rounded-xl bg-amber-500/[0.06] border border-amber-500/[0.12] flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="relative flex h-2.5 w-2.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-400" />
                        </span>
                        <span className="text-sm text-white/80">Timer active</span>
                      </div>
                      <span className="text-sm font-mono font-semibold text-amber-400 tabular-nums">{formatTimerDisplay(sleepTimerRemaining)}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: '15m', minutes: 15 },
                      { label: '30m', minutes: 30 },
                      { label: '45m', minutes: 45 },
                      { label: '60m', minutes: 60 },
                      { label: isAudiobook(podcast) ? 'End of chapter' : 'End of ep', minutes: null },
                      ...(sleepTimerActive ? [{ label: 'Off', minutes: -1 }] : []),
                    ].map((opt) => (
                      <button
                        key={opt.label}
                        onClick={() => {
                          if (opt.minutes === null) {
                            const remaining = duration - currentTime;
                            if (remaining > 0) setSleepTimer(remaining / 60);
                          } else if (opt.minutes === -1) {
                            cancelSleepTimer();
                          } else {
                            setSleepTimer(opt.minutes);
                          }
                          setShowOptionsModal(false);
                        }}
                        className={`px-3 py-2.5 rounded-xl text-sm font-medium border transition-all duration-200 ${
                          opt.minutes === -1
                            ? 'bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20'
                            : 'bg-white/[0.04] border-white/[0.06] text-white/90 hover:bg-white/[0.08] hover:border-white/[0.1]'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  {/* Custom minutes input */}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const mins = parseInt(customSleepMinutes, 10);
                      if (Number.isFinite(mins) && mins > 0 && mins <= 600) {
                        setSleepTimer(mins);
                        setCustomSleepMinutes('');
                        setShowOptionsModal(false);
                      }
                    }}
                    className="mt-3 flex items-center gap-2"
                  >
                    <input
                      type="number"
                      min="1"
                      max="600"
                      inputMode="numeric"
                      placeholder="Custom (minutes)"
                      value={customSleepMinutes}
                      onChange={(e) => setCustomSleepMinutes(e.target.value.replace(/[^0-9]/g, ''))}
                      className="flex-1 bg-white/[0.04] border border-white/[0.06] rounded-xl px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-amber-500/40 focus:ring-1 focus:ring-amber-500/20 transition-all"
                    />
                    <button
                      type="submit"
                      disabled={!customSleepMinutes || !Number.isFinite(parseInt(customSleepMinutes, 10))}
                      className="px-4 py-2 rounded-xl text-sm font-semibold bg-amber-500/15 border border-amber-500/30 text-amber-300 hover:bg-amber-500/25 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    >
                      Set
                    </button>
                  </form>
                </div>

                {/* Divider */}
                <div className="h-px bg-white/[0.06] mb-6" />

                {/* ── Playback Speed Section ── */}
                <div>
                  <div className="flex items-center gap-2.5 mb-3">
                    <div className="w-7 h-7 rounded-full bg-indigo-500/10 flex items-center justify-center">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                    </div>
                    <h3 className="text-sm font-semibold text-white/90 uppercase tracking-wider">Playback Speed</h3>
                    {playbackRate !== 1 && <span className="text-xs font-semibold text-indigo-400 bg-indigo-400/10 px-2 py-0.5 rounded-full">{playbackRate}x</span>}
                  </div>

                  <div className="grid grid-cols-4 gap-2">
                    {[0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 3].map((rate) => (
                      <button
                        key={rate}
                        onClick={() => { setPlaybackRate(rate); setShowOptionsModal(false); }}
                        className={`px-2 py-2.5 rounded-xl text-sm font-semibold border transition-all duration-200 ${
                          playbackRate === rate
                            ? 'bg-indigo-500/15 border-indigo-500/30 text-indigo-300'
                            : 'bg-white/[0.03] border-white/[0.06] text-white/70 hover:bg-white/[0.08] hover:border-white/[0.1]'
                        }`}
                      >
                        {rate === 1 ? '1x' : `${rate}x`}
                      </button>
                    ))}
                  </div>

                  {playbackRate !== 1 && (
                    <button
                      onClick={() => { setPlaybackRate(1); setShowOptionsModal(false); }}
                      className="w-full mt-2.5 px-4 py-2 rounded-xl text-sm font-medium bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.08] transition-all text-white/60"
                    >
                      Reset to Normal
                    </button>
                  )}
                </div>

                {/* ── Download Section (premium-only) ──
                    Temporarily hidden: offline downloads are an app-only
                    feature and the Capacitor mobile build isn't shipping
                    yet. Flip DOWNLOAD_SECTION_ENABLED (declared near the
                    top of the component) back to true once the app is
                    live. */}
                {DOWNLOAD_SECTION_ENABLED && isPremium && (
                  <>
                    <div className="h-px bg-white/[0.06] my-6" />
                    <div>
                      <div className="flex items-center gap-2.5 mb-3">
                        <div className="w-7 h-7 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                          <DownloadIcon />
                        </div>
                        <h3 className="text-sm font-semibold text-white/90 uppercase tracking-wider">Download</h3>
                      </div>
                      <p className="text-xs text-white/50 mb-3 leading-relaxed">
                        Save this episode to your device for offline listening.
                      </p>
                      <button
                        type="button"
                        onClick={() => { handleDownload(); setShowOptionsModal(false); }}
                        disabled={downloading}
                        className="w-full px-4 py-2.5 rounded-xl text-sm font-semibold bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 hover:bg-emerald-500/20 hover:border-emerald-500/40 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                      >
                        <DownloadIcon />
                        <span>{downloading ? 'Saving…' : 'Download episode'}</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add to Playlist Modal — shared component, same one the
          Library and Playlist screens use. Episode is resolved in
          `handleOpenAddToPlaylist` *before* the modal opens, so the
          previously-needed in-modal "Preparing episode…" state is
          gone. */}
      <AddToPlaylistModal
        isOpen={showAddModal && !!episodeToAdd?.id}
        episode={episodeToAdd}
        playlists={playlists}
        onClose={() => { setShowAddModal(false); setEpisodeToAdd(null); }}
        onAdded={({ playlist: pl, action }) => {
          if (action === 'created') addPlaylist(pl);
          if (action === 'updated') updatePlaylist(pl);
        }}
      />

      {/* Queue Overlay (Drawer) — animated enter/exit */}
      <AnimatePresence>
        {showQueue && (
          <div className="fixed inset-0 z-[4000] flex justify-end">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setShowQueue(false)}
            />
            
            {/* Drawer Content */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="relative bg-[#141414] border-l border-white/10 w-full max-w-[400px] h-full overflow-hidden flex flex-col rounded-l-[32px]"
            >
            <div className="w-full flex justify-between items-center p-6 pb-0">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold tracking-[0.2em] text-white/40 uppercase">Playing from</span>
                <h2 className="text-white text-lg font-bold truncate max-w-[240px]">{podcast?.title || 'Podcast'}</h2>
              </div>
              <button 
                onClick={() => setShowQueue(false)}
                className="p-2 rounded-full hover:bg-white/10 text-white/70 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar">
              <div className="px-6 py-8 pb-12">
                <div className="space-y-8">
                  {/* Now Playing Section */}
                  <div>
                    <h3 className="text-[10px] font-bold tracking-[0.2em] text-white/40 uppercase mb-4">Now Playing</h3>
                    {episode && (
                      <div className="flex items-center gap-4 p-3 rounded-2xl bg-white/5 border border-white/5">
                        <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 shadow-lg">
                          <img 
                            src={episode?.cover_image || podcast?.cover_image || cover} 
                            alt={episode?.title} 
                            className="w-full h-full object-cover" 
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <ScrollingTitle
                            as="div"
                            text={episode?.title || ''}
                            className="text-white text-base font-bold mb-1"
                          />
                          <div className="text-white/60 text-sm truncate">{podcast?.title}</div>
                        </div>
                        <div className="pr-2">
                          <div className="w-5 h-5 flex items-center justify-center">
                            <div className="flex gap-1 items-end h-3">
                              <div className="w-0.5 bg-[#ff0040] animate-[music-bar_0.8s_ease-in-out_infinite] h-full" />
                              <div className="w-0.5 bg-[#ff0040] animate-[music-bar_1.1s_ease-in-out_infinite] h-[70%]" />
                              <div className="w-0.5 bg-[#ff0040] animate-[music-bar_0.9s_ease-in-out_infinite] h-[85%]" />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Up Next Section */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-[10px] font-bold tracking-[0.2em] text-white/40 uppercase">Up Next</h3>
                      <div className="flex items-center gap-2">
                        {/* Hold-to-shuffle — randomizes the upcoming queue
                            order in place. Press-and-hold is required so
                            an accidental tap on this drawer can't blow up
                            a curated listening order. */}
                        {upNext && upNext.length > 1 && typeof shuffleUpNext === 'function' && (
                          <HoldToShuffleButton
                            onConfirm={shuffleUpNext}
                            label="Shuffle queue"
                          />
                        )}
                        {upNext && upNext.length > 0 && typeof clearQueue === 'function' && (
                          <button
                            type="button"
                            onClick={clearQueue}
                            className="inline-flex items-center gap-1 text-[10px] font-semibold tracking-wider text-white/40 hover:text-red-400 uppercase transition-colors"
                          >
                            <Trash2 className="w-3 h-3" />
                            Clear
                          </button>
                        )}
                      </div>
                    </div>

                    {(!upNext || upNext.length === 0) ? (
                      <div className="text-white/40 text-sm py-8 text-center bg-white/[0.02] rounded-2xl border border-dashed border-white/5">
                        No upcoming episodes
                      </div>
                    ) : (
                      <QueueDragList
                        upNext={upNext}
                        queue={queue}
                        queueIndex={queueIndex}
                        podcast={podcast}
                        sensors={dndSensors}
                        onDragEnd={handleQueueDragEnd}
                        onPlay={handlePlayFromQueue}
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Share-choice dialog — portal'd via Radix so it always layers
          above the expanded player overlay. Only opens when the user
          is past the intro; otherwise the Share button just fires a
          clean share without a prompt. */}
      <ShareEpisodeDialog
        isOpen={shareDialogOpen}
        onClose={() => setShareDialogOpen(false)}
        podcast={podcast}
        episode={episode}
        timestampSeconds={shareDialogTs}
      />
    </motion.div>
  );
}

ExpandedPlayer.propTypes = {
  podcast: PropTypes.object,
  episode: PropTypes.object,
  // isPlaying / currentTime / duration are pulled from `useAudioTime`,
  // not props — see `@/hooks/use-audio-time`.
  onToggle: PropTypes.func,
  onCollapse: PropTypes.func,
  onSeek: PropTypes.func,
  onSkip: PropTypes.func,
  onNext: PropTypes.func,
  onPrev: PropTypes.func,
  isShuffling: PropTypes.bool,
  repeatMode: PropTypes.oneOf(['off', 'all', 'one']),
  onShuffleToggle: PropTypes.func,
  onRepeatToggle: PropTypes.func,
  queue: PropTypes.array,
  queueIndex: PropTypes.number,
  playQueueIndex: PropTypes.func,
  loadAndPlay: PropTypes.func,
};

// Memoise the player so the parent provider's other state changes
// (sleep timer ticks, queue mutations, isShuffling toggles, etc.)
// don't force a fresh render of this entire 2 000-line tree when its
// own props are unchanged. Time-driven UI subscribes to
// `audioTimeStore` directly, so memoisation here is a pure win.
const MemoExpandedPlayer = memo(ExpandedPlayer);
export default MemoExpandedPlayer;
