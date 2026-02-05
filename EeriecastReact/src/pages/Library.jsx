import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Podcast, UserLibrary, Playlist, Episode } from "@/api/entities";
import { Button } from "@/components/ui/button";
import { Play, Edit, Plus, Download, Trash2 } from "lucide-react";
import FavoritesTab from "../components/library/FavoritesTab";
import FollowingTab from "../components/library/FollowingTab";
import ExpandedPlayer from "../components/podcasts/ExpandedPlayer";
import { useAudioPlayerContext } from "@/context/AudioPlayerContext";
import PlaylistCreateModal from "../components/library/PlaylistCreateModal";
import PlaylistRenameModal from "../components/library/PlaylistRenameModal";
import PlaylistDeleteModal from "../components/library/PlaylistDeleteModal";
import AddToPlaylistModal from "@/components/library/AddToPlaylistModal";
import { useUser } from "@/context/UserContext.jsx";
import { useAuthModal } from "@/context/AuthModalContext.jsx";
import { useNavigate } from "react-router-dom";
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
  const [isLoading, setIsLoading]     = useState(true);
  const [showExpandedPlayer, setShowExpandedPlayer] = useState(false);
  const [playlists, setPlaylists] = useState([]);
  const [isLoadingPlaylists, setIsLoadingPlaylists] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [playlistToRename, setPlaylistToRename] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [playlistToDelete, setPlaylistToDelete] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [episodeToAdd, setEpisodeToAdd] = useState(null);
  const [historyEpisodes, setHistoryEpisodes] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);

  const { isAuthenticated, favoritePodcasts, favoritesLoading, favoriteEpisodeIds } = useUser();
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
      const resp = await Podcast.list("-created_date");
      const allPodcasts = Array.isArray(resp) ? resp : (resp?.results || []);
      setPodcasts(allPodcasts);
      setIsLoading(false);
    };
    loadPodcasts();
  }, []);

  useEffect(() => {
    const loadPlaylists = async () => {
      setIsLoadingPlaylists(true);
      try {
        const resp = await Playlist.list();
        const list = Array.isArray(resp) ? resp : (resp?.results || []);
        setPlaylists(list);
      } catch (e) {
        console.error('Failed to load playlists', e);
        setPlaylists([]);
      } finally {
        setIsLoadingPlaylists(false);
      }
    };
    loadPlaylists();
  }, []);

  // Load listening history and normalize to episodes list
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIsLoadingHistory(true);
      try {
        const resp = await UserLibrary.getHistory();
        const raw = Array.isArray(resp) ? resp : (resp?.results || []);
        // Map to episode_detail only; filter invalid; newest first assumed
        const list = raw
          .map((item) => (item && item.episode_detail) ? item.episode_detail : null)
          .filter(Boolean);
        // Dedupe by episode id while preserving order
        const seen = new Set();
        const unique = [];
        for (const ep of list) {
          const id = ep?.id || ep?.slug;
          if (!id || seen.has(id)) continue;
          seen.add(id);
          unique.push(ep);
        }
        if (!cancelled) setHistoryEpisodes(unique);
      } catch (e) {
        if (!cancelled) setHistoryEpisodes([]);
      } finally {
        if (!cancelled) setIsLoadingHistory(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  async function handlePlayPlaylist(pl) {
    try {
      if (!pl || !Array.isArray(pl.episodes) || pl.episodes.length === 0) return;
      const ep = await Episode.get(pl.episodes[0]);
      if (!ep) return;
      const pseudoPodcast = {
        id: `playlist-${pl.id}`,
        title: pl.name,
        cover_image: ep.cover_image || null,
      };
      await loadAndPlay({ podcast: pseudoPodcast, episode: ep });
    } catch {
      // swallow playlist play errors
    }
  }

  const handlePodcastPlay = async (podcast) => {
    try {
      // Ensure we have episodes: use embedded, or fetch detail
      let episodes = podcast.episodes;
      if (!episodes || episodes.length === 0) {
        const detail = await Podcast.get(podcast.id);
        episodes = detail.episodes || [];
      }

      // Try to resume for this podcast
      let resume;
      try {
        resume = await UserLibrary.resumeForPodcast(podcast.id);
      } catch {
        resume = undefined; // no resume available
      }

      // Choose episode
      const resumeEp = resume?.episode_detail;
      let ep;
      if (resumeEp) {
        const found = episodes.find(e => e.id === resumeEp.id);
        ep = found ? { ...found, ...resumeEp } : resumeEp;
      } else {
        ep = episodes[0];
      }

      if (!ep) return;

      // Start playback using loadAndPlay which sets both podcast and episode
      const args = resume ? { podcast, episode: ep, resume } : { podcast, episode: ep };
      await loadAndPlay(args);
    } catch (err) {
      console.error('Failed to start playback:', err);
    }
  };

  const handleCloseMobilePlayer = () => {
    pause();
  };

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

    // If a podcast was passed from Favorites, resolve its first episode
    let episode = item;
    if (item && Array.isArray(item.episodes)) {
      if (item.episodes.length > 0) {
        episode = item.episodes[0];
      } else if (item.id) {
        try {
          const detail = await Podcast.get(item.id);
          const eps = Array.isArray(detail?.episodes) ? detail.episodes : [];
          if (eps.length > 0) episode = eps[0];
        } catch {
          // ignore podcast detail fetch failure
        }
      }
    }

    // Guard: ensure we have an episode-like object with an id
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
    // Build a Play All handler that enqueues favorited episodes (not full podcasts)
    const handlePlayAllFavorites = async () => {
      try {
        const ids = Array.from(favoriteEpisodeIds || new Set());
        if (!ids.length) return;

        // Fetch episode details (sequentially to keep order; could be parallelized if backend supports)
        const episodes = [];
        for (const id of ids) {
          try {
            const ep = await Episode.get(id);
            if (ep) episodes.push(ep);
          } catch {
            // skip failed episode fetch
          }
        }
        if (!episodes.length) return;

        // Collect unique podcast IDs and fetch details
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
          } catch {
            // skip failed podcast fetch
          }
        }

        // Sort episodes by published/created date desc for a sane order
        const toTs = (e) => new Date(e?.published_at || e?.created_date || e?.release_date || 0).getTime();
        episodes.sort((a, b) => toTs(b) - toTs(a));

        // Build queue items
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
      <FavoritesTab
        podcasts={podcasts}
        playlists={playlists}
        onAddToPlaylist={handleOpenAddToPlaylist}
        favoritesPodcasts={favoritePodcasts}
        isLoading={favoritesLoading}
        onPlayAllFavorites={handlePlayAllFavorites}
        playAllCount={playAllCount}
      />
    );
  };

  const renderPlaylistsTab = () => {
    if (isLoadingPlaylists) {
      return <div className="text-white text-center py-10">Loading playlists...</div>;
    }

    if (!playlists || playlists.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[300px] text-center">
          <p className="text-gray-400 mb-4">You don&apos;t have any playlists yet.</p>
          <Button onClick={() => setShowCreateModal(true)} className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-full flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Create Playlist
          </Button>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
        {playlists.map((pl) => {
          const episodeCount = Array.isArray(pl.episodes) ? pl.episodes.length : 0;
          const approx = pl.approximate_length_minutes;
          return (
            <div key={pl.id} className="rounded-xl overflow-hidden border border-neutral-800 bg-neutral-900/90 shadow-sm cursor-pointer"
                 onClick={() => navigate(`/Playlist?id=${encodeURIComponent(pl.id)}`)}>
              {/* Top cover band */}
              <div className="w-full h-28 bg-emerald-950 flex items-center justify-center">
                {/* Centered tile - no dynamic cover available yet */}
                <div className="w-20 h-20 rounded-lg overflow-hidden shadow-lg bg-gray-700 flex items-center justify-center">
                  <span className="text-white/80 text-xs">Playlist</span>
                </div>
              </div>

              {/* Bottom content panel */}
              <div className="p-4 bg-neutral-900">
                <h3 className="text-white font-semibold text-base leading-tight mb-1 truncate">{pl.name}</h3>
                <p className="text-gray-400 text-xs mb-3">
                  {episodeCount} {episodeCount === 1 ? 'episode' : 'episodes'}{typeof approx === 'number' ? ` • ~${approx}m` : ''}
                </p>

                {/* Actions row */}
                <div className="flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
                  <Button onClick={() => handlePlayPlaylist(pl)} className="gap-1.5 bg-neutral-100 text-black hover:bg-white/90 text-xs px-3 py-1.5 rounded-full">
                    <Play className="w-3 h-3" />
                    Play
                  </Button>
                  <Button onClick={() => handleRenamePlaylist(pl)} variant="secondary" className="gap-1.5 bg-neutral-800 hover:bg-neutral-700 text-white text-xs px-3 py-1.5 rounded-full">
                    <Edit className="w-3 h-3" />
                    Rename
                  </Button>
                  <Button onClick={() => handleDeletePlaylist(pl)} variant="secondary" className="gap-1.5 bg-neutral-800 hover:bg-neutral-700 text-white text-xs px-3 py-1.5 rounded-full">
                    <Trash2 className="w-3 h-3" />
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          );
        })}

        {/* Add new playlist card */}
        <button onClick={() => setShowCreateModal(true)} className="border-2 border-dashed border-gray-700/80 rounded-xl aspect-square flex flex-col items-center justify-center text-gray-400 hover:border-gray-500 cursor-pointer">
          <Plus className="w-8 h-8 mb-2" />
          <span className="text-xs">Create New Playlist</span>
        </button>
      </div>
    );
  };

  const renderDownloadsTab = () => {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <div className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center mb-6">
          <Download className="w-8 h-8 text-gray-400" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">No Downloads Yet</h2>
        <p className="text-gray-400 mb-6">Download episodes for offline listening.</p>
        <Button className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-full flex items-center gap-2">
          Browse Episodes
        </Button>
      </div>
    );
  };

  const renderHistoryTab = () => {
    if (isLoadingHistory) return <div className="text-white text-center py-10">Loading history…</div>;
    if (!historyEpisodes.length) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[240px] text-center text-gray-400">
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
    if (isLoading && activeTab !== 'Playlists') {
      return <div className="text-white text-center py-10">Loading content...</div>;
    }

    switch (activeTab) {
      case "Following":
        return renderFollowingTab();
      case "Favorites":
        return renderFavoritesTab();
      case "Playlists":
        return renderPlaylistsTab();
      case "Downloads":
        return renderDownloadsTab();
      case "History":
        return renderHistoryTab();
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="px-2.5 lg:px-10 py-8">
        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          {tabs.map((t) => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={`px-4 py-2 rounded-full text-sm ${activeTab === t ? 'bg-white text-black' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Content */}
        {renderContent()}
      </div>

      {/* Expanded Player */}
      {showExpandedPlayer && currentPodcast && currentEpisode && (
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
      )}

      {/* Modals */}
      <PlaylistCreateModal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} />
      <PlaylistRenameModal isOpen={showRenameModal} onClose={() => setShowRenameModal(false)} playlist={playlistToRename} />
      <PlaylistDeleteModal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)} playlist={playlistToDelete} />
      <AddToPlaylistModal isOpen={showAddModal} episode={episodeToAdd} playlists={playlists} onClose={() => { setShowAddModal(false); setEpisodeToAdd(null); }} onAdded={({ playlist: pl, action }) => { if (action === 'created') setPlaylists(prev => [pl, ...prev]); if (action === 'updated') setPlaylists(prev => prev.map(p => p.id === pl.id ? pl : p)); }} />
    </div>
  );
}
