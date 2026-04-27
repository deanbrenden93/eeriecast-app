import { useState, useEffect, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { Podcast, UserLibrary } from "@/api/entities";
import { Button } from "@/components/ui/button";
import { Play, Edit, Plus, Download, Trash2, Headphones, MoreVertical } from "lucide-react";
import { Capacitor } from '@capacitor/core';
import FavoritesTab from "../components/library/FavoritesTab";
import FollowingTab from "../components/library/FollowingTab";
import HistoryTab from "../components/library/HistoryTab";
import ExpandedPlayer from "../components/podcasts/ExpandedPlayer";
import { useAudioPlayerContext } from "@/context/AudioPlayerContext";
import { AnimatePresence, motion } from "framer-motion";
import PlaylistCreateModal from "../components/library/PlaylistCreateModal";
import PlaylistRenameModal from "../components/library/PlaylistRenameModal";
import PlaylistDeleteModal from "../components/library/PlaylistDeleteModal";
import AddToPlaylistModal from "@/components/library/AddToPlaylistModal";
import { useUser } from "@/context/UserContext.jsx";
import { usePlaylistContext, getEpisodesBatch } from "@/context/PlaylistContext.jsx";
import { useAuthModal } from "@/context/AuthModalContext.jsx";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { FREE_FAVORITE_LIMIT } from "@/lib/freeTier";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

// Same human-friendly runtime formatter used on the Playlist detail
// page. Centralizing the format here keeps the card and the hero in
// visual lockstep ("1h 12m" everywhere, never "73m" on one and
// something else on the other).
function formatRuntime(approxMinutes) {
  if (typeof approxMinutes !== 'number' || !Number.isFinite(approxMinutes) || approxMinutes <= 0) return '';
  const total = Math.round(approxMinutes);
  if (total < 60) return `${total}m`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}


export default function Library() {
  const location = useLocation();
  const isNative = Capacitor.isNativePlatform();
  const tabs = isNative
    ? ["Following", "Favorites", "Playlists", "Downloads", "History"]
    : ["Following", "Favorites", "Playlists", "History"];
  const queryTab = (() => {
    try {
      const params = new URLSearchParams(location.search);
      const raw = params.get('tab');
      if (!raw) return null;
      const match = tabs.find(t => t.toLowerCase() === raw.toLowerCase());
      return match || null;
    } catch { return null; }
  })();
  const [activeTab, setActiveTab] = useState(queryTab || "Following");

  // Persist the active tab in the URL query string. Doing this with
  // `replace: true` means:
  //   • a hard refresh on /Library?tab=Favorites lands back on the
  //     Favorites tab instead of bouncing to Following,
  //   • navigating away to a podcast / episode and hitting Back
  //     restores the tab the listener was on (because the URL in
  //     history holds the tab),
  //   • the URL stays shareable / linkable (so a notification or
  //     external email can deep-link straight into one tab).
  // `replace` keeps every tab switch out of the back-button stack —
  // the listener pressing Back from "History" should leave the
  // Library entirely, not cycle through every tab they touched.
  useEffect(() => {
    try {
      const params = new URLSearchParams(location.search);
      const current = params.get('tab');
      if ((current || '').toLowerCase() === activeTab.toLowerCase()) return;
      params.set('tab', activeTab);
      const next = `${location.pathname}?${params.toString()}${location.hash || ''}`;
      window.history.replaceState(window.history.state, '', next);
    } catch { /* ignore */ }
    // We deliberately depend only on `activeTab` here — re-syncing
    // on every `location` change would fight tab clicks that are
    // about to write to the URL themselves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);
  const [podcasts, setPodcasts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showExpandedPlayer, setShowExpandedPlayer] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [playlistToRename, setPlaylistToRename] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [playlistToDelete, setPlaylistToDelete] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [episodeToAdd, setEpisodeToAdd] = useState(null);
  const [historyEpisodes, setHistoryEpisodes] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);

  const { isAuthenticated, isPremium, favoritePodcasts, favoriteEpisodes, favoritesLoading, favoriteEpisodeIds } = useUser();
  const { playlists, isLoadingPlaylists, addPlaylist, updatePlaylist, removePlaylist } = usePlaylistContext();
  const { openAuth } = useAuthModal();
  const navigate = useNavigate();

  const {
    episode: currentEpisode,
    podcast: currentPodcast,
    isPlaying,
    currentTime,
    duration,
    loadAndPlay,
    toggle,
    seek,
    skip,
    pause,
    setPlaybackQueue,
  } = useAudioPlayerContext();

  useEffect(() => {
    const loadPodcasts = async () => {
      setIsLoading(true);
      try {
        const resp = await Podcast.list("-created_date");
        const allPodcasts = Array.isArray(resp) ? resp : (resp?.results || []);
        setPodcasts(allPodcasts);
      } catch (e) {
        if (typeof console !== 'undefined') console.debug('Failed to load podcasts for library', e);
      } finally {
        setIsLoading(false);
      }
    };
    loadPodcasts();
  }, []);

  const loadHistory = useCallback(async () => {
    setIsLoadingHistory(true);
    try {
      const resp = await UserLibrary.getHistory(100);
      const raw = Array.isArray(resp) ? resp : (resp?.results || []);
      // Each history entry has `episode_detail` with nested podcast data,
      // plus `last_played`, `progress`, `duration`, `completed` etc at the top level.
      const list = raw
        .map((item) => {
          if (!item?.episode_detail) return null;
          // Attach history metadata onto the episode object so the UI can use it
          return {
            ...item.episode_detail,
            _history_last_played: item.last_played,
            _history_progress: item.progress,
            _history_duration: item.duration,
            _history_completed: item.completed,
            _history_percent: item.percent_complete,
          };
        })
        .filter(Boolean);
      const seen = new Set();
      const unique = [];
      for (const ep of list) {
        const id = ep?.id || ep?.slug;
        if (!id || seen.has(id)) continue;
        seen.add(id);
        unique.push(ep);
      }
      // Explicit-language shows remain visible in history. Playback is
      // gated elsewhere via the explicit-language modal.
      setHistoryEpisodes(unique);
    } catch (e) {
      if (typeof console !== 'undefined') console.debug('Failed to load history', e);
      setHistoryEpisodes([]);
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  // Load history on mount
  useEffect(() => { loadHistory(); }, [loadHistory]);

  async function handlePlayPlaylist(pl) {
    try {
      if (!pl || !Array.isArray(pl.episodes) || pl.episodes.length === 0) return;
      // Parallel batch fetch — episodes already seen on the Playlist
      // detail page or in another card cover return from cache, so
      // hitting Play on the Library card after viewing the playlist
      // is essentially instant.
      const fetched = await getEpisodesBatch(pl.episodes);
      const eps = fetched.filter(Boolean);
      if (!eps.length) return;
      const getArt = (ep) => ep?.image_url || ep?.artwork || ep?.cover_image || ep?.podcast?.cover_image || null;
      const pseudoPodcast = {
        id: `playlist-${pl.id}`,
        title: pl.name,
        cover_image: getArt(eps[0]) || null,
      };
      const queueItems = eps.map(ep => ({
        podcast: { ...pseudoPodcast, cover_image: getArt(ep) || pseudoPodcast.cover_image },
        episode: ep,
        resume: { progress: 0 },
      }));
      await setPlaybackQueue(queueItems, 0);
    } catch {
      // swallow
    }
  }

  const handlePodcastPlay = async (podcast) => {
    try {
      let episodes = podcast.episodes;
      if (!episodes || episodes.length === 0) {
        const detail = await Podcast.get(podcast.id);
        episodes = detail.episodes || [];
      }
      let resume;
      try { resume = await UserLibrary.resumeForPodcast(podcast.id); } catch { resume = undefined; }
      const resumeEp = resume?.episode_detail;
      let ep;
      if (resumeEp) {
        const found = episodes.find(e => e.id === resumeEp.id);
        ep = found ? { ...found, ...resumeEp } : resumeEp;
      } else {
        ep = episodes[0];
      }
      if (!ep) return;
      const args = resume ? { podcast, episode: ep, resume } : { podcast, episode: ep };
      await loadAndPlay(args);
    } catch (err) {
      console.error('Failed to start playback:', err);
    }
  };

  const handleCloseMobilePlayer = () => { pause(); };
  const handleCollapsePlayer = () => setShowExpandedPlayer(false);

  const handleRenamePlaylist = (pl) => {
    setPlaylistToRename(pl);
    setShowRenameModal(true);
  };

  const handleDeletePlaylist = async (pl) => {
    setPlaylistToDelete(pl);
    setShowDeleteModal(true);
  };

  const handleOpenAddToPlaylist = async (item) => {
    if (!isAuthenticated) { openAuth('login'); return; }
    // Playlists are a premium feature
    if (!isPremium) { navigate(createPageUrl('Premium')); return; }
    let episode = item;
    if (item && Array.isArray(item.episodes)) {
      if (item.episodes.length > 0) {
        episode = item.episodes[0];
      } else if (item.id) {
        try {
          const detail = await Podcast.get(item.id);
          const eps = Array.isArray(detail?.episodes) ? detail.episodes : [];
          if (eps.length > 0) episode = eps[0];
        } catch { /* ignore */ }
      }
    }
    if (!episode || !episode.id) return;
    setEpisodeToAdd(episode);
    setShowAddModal(true);
  };

  const doPlayHistory = async (ep) => {
    if (!ep) return;
    try {
      const podcastObj = (ep.podcast && typeof ep.podcast === 'object')
        ? ep.podcast
        : (ep.podcast ? { id: ep.podcast } : null);
      await loadAndPlay({ podcast: podcastObj || { id: ep.podcast_id || `ep-${ep.id}`, title: ep.podcast_title || ep.title || 'Podcast' }, episode: ep });
      try { await UserLibrary.addToHistory(ep.id, 0); } catch { /* ignore */ }
    } catch (e) {
      if (typeof console !== 'undefined') console.debug('history play failed', e);
    }
  };

  const handlePlayFollowingEpisode = async (ep) => {
    if (!ep) return;
    try {
      const podcastObj = (ep.podcast && typeof ep.podcast === 'object')
        ? ep.podcast
        : (ep.podcast ? { id: ep.podcast } : null);
      await loadAndPlay({
        podcast: podcastObj || { id: ep.podcast_id || `ep-${ep.id}`, title: ep.podcast_title || ep.title || 'Podcast' },
        episode: ep,
      });
      try { await UserLibrary.addToHistory(ep.id, 0); } catch { /* ignore */ }
    } catch (e) {
      if (typeof console !== 'undefined') console.debug('following episode play failed', e);
    }
  };

  const renderFollowingTab = () => {
    return (
      <FollowingTab
        podcasts={podcasts}
        onAddToPlaylist={handleOpenAddToPlaylist}
        onPlayEpisode={handlePlayFollowingEpisode}
      />
    );
  };

  const renderFavoritesTab = () => {
    const favCount = (favoriteEpisodeIds && favoriteEpisodeIds.size) || 0;

    return (
      <>
        {!isPremium && (
          <div className="mb-4 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-between">
            <span className="text-sm text-zinc-400">
              {favCount} / {FREE_FAVORITE_LIMIT} favorites used
            </span>
            {favCount >= FREE_FAVORITE_LIMIT && (
              <Button
                size="sm"
                onClick={() => navigate(createPageUrl('Premium'))}
                className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white text-xs px-4 py-1 rounded-full"
              >
                Upgrade for Unlimited
              </Button>
            )}
          </div>
        )}
        <FavoritesTab
          favoriteEpisodes={favoriteEpisodes}
          isLoading={favoritesLoading}
          onPlayEpisode={handlePlayFollowingEpisode}
          onAddToPlaylist={handleOpenAddToPlaylist}
        />
      </>
    );
  };

  // ── Playlist card cover: 2×2 mosaic from first 4 episode images ──
  //
  // Uses `getEpisodesBatch` from PlaylistContext, which:
  //   • parallelizes the up-to-4 `Episode.get` calls (was sequential)
  //   • shares a module-scoped cache with the Playlist detail page,
  //     so coming back to Library after viewing one of these
  //     playlists shows the mosaic instantly instead of refetching
  //     each tile one-by-one.
  function PlaylistCardCover({ episodeIds = [] }) {
    const [images, setImages] = useState([]);
    useEffect(() => {
      let mounted = true;
      const ids = episodeIds.slice(0, 4);
      if (!ids.length) { setImages([]); return; }
      (async () => {
        const fetched = await getEpisodesBatch(ids);
        const imgs = fetched
          .map((ep) => ep?.image_url || ep?.artwork || ep?.cover_image || ep?.podcast?.cover_image || null)
          .filter(Boolean)
          .slice(0, 4);
        if (mounted) setImages(imgs);
      })();
      return () => { mounted = false; };
    }, [episodeIds.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

    // Empty: gradient placeholder
    if (images.length === 0) {
      return (
        <div className="w-full aspect-square rounded-xl bg-gradient-to-br from-violet-900/30 via-zinc-900 to-red-900/20 flex items-center justify-center">
          <Headphones className="w-10 h-10 text-white/10" />
        </div>
      );
    }

    // Single image: full cover
    if (images.length === 1) {
      return (
        <div className="w-full aspect-square rounded-xl overflow-hidden">
          <img src={images[0]} alt="" className="w-full h-full object-cover" />
        </div>
      );
    }

    // 2–3 images: 2×2 grid with gradient fill for empty slots
    // 4 images: full 2×2 grid
    const slots = [images[0], images[1], images[2] || null, images[3] || null];
    return (
      <div className="w-full aspect-square rounded-xl overflow-hidden grid grid-cols-2 grid-rows-2 gap-[2px] bg-black/40">
        {slots.map((src, i) =>
          src ? (
            <img key={i} src={src} alt="" className="w-full h-full object-cover" />
          ) : (
            <div key={i} className="w-full h-full bg-gradient-to-br from-zinc-800/80 to-zinc-900" />
          )
        )}
      </div>
    );
  }

  const renderPlaylistsTab = () => {
    if (isLoadingPlaylists) {
      return (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="aspect-square bg-white/[0.03] rounded-xl animate-pulse" />
          ))}
        </div>
      );
    }

    if (!isPremium) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[300px] text-center">
          <p className="text-zinc-500 mb-4">Playlists are a premium feature.</p>
          <Button onClick={() => navigate(createPageUrl('Premium'))} className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white px-6 py-2 rounded-full flex items-center gap-2 shadow-[0_4px_16px_rgba(220,38,38,0.2)]">
            Become a Member
          </Button>
        </div>
      );
    }

    if (!playlists || playlists.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[300px] text-center">
          <p className="text-zinc-500 mb-4">You don&apos;t have any playlists yet.</p>
          <Button onClick={() => setShowCreateModal(true)} className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white px-6 py-2 rounded-full flex items-center gap-2 shadow-[0_4px_16px_rgba(220,38,38,0.2)]">
            <Plus className="w-4 h-4" />
            Create Playlist
          </Button>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
        {playlists.map((pl, i) => {
          const episodeCount = Array.isArray(pl.episodes) ? pl.episodes.length : 0;
          const approx = pl.approximate_length_minutes;
          const runtime = formatRuntime(approx);
          return (
            <motion.div
              key={pl.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              // Lightweight stagger across the grid so the Playlists
              // tab feels alive when it mounts. Capped at 8 cards
              // (320ms) so a heavy library never feels like it's
              // animating forever.
              transition={{ duration: 0.28, delay: Math.min(i, 8) * 0.04, ease: 'easeOut' }}
              className="group cursor-pointer"
              onClick={() => navigate(`/Playlist?id=${encodeURIComponent(pl.id)}`)}
            >
              {/* Cover mosaic — square */}
              <div className="relative">
                <PlaylistCardCover episodeIds={Array.isArray(pl.episodes) ? pl.episodes : []} />

                {/* Always-visible Play button (touch-friendly).
                    Subtler in idle, brighter on hover/press. The
                    previous design hid it behind `group-hover` which
                    made the affordance invisible on every mobile and
                    tablet device. */}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handlePlayPlaylist(pl); }}
                  aria-label={`Play ${pl.name}`}
                  className="absolute bottom-2.5 right-2.5 w-11 h-11 rounded-full bg-violet-600 hover:bg-violet-500 active:bg-violet-700 flex items-center justify-center shadow-lg shadow-violet-900/50 ring-1 ring-violet-400/30 backdrop-blur-sm transition-all duration-300 hover:scale-105 hover:-translate-y-0.5 opacity-90 group-hover:opacity-100"
                >
                  <Play className="w-5 h-5 fill-white text-white ml-0.5" />
                </button>

                {/* Kebab — Rename / Delete. Replaces the noisy inline
                    text buttons that ate two extra lines of every
                    card. */}
                <div className="absolute top-2 right-2" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        aria-label="Playlist options"
                        className="w-8 h-8 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur-sm flex items-center justify-center text-zinc-200 hover:text-white ring-1 ring-white/[0.08] transition-all duration-200 opacity-80 hover:opacity-100"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-[#18181f] border-white/[0.08] text-zinc-300">
                      <DropdownMenuItem
                        onClick={() => handleRenamePlaylist(pl)}
                        className="cursor-pointer focus:bg-white/[0.06] focus:text-white"
                      >
                        <Edit className="w-4 h-4 mr-2" /> Rename
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="bg-white/[0.06]" />
                      <DropdownMenuItem
                        onClick={() => handleDeletePlaylist(pl)}
                        className="cursor-pointer text-red-400 focus:bg-red-500/10 focus:text-red-300"
                      >
                        <Trash2 className="w-4 h-4 mr-2" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {/* Info row — count + runtime. The `key` on the meta
                  block makes Framer remount it when the runtime
                  flips, so adding/removing an episode produces a
                  subtle confirming flash instead of a silent number
                  swap. */}
              <div className="mt-3">
                <h3 className="text-white font-semibold text-sm leading-tight truncate group-hover:text-violet-200 transition-colors">
                  {pl.name}
                </h3>
                <motion.p
                  key={`${episodeCount}-${approx}`}
                  initial={{ opacity: 0.6 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.25 }}
                  className="text-zinc-500 text-xs mt-1 truncate"
                >
                  {episodeCount} {episodeCount === 1 ? 'episode' : 'episodes'}
                  {runtime ? ` · ${runtime}` : ''}
                </motion.p>
              </div>
            </motion.div>
          );
        })}

        {/* Create new playlist card */}
        <div
          onClick={() => setShowCreateModal(true)}
          className="cursor-pointer group"
        >
          <div className="w-full aspect-square rounded-xl border-2 border-dashed border-white/[0.06] hover:border-violet-500/40 flex flex-col items-center justify-center transition-all duration-300 hover:bg-violet-500/[0.04]">
            <Plus className="w-8 h-8 text-zinc-600 group-hover:text-violet-400 transition-colors mb-2" />
            <span className="text-zinc-600 group-hover:text-violet-400 text-xs transition-colors">New Playlist</span>
          </div>
        </div>
      </div>
    );
  };

  const renderDownloadsTab = () => {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <div className="w-16 h-16 rounded-full bg-eeriecast-surface-lighter flex items-center justify-center mb-6 ring-1 ring-white/[0.06]">
          <Download className="w-8 h-8 text-zinc-500" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">No Downloads Yet</h2>
        <p className="text-zinc-500 mb-6">Download episodes for offline listening.</p>
        <Button
          onClick={() => navigate('/Discover?tab=trending')}
          className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white px-6 py-2 rounded-full flex items-center gap-2 shadow-[0_4px_16px_rgba(220,38,38,0.2)]"
        >
          Browse Episodes
        </Button>
      </div>
    );
  };

  const renderHistoryTab = () => {
    return (
      <HistoryTab
        historyEpisodes={historyEpisodes}
        isLoading={isLoadingHistory}
        onPlayEpisode={doPlayHistory}
        onAddToPlaylist={handleOpenAddToPlaylist}
      />
    );
  };

  const renderContent = () => {
    // Only block Following and Favorites behind the podcast list loading
    // History, Playlists, and Downloads have their own independent loading states
    const needsPodcasts = activeTab === 'Following' || activeTab === 'Favorites';
    if (isLoading && needsPodcasts) {
      return (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 bg-eeriecast-surface-light/50 rounded-xl animate-pulse" />
          ))}
        </div>
      );
    }

    switch (activeTab) {
      case "Following": return renderFollowingTab();
      case "Favorites": return renderFavoritesTab();
      case "Playlists": return renderPlaylistsTab();
      case "Downloads": return renderDownloadsTab();
      case "History": return renderHistoryTab();
      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-eeriecast-surface text-white">
      <div className="px-2.5 lg:px-10 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl md:text-5xl font-bold mb-2 text-white">Library</h1>
          <p className="text-zinc-500 text-lg">Your collection, all in one place</p>
        </div>

        {/* Tabs — underline style matching Discover */}
        <div className="mb-8 border-b border-white/[0.06]">
          <div className="flex space-x-4 sm:space-x-8 overflow-x-auto pb-px" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {tabs.map((t) => (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                className={`flex-shrink-0 pb-3 text-sm font-medium transition-all duration-300 border-b-2 ${
                  activeTab === t
                    ? 'text-white border-white'
                    : 'text-zinc-500 hover:text-white border-transparent'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {renderContent()}
      </div>

      <AnimatePresence>
        {showExpandedPlayer && currentPodcast && currentEpisode && (
          <motion.div
            key="library-expanded-player"
            initial={{ opacity: 0, y: '100%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            style={{ position: 'fixed', inset: 0, zIndex: 3000 }}
          >
            <ExpandedPlayer
              podcast={currentPodcast}
              episode={currentEpisode}
              isPlaying={isPlaying}
              currentTime={currentTime}
              duration={duration}
              onToggle={toggle}
              onCollapse={handleCollapsePlayer}
              onClose={handleCloseMobilePlayer}
              onSeek={seek}
              onSkip={skip}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <PlaylistCreateModal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} onCreated={(pl) => addPlaylist(pl)} />
      <PlaylistRenameModal isOpen={showRenameModal} onClose={() => setShowRenameModal(false)} playlist={playlistToRename} onRenamed={(pl) => updatePlaylist(pl)} />
      <PlaylistDeleteModal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)} playlist={playlistToDelete} onDeleted={(pl) => removePlaylist(pl.id)} />
      <AddToPlaylistModal isOpen={showAddModal} episode={episodeToAdd} playlists={playlists} onClose={() => { setShowAddModal(false); setEpisodeToAdd(null); }} onAdded={({ playlist: pl, action }) => { if (action === 'created') addPlaylist(pl); if (action === 'updated') updatePlaylist(pl); }} />
    </div>
  );
}
