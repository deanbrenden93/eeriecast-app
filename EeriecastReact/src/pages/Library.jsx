import { useState, useMemo, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { Podcast, UserLibrary, Episode } from "@/api/entities";
import { Button } from "@/components/ui/button";
import { Play, Edit, Plus, Download, Trash2, Headphones, Smartphone } from "lucide-react";
import { useEpisodeBatch, useListeningHistory } from "@/hooks/useQueries";
import { usePodcasts } from "@/context/PodcastContext.jsx";
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
import { usePlaylistContext } from "@/context/PlaylistContext.jsx";
import { useAuthModal } from "@/context/AuthModalContext.jsx";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { FREE_FAVORITE_LIMIT } from "@/lib/freeTier";


// ── Playlist card cover: 2x2 mosaic from first 4 episode images ──
// Uses TanStack Query's useEpisodeBatch for parallel, deduplicated fetches.
function PlaylistCardCover({ episodeIds = [] }) {
  const ids = useMemo(() => episodeIds.slice(0, 4), [episodeIds]);
  const results = useEpisodeBatch(ids);

  // Stabilize: useQueries returns a new array ref every render
  const dataKey = results.map(r => r.dataUpdatedAt ?? 0).join(',');
  const images = useMemo(() => {
    const imgs = [];
    for (const r of results) {
      if (!r.data) continue;
      const ep = r.data;
      const art = ep?.image_url || ep?.artwork || ep?.cover_image || ep?.podcast?.cover_image || null;
      if (art) imgs.push(art);
      if (imgs.length >= 4) break;
    }
    return imgs;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataKey]);

  if (images.length === 0) {
    return (
      <div className="w-full aspect-square rounded-xl bg-gradient-to-br from-violet-900/30 via-zinc-900 to-red-900/20 flex items-center justify-center">
        <Headphones className="w-10 h-10 text-white/10" />
      </div>
    );
  }

  if (images.length === 1) {
    return (
      <div className="w-full aspect-square rounded-xl overflow-hidden">
        <img src={images[0]} alt="" className="w-full h-full object-cover" loading="lazy" />
      </div>
    );
  }

  const slots = [images[0], images[1], images[2] || null, images[3] || null];
  return (
    <div className="w-full aspect-square rounded-xl overflow-hidden grid grid-cols-2 grid-rows-2 gap-[2px] bg-black/40">
      {slots.map((src, i) =>
        src ? (
          <img key={i} src={src} alt="" className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div key={i} className="w-full h-full bg-gradient-to-br from-zinc-800/80 to-zinc-900" />
        )
      )}
    </div>
  );
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
  const [showExpandedPlayer, setShowExpandedPlayer] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [playlistToRename, setPlaylistToRename] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [playlistToDelete, setPlaylistToDelete] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [episodeToAdd, setEpisodeToAdd] = useState(null);

  const { isAuthenticated, isPremium, favoritePodcasts, favoriteEpisodes, favoritesLoading, favoriteEpisodeIds } = useUser();
  const { podcasts: ctxPodcasts, isLoading: ctxPodcastsLoading } = usePodcasts();
  const podcasts = ctxPodcasts;
  const isLoading = ctxPodcastsLoading;
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

  // History via TanStack Query — cached and deduplicated
  const { data: rawHistoryData, isLoading: isLoadingHistory } = useListeningHistory(isAuthenticated);

  const historyEpisodes = useMemo(() => {
    const raw = Array.isArray(rawHistoryData) ? rawHistoryData : (rawHistoryData?.results || []);
    const list = raw
      .map((item) => {
        if (!item?.episode_detail) return null;
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
    return unique;
  }, [rawHistoryData]);

  async function handlePlayPlaylist(pl) {
    try {
      if (!pl || !Array.isArray(pl.episodes) || pl.episodes.length === 0) return;
      // Fetch all episodes to build a full queue
      const eps = [];
      for (const id of pl.episodes) {
        try {
          const ep = await Episode.get(id);
          if (ep) eps.push(ep);
        } catch { /* skip */ }
      }
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
        {playlists.map((pl) => {
          const episodeCount = Array.isArray(pl.episodes) ? pl.episodes.length : 0;
          const approx = pl.approximate_length_minutes;
          return (
            <div
              key={pl.id}
              className="group cursor-pointer"
              onClick={() => navigate(`/Playlist?id=${encodeURIComponent(pl.id)}`)}
            >
              {/* Cover mosaic — square */}
              <div className="relative">
                <PlaylistCardCover episodeIds={Array.isArray(pl.episodes) ? pl.episodes : []} />
                {/* Play overlay on hover */}
                <div className="absolute inset-0 rounded-xl bg-black/0 group-hover:bg-black/40 transition-all duration-300 flex items-center justify-center opacity-0 group-hover:opacity-100">
                  <button
                    onClick={(e) => { e.stopPropagation(); handlePlayPlaylist(pl); }}
                    className="w-12 h-12 rounded-full bg-red-600 hover:bg-red-500 flex items-center justify-center shadow-lg shadow-red-900/40 transition-transform duration-200 scale-90 group-hover:scale-100"
                  >
                    <Play className="w-5 h-5 fill-white text-white ml-0.5" />
                  </button>
                </div>
              </div>

              {/* Info + actions */}
              <div className="mt-3">
                <h3 className="text-white font-semibold text-sm leading-tight truncate group-hover:text-white/90 transition-colors">
                  {pl.name}
                </h3>
                <p className="text-zinc-500 text-xs mt-1">
                  {episodeCount} {episodeCount === 1 ? 'episode' : 'episodes'}
                  {typeof approx === 'number' ? ` · ${approx}m` : ''}
                </p>

                {/* Action buttons */}
                <div className="flex items-center gap-1.5 mt-2" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => handleRenamePlaylist(pl)}
                    className="text-zinc-500 hover:text-white text-[11px] px-2 py-1 rounded-md hover:bg-white/[0.06] transition-colors"
                  >
                    <Edit className="w-3 h-3 inline mr-1" />
                    Rename
                  </button>
                  <button
                    onClick={() => handleDeletePlaylist(pl)}
                    className="text-zinc-500 hover:text-red-400 text-[11px] px-2 py-1 rounded-md hover:bg-red-500/[0.08] transition-colors"
                  >
                    <Trash2 className="w-3 h-3 inline mr-1" />
                    Delete
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {/* Create new playlist card */}
        <div
          onClick={() => setShowCreateModal(true)}
          className="cursor-pointer group"
        >
          <div className="w-full aspect-square rounded-xl border-2 border-dashed border-white/[0.06] hover:border-red-500/30 flex flex-col items-center justify-center transition-all duration-300">
            <Plus className="w-8 h-8 text-zinc-600 group-hover:text-red-400 transition-colors mb-2" />
            <span className="text-zinc-600 group-hover:text-red-400 text-xs transition-colors">New Playlist</span>
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
