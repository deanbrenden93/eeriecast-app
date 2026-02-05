import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Playlist as PlaylistApi, Episode } from '@/api/entities';
import { Button } from '@/components/ui/button';
import { Play } from 'lucide-react';
import EpisodesTable from '@/components/podcasts/EpisodesTable';
import { useAudioPlayerContext } from '@/context/AudioPlayerContext';
import { useUser } from '@/context/UserContext.jsx';
import { useAuthModal } from '@/context/AuthModalContext.jsx';

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

export default function Playlist() {
  const query = useQuery();
  const idParam = query.get('id');
  const navigate = useNavigate();

  const [playlist, setPlaylist] = useState(null);
  const [episodes, setEpisodes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false); // keep but unused, minimal change
  const [episodeToAdd, setEpisodeToAdd] = useState(null); // unused
  const [removingEpisodeId, setRemovingEpisodeId] = useState(null);

  const { loadAndPlay } = useAudioPlayerContext();
  const { isAuthenticated, removeEpisodeFromPlaylist } = useUser();
  const { openAuth } = useAuthModal();

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

        // Fetch episodes sequentially to preserve order (playlist order)
        const eps = [];
        for (const id of ids) {
          try {
            const ep = await Episode.get(id);
            if (ep) eps.push(ep);
          } catch {
            // skip failures
          }
        }
        if (!canceled) setEpisodes(eps);
      } finally {
        if (!canceled) setIsLoading(false);
      }
    }
    load();
    return () => { canceled = true; };
  }, [idParam]);

  const doPlay = async (ep) => {
    if (!ep) return;
    try {
      // For playlists, we build a pseudo podcast context from the playlist
      const pseudoPodcast = {
        id: `playlist-${playlist?.id}`,
        title: playlist?.name || playlist?.title || 'Playlist',
        cover_image: ep?.cover_image || ep?.podcast?.cover_image || null,
      };
      await loadAndPlay({ podcast: pseudoPodcast, episode: ep });
    } catch (e) {
      if (typeof console !== 'undefined') console.debug('playlist play failed', e);
    }
  };

  const handleRemoveFromPlaylist = async (ep) => {
    if (!ep?.id) return;
    if (!isAuthenticated) { openAuth('login'); return; }
    if (!playlist?.id) return;
    // Prevent duplicate clicks
    if (removingEpisodeId === ep.id) return;
    setRemovingEpisodeId(ep.id);
    const ok = await removeEpisodeFromPlaylist(playlist.id, ep.id);
    if (ok) {
      setEpisodes(prev => prev.filter(e => e.id !== ep.id));
      setPlaylist(p => ({ ...p, episodes: (Array.isArray(p?.episodes) ? p.episodes.filter(id => id !== ep.id) : []) }));
    }
    setRemovingEpisodeId(null);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black text-white">
        <div className="h-[60vh] w-full bg-gray-900/50" />
        <div className="px-2.5 lg:px-10 py-8">
          <div className="h-80 w-full bg-gray-900/50 rounded-lg" />
        </div>
      </div>
    );
  }

  if (!playlist) {
    return (
      <div className="min-h-screen bg-black text-white">
        <div className="px-2.5 lg:px-10 py-8">
          <Button variant="ghost" className="mb-4" onClick={() => navigate(-1)}>Back</Button>
          <div className="text-gray-400">Playlist not found.</div>
        </div>
      </div>
    );
  }

  const episodeCount = (playlist?.episodes && playlist.episodes.length) || 0;
  const approx = playlist?.approximate_length_minutes;

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="relative pt-14 md:pt-16 pb-8 md:pb-12 px-2.5 lg:px-10">
        {/* Top header without podcast cover: show playlist info only */}
        <div className="relative flex flex-col md:flex-row items-start md:items-end gap-4 md:gap-8">
          <div className="w-28 h-28 sm:w-36 sm:h-36 md:w-48 md:h-48 rounded-lg overflow-hidden shadow-2xl flex-shrink-0 bg-gray-800 flex items-center justify-center">
            <span className="text-white/80 text-sm">Playlist</span>
          </div>
          <div className="flex-1">
            <h1 className="text-2xl sm:text-3xl md:text-5xl font-bold mb-2">{playlist?.name || playlist?.title || 'Playlist'}</h1>
            <p className="text-gray-300 mb-3">
              {episodeCount} {episodeCount === 1 ? 'episode' : 'episodes'}
              {typeof approx === 'number' ? <span className="text-gray-500 ml-2">~{approx}m</span> : null}
            </p>
          </div>
          <div className="flex w-full md:w-auto flex-col sm:flex-row gap-2 sm:gap-3 mt-2 md:mt-0">
            <Button className="w-full sm:w-auto bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white px-6 py-2 rounded-full flex items-center justify-center gap-2" onClick={() => doPlay(episodes[0])} disabled={!episodes.length}>
              <Play className="w-4 h-4 fill-white" />
              Play
            </Button>
          </div>
        </div>
      </div>

      <div className="px-2.5 lg:px-10 pt-6 pb-28 md:pt-8 md:pb-8">
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-3 md:gap-0 mb-4 md:mb-6">
          <h2 className="text-2xl md:text-3xl font-bold">Episodes</h2>
        </div>

        <EpisodesTable episodes={episodes} onPlay={doPlay} onRemoveFromPlaylist={handleRemoveFromPlaylist} removingEpisodeId={removingEpisodeId} />
      </div>
    </div>
  );
}
