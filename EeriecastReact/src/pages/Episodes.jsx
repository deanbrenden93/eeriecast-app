import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Playlist, UserLibrary } from '@/api/entities';
import { Button } from '@/components/ui/button';
import { Play } from 'lucide-react';
import EpisodesTable from '@/components/podcasts/EpisodesTable';
import AddToPlaylistModal from '@/components/library/AddToPlaylistModal';
import { useAudioPlayerContext } from '@/context/AudioPlayerContext';
import { useUser } from '@/context/UserContext';
import { getPodcastCategoriesLower, isAudiobook } from '@/lib/utils';
import SubscribeModal from '@/components/auth/SubscribeModal';
import { usePodcasts } from '@/context/PodcastContext.jsx';
import { useAuthModal } from '@/context/AuthModalContext.jsx';

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

export default function Episodes() {
  const query = useQuery();
  const idParam = query.get('id') || query.get('podcast') || query.get('podcastId');

  const { ensureDetail } = usePodcasts();
  const [show, setShow] = useState(null);
  const [episodes, setEpisodes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sortOrder, setSortOrder] = useState('Newest');
  const [playlists, setPlaylists] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [episodeToAdd, setEpisodeToAdd] = useState(null);
  const [isFollowingLoading, setIsFollowingLoading] = useState(false);
  const [showSubscribeModal, setShowSubscribeModal] = useState(false);
  const [subscribeLabel, setSubscribeLabel] = useState('');

  const { loadAndPlay } = useAudioPlayerContext();
  const { followedPodcastIds, refreshFollowings, isAuthenticated, isPremium } = useUser();
  const { openAuth } = useAuthModal();

  // Check if current podcast is followed
  const isFollowing = useMemo(() => {
    if (!show?.id) return false;
    return followedPodcastIds.has(Number(show.id));
  }, [show?.id, followedPodcastIds]);

  useEffect(() => {
    let canceled = false;
    async function load() {
      if (!idParam) { setIsLoading(false); return; }
      setIsLoading(true);
      try {
        // Use shared context to fetch/merge detail only if needed
        const detail = await ensureDetail(idParam);
        if (canceled) return;
        setShow(detail);
        const list = Array.isArray(detail?.episodes) ? detail.episodes : (detail?.episodes?.results || []);
        setEpisodes(list);
      } finally {
        if (!canceled) setIsLoading(false);
      }
    }
    load();
    return () => { canceled = true; };
  }, [idParam, ensureDetail]);

  useEffect(() => {
    if (show && isAudiobook(show)) {
      setSortOrder('Oldest');
    }
  }, [show]);

  useEffect(() => {
    async function loadPlaylists() {
      try {
        const resp = await Playlist.list();
        const list = Array.isArray(resp) ? resp : (resp?.results || []);
        setPlaylists(list);
      } catch (e) {
        if (typeof console !== 'undefined') console.debug('playlists load failed', e);
        setPlaylists([]);
      }
    }
    loadPlaylists();
  }, []);

  const handleOpenAddToPlaylist = (ep) => {
    if (!isAuthenticated) { openAuth('login'); return; }
    setEpisodeToAdd(ep);
    setShowAddModal(true);
  };

  const handleFollowToggle = async () => {
    if (!show?.id) return;
    if (!isAuthenticated) { openAuth('login'); return; }

    setIsFollowingLoading(true);
    try {
      if (isFollowing) {
        await UserLibrary.unfollowPodcast(show.id);
      } else {
        await UserLibrary.followPodcast(show.id);
      }
      await refreshFollowings();
    } catch (e) {
      console.error('Failed to toggle follow', e);
    } finally {
      setIsFollowingLoading(false);
    }
  };

  const doPlay = async (ep) => {
    if (!ep) return;
    // Subscription gating: only for non-premium users
    if (show?.is_exclusive && !isPremium) {
      setSubscribeLabel(show?.title || show?.name || 'Members-only podcast');
      setShowSubscribeModal(true);
      return;
    }
    if (ep?.is_premium && !isPremium) {
      setSubscribeLabel(ep?.title || 'Premium episode');
      setShowSubscribeModal(true);
      return;
    }

    try {
      await loadAndPlay({ podcast: show, episode: ep });
      try { await UserLibrary.addToHistory(ep.id, 0); } catch (e) { if (typeof console !== 'undefined') console.debug('history add failed', e); }
    } catch (e) {
      console.error('Failed to play', e);
    }
  };

  const sortedEpisodes = useMemo(() => {
    const arr = [...episodes];
    const getDate = (e) => new Date(e.created_date || e.published_at || e.release_date || 0).getTime();
    if (sortOrder === 'Newest') arr.sort((a, b) => getDate(b) - getDate(a));
    else if (sortOrder === 'Oldest') arr.sort((a, b) => getDate(a) - getDate(b));
    return arr;
  }, [episodes, sortOrder]);

  const categories = useMemo(() => getPodcastCategoriesLower(show || {}).slice(0, 6), [show]);
  const totalEpisodes = show?.episode_count || show?.episodes_count || show?.total_episodes || episodes?.length || 0;

  if (isLoading) {
    return <div className="min-h-screen bg-black text-white"><div className="h-[60vh] w-full bg-gray-900/50" /><div className="px-2.5 lg:px-10 py-8"><div className="h-80 w-full bg-gray-900/50 rounded-lg" /></div></div>;
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="relative pt-14 md:pt-16 pb-8 md:pb-12 px-2.5 lg:px-10">
        <div className="absolute inset-0 bg-no-repeat bg-cover bg-center opacity-10 pointer-events-none" style={{ backgroundImage: show?.cover_image ? `url(${show.cover_image})` : 'none' }} />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-transparent" />
        <div className="relative flex flex-col md:flex-row items-start md:items-end gap-4 md:gap-8">
          <div className="w-28 h-28 sm:w-36 sm:h-36 md:w-48 md:h-48 rounded-lg overflow-hidden shadow-2xl flex-shrink-0 bg-gray-800">
            {show?.cover_image ? (
              <img src={show.cover_image} alt={show?.title || show?.name || 'Cover'} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">🎧</div>
            )}
          </div>
          <div className="flex-1">
            <h1 className="text-2xl sm:text-3xl md:text-5xl font-bold mb-2">{show?.title || show?.name || 'Podcast'}</h1>
            <p className="text-gray-300 mb-3">
              Episodes from {show?.title || show?.name}
              {totalEpisodes ? (
                <span className="text-gray-500 ml-2">{Math.min(sortedEpisodes.length, totalEpisodes)} of {totalEpisodes} episodes</span>
              ) : null}
            </p>
            <div className="flex flex-wrap gap-2 text-xs sm:text-sm text-gray-300 mb-4 md:mb-6">
              {categories.map((c) => (
                <span key={c} className="bg-gray-800/60 px-2 py-1 rounded capitalize">{c}</span>
              ))}
            </div>
          </div>
          <div className="flex w-full md:w-auto flex-col sm:flex-row gap-2 sm:gap-3 mt-2 md:mt-0">
            <Button className="w-full sm:w-auto bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white px-6 py-2 rounded-full flex items-center justify-center gap-2" onClick={() => doPlay(sortedEpisodes[0])}>
              <Play className="w-4 h-4 fill-white" />
              Play
            </Button>
            <Button
              variant="outline"
              className={`w-full sm:w-auto bg-transparent border-gray-600 hover:bg-gray-800 px-6 py-2 rounded-full ${
                isFollowing ? 'text-purple-400 border-purple-400' : 'text-white'
              }`}
              onClick={handleFollowToggle}
              disabled={isFollowingLoading}
            >
              {isFollowing ? 'Following' : 'Follow'}
            </Button>
            {/*<Button variant="outline" className="bg-transparent border-gray-600 text-white hover:bg-gray-800 hover:text-white px-6 py-2 rounded-full">Share</Button>*/}
          </div>
        </div>
      </div>

      <div className="px-2.5 lg:px-10 pt-6 pb-28 md:pt-8 md:pb-8">
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-3 md:gap-0 mb-4 md:mb-6">
          <h2 className="text-2xl md:text-3xl font-bold">Episodes</h2>
          <div className="flex flex-wrap gap-2">
            {['Newest', 'Oldest', 'Popular'].map(order => (
              <Button key={order} variant="ghost" onClick={() => setSortOrder(order)} className={`rounded-full px-4 py-2 ${sortOrder === order ? 'bg-gray-700 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}>
                {order}
              </Button>
            ))}
          </div>
        </div>

        <EpisodesTable episodes={sortedEpisodes} show={show} onPlay={doPlay} onAddToPlaylist={handleOpenAddToPlaylist} />
      </div>

      <AddToPlaylistModal
        isOpen={showAddModal}
        episode={episodeToAdd}
        playlists={playlists}
        onClose={() => { setShowAddModal(false); setEpisodeToAdd(null); }}
        onAdded={({ playlist: pl, action }) => {
          if (action === 'created') setPlaylists(prev => [pl, ...prev]);
          if (action === 'updated') setPlaylists(prev => prev.map(p => p.id === pl.id ? pl : p));
        }}
      />

      {/* Subscribe / Premium gating modal */}
      <SubscribeModal
        open={showSubscribeModal}
        onOpenChange={setShowSubscribeModal}
        itemLabel={subscribeLabel}
        title="Subscribe to listen"
        message="This content is available to members only. Subscribe to unlock all premium shows and episodes."
      />
    </div>
  );
}
