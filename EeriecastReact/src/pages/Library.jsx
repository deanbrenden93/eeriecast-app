import { useState, useEffect, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { Podcast, UserLibrary, Episode } from "@/api/entities";
import { Button } from "@/components/ui/button";
import { Play, Edit, Plus, Download, Trash2, Headphones } from "lucide-react";
import FavoritesTab from "../components/library/FavoritesTab";
import FollowingTab from "../components/library/FollowingTab";
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
import EpisodesTable from "../components/podcasts/EpisodesTable";

export default function Library() {
  const location = useLocation();
  const tabs = ["Following", "Favorites", "Playlists", "Downloads", "History"];
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

  const { isAuthenticated, isPremium, favoritePodcasts, favoritesLoading, favoriteEpisodeIds } = useUser();
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

  const renderFollowingTab = () => {
    return <FollowingTab podcasts={podcasts} playlists={playlists} onAddToPlaylist={handleOpenAddToPlaylist} />;
  };

  const renderFavoritesTab = () => {
    const handlePlayAllFavorites = async () => {
      try {
        const ids = Array.from(favoriteEpisodeIds || new Set());
        if (!ids.length) return;
        const episodes = [];
        for (const id of ids) {
          try {
            const ep = await Episode.get(id);
            if (ep) episodes.push(ep);
          } catch { /* skip */ }
        }
        if (!episodes.length) return;
        const podcastIdFromEp = (ep) => {
          const p = ep?.podcast;
          if (!p) return null;
          if (typeof p === 'object') return Number(p.id || p.podcast || p.pk) || null;
          return Number(p);
        };
        const uniqPodcastIds = Array.from(new Set(episodes.map(podcastIdFromEp).filter(Boolean)));
        const podcastMap = new Map();
        for (const pid of uniqPodcastIds) {
          try {
            const p = await Podcast.get(pid);
            if (p) podcastMap.set(pid, p);
          } catch { /* skip */ }
        }
        const toTs = (e) => new Date(e?.published_at || e?.created_date || e?.release_date || 0).getTime();
        episodes.sort((a, b) => toTs(b) - toTs(a));
        const queueItems = episodes.map((ep) => {
          const pid = podcastIdFromEp(ep);
          const pDetail = (pid && podcastMap.get(pid)) || (typeof ep.podcast === 'object' ? ep.podcast : null) || null;
          const podcast = pDetail || { id: pid || `ep-${ep.id}`, title: ep?.podcast_title || ep?.title || 'Podcast' };
          return { podcast, episode: ep };
        });
        await setPlaybackQueue(queueItems, 0);
      } catch (e) {
        console.error('Failed to play all favorite episodes:', e);
      }
    };
    const playAllCount = (favoriteEpisodeIds && favoriteEpisodeIds.size) || 0;

    return (
      <>
        {!isPremium && (
          <div className="mb-4 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-between">
            <span className="text-sm text-zinc-400">
              {playAllCount} / {FREE_FAVORITE_LIMIT} favorites used
            </span>
            {playAllCount >= FREE_FAVORITE_LIMIT && (
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
          podcasts={podcasts}
          playlists={playlists}
          onAddToPlaylist={handleOpenAddToPlaylist}
          favoritesPodcasts={favoritePodcasts}
          isLoading={favoritesLoading}
          onPlayAllFavorites={handlePlayAllFavorites}
          playAllCount={playAllCount}
        />
      </>
    );
  };

  // ── Playlist card cover: fetches first 3 episode images for mosaic ──
  function PlaylistCardCover({ episodeIds = [] }) {
    const [images, setImages] = useState([]);
    useEffect(() => {
      let mounted = true;
      const ids = episodeIds.slice(0, 3);
      if (!ids.length) return;
      (async () => {
        const imgs = [];
        for (const id of ids) {
          try {
            const ep = await Episode.get(id);
            const art = ep?.image_url || ep?.artwork || ep?.cover_image || ep?.podcast?.cover_image || null;
            if (art) imgs.push(art);
          } catch { /* skip */ }
        }
        if (mounted) setImages(imgs);
      })();
      return () => { mounted = false; };
    }, [episodeIds.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

    if (images.length === 0) {
      return (
        <div className="w-full h-28 bg-gradient-to-br from-violet-900/20 to-eeriecast-deep-violet/20 flex items-center justify-center">
          <div className="w-20 h-20 rounded-lg overflow-hidden bg-eeriecast-surface-lighter flex items-center justify-center ring-1 ring-white/[0.06]">
            <Headphones className="w-6 h-6 text-violet-400/40" />
          </div>
        </div>
      );
    }

    if (images.length === 1) {
      return (
        <div className="w-full h-28 overflow-hidden">
          <img src={images[0]} alt="" className="w-full h-full object-cover" />
        </div>
      );
    }

    if (images.length === 2) {
      return (
        <div className="w-full h-28 grid grid-cols-2 overflow-hidden">
          <img src={images[0]} alt="" className="w-full h-full object-cover" />
          <img src={images[1]} alt="" className="w-full h-full object-cover" />
        </div>
      );
    }

    // 3 images: one large left, two stacked right
    return (
      <div className="w-full h-28 grid grid-cols-2 overflow-hidden">
        <img src={images[0]} alt="" className="w-full h-full object-cover" />
        <div className="flex flex-col h-full">
          <img src={images[1]} alt="" className="w-full flex-1 object-cover" />
          <img src={images[2]} alt="" className="w-full flex-1 object-cover" />
        </div>
      </div>
    );
  }

  const renderPlaylistsTab = () => {
    if (isLoadingPlaylists) {
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-48 bg-eeriecast-surface-light/50 rounded-xl animate-pulse" />
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
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {playlists.map((pl) => {
          const episodeCount = Array.isArray(pl.episodes) ? pl.episodes.length : 0;
          const approx = pl.approximate_length_minutes;
          return (
            <div key={pl.id} className="eeriecast-card overflow-hidden cursor-pointer"
                 onClick={() => navigate(`/Playlist?id=${encodeURIComponent(pl.id)}`)}>
              {/* Cover mosaic */}
              <PlaylistCardCover episodeIds={Array.isArray(pl.episodes) ? pl.episodes : []} />

              {/* Content */}
              <div className="p-4">
                <h3 className="text-white font-semibold text-base leading-tight mb-1 truncate">{pl.name}</h3>
                <p className="text-zinc-500 text-xs mb-3">
                  {episodeCount} {episodeCount === 1 ? 'episode' : 'episodes'}{typeof approx === 'number' ? ` · ~${approx}m` : ''}
                </p>

                <div className="flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
                  <Button onClick={() => handlePlayPlaylist(pl)} className="gap-1.5 bg-red-600 hover:bg-red-500 text-white text-xs px-3 py-1.5 rounded-full shadow-[0_2px_8px_rgba(220,38,38,0.2)]">
                    <Play className="w-3 h-3" />
                    Play
                  </Button>
                  <Button onClick={() => handleRenamePlaylist(pl)} variant="secondary" className="gap-1.5 bg-eeriecast-surface-lighter hover:bg-white/[0.06] text-white text-xs px-3 py-1.5 rounded-full border border-white/[0.06]">
                    <Edit className="w-3 h-3" />
                    Rename
                  </Button>
                  <Button onClick={() => handleDeletePlaylist(pl)} variant="secondary" className="gap-1.5 bg-eeriecast-surface-lighter hover:bg-white/[0.06] text-white text-xs px-3 py-1.5 rounded-full border border-white/[0.06]">
                    <Trash2 className="w-3 h-3" />
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          );
        })}

        <button onClick={() => setShowCreateModal(true)} className="border-2 border-dashed border-white/[0.08] hover:border-red-500/30 rounded-xl aspect-square flex flex-col items-center justify-center text-zinc-500 hover:text-red-400 cursor-pointer transition-all duration-300">
          <Plus className="w-8 h-8 mb-2" />
          <span className="text-xs">Create New Playlist</span>
        </button>
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
        <Button className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white px-6 py-2 rounded-full flex items-center gap-2 shadow-[0_4px_16px_rgba(220,38,38,0.2)]">
          Browse Episodes
        </Button>
      </div>
    );
  };

  const renderHistoryTab = () => {
    if (isLoadingHistory) return <div className="text-zinc-500 text-center py-10">Loading history...</div>;
    if (!historyEpisodes.length) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[240px] text-center text-zinc-500">
          No listening history yet.
        </div>
      );
    }
    return (
      <EpisodesTable
        episodes={historyEpisodes}
        show={null}
        onPlay={doPlayHistory}
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
