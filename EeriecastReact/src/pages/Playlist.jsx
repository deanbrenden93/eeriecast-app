import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Playlist as PlaylistApi } from '@/api/entities';
import { Button } from '@/components/ui/button';
import { Play, Clock, ListMusic, Headphones, Shuffle, MoreVertical, Pencil, Trash2, Plus, Compass } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import EpisodesTable from '@/components/podcasts/EpisodesTable';
import { useAudioPlayerContext } from '@/context/AudioPlayerContext';
import { useUser } from '@/context/UserContext.jsx';
import { useAuthModal } from '@/context/AuthModalContext.jsx';
import { usePodcasts } from '@/context/PodcastContext.jsx';
import { usePlaylistContext, getEpisodesBatch } from '@/context/PlaylistContext.jsx';
import AddToPlaylistModal from '@/components/library/AddToPlaylistModal';
import PlaylistRenameModal from '@/components/library/PlaylistRenameModal';
import PlaylistDeleteModal from '@/components/library/PlaylistDeleteModal';
import PlaylistSortableList from '@/components/library/PlaylistSortableList';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { toast } from '@/components/ui/use-toast';
import { useSafeBack } from '@/hooks/use-safe-back';
import { createPageUrl } from '@/utils';

// Format the playlist's total runtime in a human-friendly shape:
// "5m" / "47m" / "1h 12m" / "12h" — matches what listeners expect
// to see on a podcast/audiobook surface and is far more legible
// than the raw "73m" the backend stores.
function formatRuntime(approxMinutes) {
  if (typeof approxMinutes !== 'number' || !Number.isFinite(approxMinutes) || approxMinutes <= 0) return '';
  const total = Math.round(approxMinutes);
  if (total < 60) return `${total}m`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

// ── Mosaic thumbnail component ────────────────────────────────────
function PlaylistMosaic({ images = [], size = 'lg', className = '' }) {
  const imgs = images.filter(Boolean).slice(0, 3);
  const sizeClasses = size === 'lg'
    ? 'w-36 sm:w-44 md:w-52 aspect-square'
    : 'w-20 h-20';

  const fallback = (
    <div className={`${sizeClasses} rounded-xl bg-gradient-to-br from-violet-900/40 to-eeriecast-deep-violet/30 flex items-center justify-center ring-1 ring-white/[0.06] ${className}`}>
      <Headphones className={size === 'lg' ? 'w-12 h-12 text-violet-400/40' : 'w-6 h-6 text-violet-400/40'} />
    </div>
  );

  if (imgs.length === 0) return fallback;

  if (imgs.length === 1) {
    return (
      <div className={`${sizeClasses} rounded-xl overflow-hidden ring-1 ring-white/[0.06] shadow-2xl shadow-black/60 ${className}`}>
        <img src={imgs[0]} alt="" className="w-full h-full object-cover" />
      </div>
    );
  }

  if (imgs.length === 2) {
    return (
      <div className={`${sizeClasses} rounded-xl overflow-hidden ring-1 ring-white/[0.06] shadow-2xl shadow-black/60 grid grid-cols-2 ${className}`}>
        <img src={imgs[0]} alt="" className="w-full h-full object-cover" />
        <img src={imgs[1]} alt="" className="w-full h-full object-cover" />
      </div>
    );
  }

  // 3 images: one large left, two stacked right
  return (
    <div className={`${sizeClasses} rounded-xl overflow-hidden ring-1 ring-white/[0.06] shadow-2xl shadow-black/60 grid grid-cols-2 ${className}`}>
      <img src={imgs[0]} alt="" className="w-full h-full object-cover row-span-2" />
      <div className="flex flex-col h-full">
        <img src={imgs[1]} alt="" className="w-full flex-1 object-cover" />
        <img src={imgs[2]} alt="" className="w-full flex-1 object-cover" />
      </div>
    </div>
  );
}

export { PlaylistMosaic };

export default function Playlist() {
  const query = useQuery();
  const idParam = query.get('id');
  const navigate = useNavigate();
  // Library is the natural home for a playlist view, so direct-link
  // visitors who hit Back end up there rather than off-site.
  const safeGoBack = useSafeBack(createPageUrl('Library'));

  const [playlist, setPlaylist] = useState(null);
  const [episodes, setEpisodes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [removingEpisodeId, setRemovingEpisodeId] = useState(null);
  const [sortOrder, setSortOrder] = useState('Custom');

  const { loadAndPlay, setPlaybackQueue } = useAudioPlayerContext();
  const { isAuthenticated, isPremium } = useUser();
  const { openAuth } = useAuthModal();
  const { getById: getPodcastById } = usePodcasts();
  const {
    playlists,
    updatePlaylist,
    removePlaylist,
    removeEpisodeFromPlaylist,
    reorderPlaylist,
  } = usePlaylistContext();

  // Add-to-Playlist modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [episodeToAdd, setEpisodeToAdd] = useState(null);

  // Edit / delete modals (now reachable directly from the detail
  // page, not just from the Library card).
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Track which episode (if any) is animating out so the row can
  // fade/slide before unmounting.
  const [exitingId, setExitingId] = useState(null);

  const handleOpenAddToPlaylist = (episode) => {
    if (!isAuthenticated) { openAuth('login'); return; }
    if (!isPremium) { window.location.assign('/Premium'); return; }
    setEpisodeToAdd(episode);
    setShowAddModal(true);
  };

  // ── Fetch playlist + episodes ───────────────────────────────────
  //
  // Episodes are fetched in parallel through `getEpisodesBatch`, which
  // dedupes against a module-scoped cache shared with the Library card
  // mosaics. Switching between Library and a Playlist (or back) no
  // longer triggers N sequential round trips; previously-seen episodes
  // resolve from cache instantly.
  useEffect(() => {
    let canceled = false;
    async function load() {
      if (!idParam) { setIsLoading(false); return; }
      setIsLoading(true);
      try {
        const pl = await PlaylistApi.get(idParam);
        if (canceled) return;
        setPlaylist(pl);

        const ids = Array.isArray(pl?.episodes) ? pl.episodes : [];
        if (ids.length === 0) { setEpisodes([]); return; }

        const fetched = await getEpisodesBatch(ids);
        if (canceled) return;

        const eps = fetched
          .filter(Boolean)
          .map((ep) => {
            // Enrich: if `ep.podcast` is just an ID, attach the full
            // podcast object so cover-image fallbacks work.
            if (ep && ep.podcast && typeof ep.podcast !== 'object') {
              const podcastObj = getPodcastById(ep.podcast);
              if (podcastObj) return { ...ep, podcast: podcastObj };
            }
            return ep;
          });

        if (!canceled) setEpisodes(eps);
      } finally {
        if (!canceled) setIsLoading(false);
      }
    }
    load();
    return () => { canceled = true; };
  }, [idParam, getPodcastById]);

  // Sync local `playlist` state when the global context updates this
  // playlist (e.g. another surface added or removed an episode). This
  // keeps the runtime pill, episode count, and ID list in lockstep
  // with the rest of the app without a refetch.
  useEffect(() => {
    if (!playlist?.id) return;
    const fromCtx = playlists.find((p) => p.id === playlist.id);
    if (fromCtx && fromCtx !== playlist) setPlaylist(fromCtx);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playlists]);

  // ── Sorting ─────────────────────────────────────────────────────
  const sortedEpisodes = useMemo(() => {
    if (sortOrder === 'Custom') return episodes;
    const arr = [...episodes];
    const getDate = (e) => new Date(e.created_date || e.published_at || e.release_date || 0).getTime();
    if (sortOrder === 'Newest') arr.sort((a, b) => getDate(b) - getDate(a));
    else if (sortOrder === 'Oldest') arr.sort((a, b) => getDate(a) - getDate(b));
    return arr;
  }, [episodes, sortOrder]);

  // ── Cover art helper ────────────────────────────────────────────
  const getEpArtwork = (ep) => ep?.image_url || ep?.artwork || ep?.cover_image || ep?.podcast?.cover_image || null;

  // Collect unique cover images for the mosaic
  const mosaicImages = useMemo(() => {
    const seen = new Set();
    const imgs = [];
    for (const ep of episodes) {
      const art = getEpArtwork(ep);
      if (art && !seen.has(art)) {
        seen.add(art);
        imgs.push(art);
      }
      if (imgs.length >= 3) break;
    }
    return imgs;
  }, [episodes]);

  // Hero background image (first available artwork)
  const heroImage = mosaicImages[0] || null;

  // ── Build pseudo-podcast for player context ─────────────────────
  const buildPseudoPodcast = (ep) => ({
    id: `playlist-${playlist?.id}`,
    title: playlist?.name || playlist?.title || 'Playlist',
    cover_image: getEpArtwork(ep) || null,
  });

  // ── Play All: queue entire playlist in current sort order ───────
  const handlePlayAll = async () => {
    if (!sortedEpisodes.length) return;
    const pseudoPodcast = buildPseudoPodcast(sortedEpisodes[0]);
    const queueItems = sortedEpisodes.map(ep => ({
      podcast: { ...pseudoPodcast, cover_image: getEpArtwork(ep) || pseudoPodcast.cover_image },
      episode: ep,
      resume: { progress: 0 },
    }));
    await setPlaybackQueue(queueItems, 0);
  };

  // ── Shuffle: queue a randomized version of the current view ─────
  //
  // We build a one-off shuffled copy and queue it; the underlying
  // playlist order on the server is untouched. This matches the way
  // every other player surface treats shuffle (a queue mode, not a
  // permanent reorder) so listeners don't accidentally scramble the
  // ordering they painstakingly set with drag-to-reorder.
  const handleShuffle = async () => {
    if (!sortedEpisodes.length) return;
    const shuffled = [...sortedEpisodes];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const pseudoPodcast = buildPseudoPodcast(shuffled[0]);
    const queueItems = shuffled.map(ep => ({
      podcast: { ...pseudoPodcast, cover_image: getEpArtwork(ep) || pseudoPodcast.cover_image },
      episode: ep,
      resume: { progress: 0 },
    }));
    await setPlaybackQueue(queueItems, 0);
    toast({ title: 'Shuffled', description: `Playing ${shuffled.length} episodes in random order.` });
  };

  // ── Play from here: queue from clicked episode onward ───────────
  const doPlay = async (ep) => {
    if (!ep) return;
    const idx = sortedEpisodes.findIndex(e => e.id === ep.id);
    const startIdx = idx >= 0 ? idx : 0;
    const pseudoPodcast = buildPseudoPodcast(ep);
    const queueItems = sortedEpisodes.map(e => ({
      podcast: { ...pseudoPodcast, cover_image: getEpArtwork(e) || pseudoPodcast.cover_image },
      episode: e,
      resume: { progress: 0 },
    }));
    await setPlaybackQueue(queueItems, startIdx);
  };

  // ── Remove from playlist ────────────────────────────────────────
  const handleRemoveFromPlaylist = async (ep) => {
    if (!ep?.id) return;
    if (!isAuthenticated) { openAuth('login'); return; }
    if (!playlist?.id) return;
    if (removingEpisodeId === ep.id) return;
    setRemovingEpisodeId(ep.id);
    setExitingId(ep.id);
    try {
      // PlaylistContext handles optimistic update, server PATCH, and
      // merges the response (including the freshly recomputed
      // `approximate_length_minutes`) into the global store — so the
      // hero runtime pill and the Library card both update without
      // a refetch.
      const updated = await removeEpisodeFromPlaylist(playlist.id, ep.id);
      // Wait for exit animation to roughly settle before unmounting.
      setTimeout(() => {
        setEpisodes(prev => prev.filter(e => e.id !== ep.id));
        setExitingId(null);
      }, 220);
      if (updated) {
        toast({
          title: 'Removed from playlist',
          description: ep.title ? `"${ep.title}" removed.` : 'Episode removed.',
        });
      }
    } catch {
      setExitingId(null);
      toast({
        title: 'Could not remove episode',
        description: 'Please try again in a moment.',
        variant: 'destructive',
      });
    } finally {
      setRemovingEpisodeId(null);
    }
  };

  // ── Drag-to-reorder ─────────────────────────────────────────────
  //
  // Persist via PATCH on the entire `episodes` array (DRF's
  // PrimaryKeyRelatedField calls `set(...)` which preserves the order
  // we send). Debounced so a user dragging multiple times in quick
  // succession only fires one round trip after they settle.
  const reorderTimerRef = useRef(null);
  const pendingOrderRef = useRef(null);

  const handleReorder = (nextEpisodes) => {
    setEpisodes(nextEpisodes);
    pendingOrderRef.current = nextEpisodes.map((e) => e.id);

    if (reorderTimerRef.current) clearTimeout(reorderTimerRef.current);
    reorderTimerRef.current = setTimeout(async () => {
      const ids = pendingOrderRef.current;
      pendingOrderRef.current = null;
      reorderTimerRef.current = null;
      if (!ids || !playlist?.id) return;
      try {
        await reorderPlaylist(playlist.id, ids);
      } catch {
        toast({
          title: 'Could not save new order',
          description: 'Your changes will sync the next time you make an edit.',
          variant: 'destructive',
        });
      }
    }, 400);
  };

  // Flush any pending reorder when the user navigates away mid-debounce.
  useEffect(() => {
    return () => {
      if (reorderTimerRef.current && pendingOrderRef.current && playlist?.id) {
        const ids = pendingOrderRef.current;
        clearTimeout(reorderTimerRef.current);
        reorderPlaylist(playlist.id, ids).catch(() => { /* swallow */ });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playlist?.id]);

  // ── Rename / delete callbacks ───────────────────────────────────
  const handleRenamed = (updated) => {
    if (updated?.id) {
      setPlaylist((p) => ({ ...p, ...updated }));
      updatePlaylist(updated);
      toast({ title: 'Playlist renamed', description: updated.name });
    }
    setShowRenameModal(false);
  };

  const handleDeleted = () => {
    if (playlist?.id) removePlaylist(playlist.id);
    toast({ title: 'Playlist deleted' });
    setShowDeleteModal(false);
    navigate(createPageUrl('Library'));
  };

  // ── Loading state ───────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen bg-eeriecast-surface text-white">
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-violet-950/20 to-eeriecast-surface" />
          <div className="relative pt-10 md:pt-14 pb-10 md:pb-14 px-4 lg:px-10">
            <div className="flex flex-col md:flex-row items-start gap-6 md:gap-10 max-w-6xl animate-pulse">
              <div className="w-36 sm:w-44 md:w-52 aspect-square rounded-xl bg-white/[0.04]" />
              <div className="flex-1 space-y-4 py-4">
                <div className="h-4 w-20 bg-white/[0.04] rounded-full" />
                <div className="h-8 w-64 bg-white/[0.04] rounded-lg" />
                <div className="h-4 w-40 bg-white/[0.04] rounded-full" />
              </div>
            </div>
          </div>
        </div>
        <div className="px-4 lg:px-10 py-8">
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-white/[0.02] rounded-lg animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Not found ───────────────────────────────────────────────────
  if (!playlist) {
    return (
      <div className="min-h-screen bg-eeriecast-surface text-white">
        <div className="px-4 lg:px-10 py-8">
          <Button variant="ghost" className="mb-4 text-zinc-400 hover:text-white" onClick={safeGoBack}>Back</Button>
          <div className="text-gray-400">Playlist not found.</div>
        </div>
      </div>
    );
  }

  const episodeCount = episodes.length;
  const approx = playlist?.approximate_length_minutes;

  return (
    <div className="min-h-screen bg-eeriecast-surface text-white">

      {/* ═══════════════════════════════════════════════════════
          CINEMATIC HERO HEADER
          ═══════════════════════════════════════════════════════ */}
      <div className="relative overflow-hidden">
        {/* Full-bleed background from first episode artwork */}
        {heroImage && (
          <div
            className="absolute inset-0 bg-no-repeat bg-cover bg-center lg:[background-position:center_25%]"
            style={{ backgroundImage: `url(${heroImage})`, opacity: 0.14 }}
          />
        )}

        {/* Multi-layer gradient fade */}
        <div className="absolute inset-0 bg-gradient-to-b from-eeriecast-surface/60 via-eeriecast-surface/80 to-eeriecast-surface" />
        <div className="absolute inset-0 bg-gradient-to-r from-eeriecast-surface/70 via-transparent to-eeriecast-surface/70" />

        {/* Atmospheric violet glow — playlist identity color */}
        <div className="absolute -bottom-20 left-1/4 w-[30rem] h-[30rem] rounded-full blur-[120px] opacity-[0.07]"
          style={{ background: 'radial-gradient(circle, #7c3aed, transparent)' }}
        />

        {/* Content */}
        <div className="relative pt-10 md:pt-14 pb-10 md:pb-14 px-4 lg:px-10">
          <div className="flex flex-col md:flex-row items-start gap-6 md:gap-10 max-w-6xl">

            {/* Mosaic thumbnail — with halo glow */}
            <div className="relative flex-shrink-0 self-center md:self-start">
              {heroImage && (
                <div className="absolute inset-0 scale-110 rounded-2xl blur-2xl opacity-25"
                  style={{ background: `url(${heroImage}) center/cover` }}
                />
              )}
              <PlaylistMosaic images={mosaicImages} size="lg" />
            </div>

            {/* Info + Actions */}
            <div className="flex-1 min-w-0">
              {/* Badge */}
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-violet-400/90 bg-violet-500/10 border border-violet-400/[0.08] px-2.5 py-1 rounded-full">
                  <ListMusic className="w-3 h-3" />
                  Playlist
                </span>
              </div>

              {/* Title */}
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-3 leading-tight">
                {playlist?.name || playlist?.title || 'Playlist'}
              </h1>

              {/* Meta pills */}
              <div className="flex items-center gap-3 flex-wrap mb-5">
                <span className="inline-flex items-center gap-1.5 text-xs text-zinc-400 bg-white/[0.04] border border-white/[0.06] px-3 py-1.5 rounded-full">
                  <Headphones className="w-3 h-3" />
                  {episodeCount} {episodeCount === 1 ? 'episode' : 'episodes'}
                </span>
                {formatRuntime(approx) && (
                  <motion.span
                    key={approx}
                    initial={{ opacity: 0.5, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.25 }}
                    className="inline-flex items-center gap-1.5 text-xs text-zinc-400 bg-white/[0.04] border border-white/[0.06] px-3 py-1.5 rounded-full"
                  >
                    <Clock className="w-3 h-3" />
                    {formatRuntime(approx)}
                  </motion.span>
                )}
              </div>

              {/* Actions */}
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  className="px-6 py-2.5 rounded-full flex items-center gap-2 text-sm font-semibold bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white shadow-lg shadow-violet-500/15 transition-all duration-500 hover:scale-[1.02] border border-violet-400/10"
                  onClick={handlePlayAll}
                  disabled={!episodes.length}
                >
                  <Play className="w-4 h-4 fill-white" />
                  Play All
                </Button>

                <Button
                  variant="ghost"
                  className="px-5 py-2.5 rounded-full flex items-center gap-2 text-sm font-semibold bg-white/[0.04] hover:bg-white/[0.08] text-white border border-white/[0.08] transition-all duration-300"
                  onClick={handleShuffle}
                  disabled={!episodes.length}
                  aria-label="Shuffle playlist"
                  title="Shuffle"
                >
                  <Shuffle className="w-4 h-4" />
                  Shuffle
                </Button>

                {/* Overflow menu — Edit / Delete */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      aria-label="Playlist options"
                      className="w-10 h-10 rounded-full flex items-center justify-center bg-white/[0.04] hover:bg-white/[0.08] text-zinc-300 hover:text-white border border-white/[0.06] transition-all duration-300"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="bg-[#18181f] border-white/[0.08] text-zinc-300">
                    <DropdownMenuItem
                      onClick={() => setShowRenameModal(true)}
                      className="cursor-pointer focus:bg-white/[0.06] focus:text-white"
                    >
                      <Pencil className="w-4 h-4 mr-2" /> Rename
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="bg-white/[0.06]" />
                    <DropdownMenuItem
                      onClick={() => setShowDeleteModal(true)}
                      className="cursor-pointer text-red-400 focus:bg-red-500/10 focus:text-red-300"
                    >
                      <Trash2 className="w-4 h-4 mr-2" /> Delete playlist
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════
          EPISODES LIST
          ═══════════════════════════════════════════════════════ */}
      <div className="px-4 lg:px-10 pt-6 pb-28 md:pt-8 md:pb-8">
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-3 md:gap-0 mb-5 md:mb-7">
          <h2 className="text-2xl md:text-3xl font-bold">Your Episodes</h2>
          <div className="flex flex-wrap gap-1.5">
            {['Custom', 'Newest', 'Oldest'].map(order => (
              <Button
                key={order}
                variant="ghost"
                onClick={() => setSortOrder(order)}
                className={`rounded-full px-4 py-1.5 text-xs font-medium transition-all duration-300 ${
                  sortOrder === order
                    ? 'bg-white/[0.06] text-white border border-white/[0.08]'
                    : 'text-zinc-500 hover:bg-white/[0.03] hover:text-zinc-300'
                }`}
              >
                {order}
              </Button>
            ))}
          </div>
        </div>

        {episodes.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="text-center py-16 px-6 rounded-2xl bg-gradient-to-b from-violet-950/10 to-transparent border border-white/[0.04]"
          >
            <div className="w-16 h-16 rounded-full bg-violet-500/10 ring-1 ring-violet-400/20 flex items-center justify-center mx-auto mb-5">
              <Headphones className="w-7 h-7 text-violet-300/80" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-1.5">This playlist is empty</h3>
            <p className="text-zinc-500 text-sm max-w-sm mx-auto mb-6">
              Browse podcasts, then tap the menu on any episode and choose
              <span className="text-zinc-300"> Add to Playlist</span> to start
              building your queue.
            </p>
            <div className="flex items-center justify-center gap-2 flex-wrap">
              <Button
                onClick={() => navigate(createPageUrl('Discover'))}
                className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white px-5 py-2 rounded-full inline-flex items-center gap-2 text-sm font-semibold shadow-lg shadow-violet-500/15 border border-violet-400/10"
              >
                <Compass className="w-4 h-4" />
                Discover episodes
              </Button>
              <Button
                variant="ghost"
                onClick={() => navigate(createPageUrl('Library'))}
                className="px-5 py-2 rounded-full text-sm text-zinc-300 hover:text-white hover:bg-white/[0.05]"
              >
                <Plus className="w-4 h-4 mr-1.5" />
                Browse my library
              </Button>
            </div>
          </motion.div>
        ) : sortOrder === 'Custom' ? (
          // Custom order is the only mode that makes sense to drag —
          // sorting by date overrides whatever order the user picks.
          <PlaylistSortableList
            episodes={sortedEpisodes}
            exitingId={exitingId}
            removingEpisodeId={removingEpisodeId}
            onPlay={doPlay}
            onReorder={handleReorder}
            onRemoveFromPlaylist={handleRemoveFromPlaylist}
            onAddToPlaylist={handleOpenAddToPlaylist}
          />
        ) : (
          <AnimatePresence initial={false}>
            <EpisodesTable
              episodes={sortedEpisodes.filter(e => e.id !== exitingId)}
              onPlay={doPlay}
              onRemoveFromPlaylist={handleRemoveFromPlaylist}
              removingEpisodeId={removingEpisodeId}
              onAddToPlaylist={handleOpenAddToPlaylist}
            />
          </AnimatePresence>
        )}
      </div>

      {/* Add to Playlist Modal — the shared one. Multi-select &
          motion confirmation handled inside; we just need to merge
          the resulting playlist(s) into local + global state. */}
      <AddToPlaylistModal
        isOpen={showAddModal}
        episode={episodeToAdd}
        playlists={playlists}
        onClose={() => { setShowAddModal(false); setEpisodeToAdd(null); }}
        onAdded={({ playlist: pl, action }) => {
          if (action === 'updated' && pl?.id) updatePlaylist(pl);
          // 'created' is also possible from the Add modal's "create
          // a new playlist" path; PlaylistContext.addPlaylist is
          // already called inside the modal, so we just close here.
        }}
      />

      {/* Rename / Delete modals (now reachable from the detail page) */}
      <PlaylistRenameModal
        isOpen={showRenameModal}
        playlist={playlist}
        onClose={() => setShowRenameModal(false)}
        onRenamed={handleRenamed}
      />
      <PlaylistDeleteModal
        isOpen={showDeleteModal}
        playlist={playlist}
        onClose={() => setShowDeleteModal(false)}
        onDeleted={handleDeleted}
      />
    </div>
  );
}
