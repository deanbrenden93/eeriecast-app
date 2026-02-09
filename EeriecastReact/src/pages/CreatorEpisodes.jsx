import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Episode, Search as SearchApi } from '@/api/entities';
import { Button } from '@/components/ui/button';
import { Play } from 'lucide-react';
import EpisodesTable from '@/components/podcasts/EpisodesTable';
import AddToPlaylistModal from '@/components/library/AddToPlaylistModal';
import { useAudioPlayerContext } from '@/context/AudioPlayerContext';
import { getEpisodeAudioUrl } from '@/lib/utils';
import { useUser } from '@/context/UserContext.jsx';
import { usePlaylistContext } from '@/context/PlaylistContext.jsx';
import { useAuthModal } from '@/context/AuthModalContext.jsx';

export default function CreatorEpisodes() {
  const location = useLocation();
  const [author, setAuthor] = useState('');
  const [authorQuery, setAuthorQuery] = useState('');
  const [episodes, setEpisodes] = useState([]);
  const [creatorInfo, setCreatorInfo] = useState(null);
  const [creatorProfile, setCreatorProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sortOrder, setSortOrder] = useState('Newest');
  const [showAddModal, setShowAddModal] = useState(false);
  const [episodeToAdd, setEpisodeToAdd] = useState(null);

  // Helper to make the author human-readable (capitalize, replace separators)
  const humanizeAuthor = (raw) => {
    if (!raw) return '';
    const withSpaces = String(raw).replace(/\+/g, ' ').replace(/[-_]+/g, ' ');
    const lower = withSpaces.toLowerCase().trim();
    return lower.split(/\s+/).map(w => w ? w[0].toUpperCase() + w.slice(1) : '').join(' ');
  };

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const authorParam = params.get('author');
    if (authorParam) {
      // Preserve a raw query for API calls; produce a humanized display string
      const decoded = decodeURIComponent(authorParam);
      const raw = decoded.replace(/\+/g, ' ').trim();
      setAuthorQuery(raw);
      setAuthor(humanizeAuthor(raw));
    } else {
      setAuthor('');
      setAuthorQuery('');
    }
  }, [location.search]);

  useEffect(() => {
    if (!authorQuery) return;

    const loadEpisodes = async () => {
      setIsLoading(true);
      try {
        // Fetch episodes by raw author query; handle paginated or array responses
        const resp = await Episode.filter({ author: authorQuery }, '-created_date');
        const list = Array.isArray(resp) ? resp : (resp?.results || []);
        setEpisodes(Array.isArray(list) ? list : []);
        setCreatorInfo(list.length > 0 ? list[0] : null);
      } catch {
        setEpisodes([]);
        setCreatorInfo(null);
      } finally {
        setIsLoading(false);
      }
    };

    loadEpisodes();
  }, [authorQuery]);

  // Lookup creator profile to get correct avatar/cover image and canonical display name
  useEffect(() => {
    let canceled = false;
    async function loadCreatorProfile() {
      if (!authorQuery) { setCreatorProfile(null); return; }
      try {
        const resp = await SearchApi.searchCreators(authorQuery);
        const list = Array.isArray(resp) ? resp : (resp?.results || []);
        // Prefer case-insensitive exact match on display_name
        const match = list.find((c) => {
          const name = c?.display_name || c?.name || c?.username || '';
          return name && name.toLowerCase() === authorQuery.toLowerCase();
        }) || list[0] || null;
        if (!canceled) setCreatorProfile(match);
      } catch {
        if (!canceled) setCreatorProfile(null);
      }
    }
    loadCreatorProfile();
    return () => { canceled = true; };
  }, [authorQuery]);

  // hook into global audio player
  const { loadAndPlay } = useAudioPlayerContext();
  const { isAuthenticated } = useUser();
  const { playlists, addPlaylist, updatePlaylist } = usePlaylistContext();
  const { openAuth } = useAuthModal();

  // Prefer URL/display name for hero; then profile; then episode data
  const heroAuthor = author || creatorProfile?.display_name || creatorInfo?.podcast?.author || creatorInfo?.author || author;
  // Prefer creator profile avatar/cover_image; fallback to episode/podcast imagery
  const heroImage = creatorProfile?.avatar || creatorProfile?.cover_image || creatorInfo?.podcast?.cover_image || creatorInfo?.cover_image || '';

  const handlePlay = async (ep) => {
    try {
      if (!ep) return;
      // hydrate missing audio url if necessary
      let episodeToPlay = ep;
      try {
        if (!getEpisodeAudioUrl(episodeToPlay) && episodeToPlay?.id) {
          const fullEp = await Episode.get(episodeToPlay.id);
          episodeToPlay = fullEp || episodeToPlay;
        }
      } catch { /* ignore hydration errors */ }

      // Prefer episode's podcast if present; otherwise derive a minimal show object
      const epShow = episodeToPlay?.podcast && (episodeToPlay.podcast.title || episodeToPlay.podcast.name || episodeToPlay.podcast.cover_image) ? episodeToPlay.podcast : null;
      const showObj = epShow || { title: heroAuthor, name: heroAuthor, cover_image: heroImage };
      await loadAndPlay({ podcast: showObj, episode: episodeToPlay });
    } catch (e) {
      if (typeof console !== 'undefined') console.error('Play failed', e);
    }
  };

  const handleOpenAddToPlaylist = (episode) => {
    if (!isAuthenticated) { openAuth('login'); return; }
    setEpisodeToAdd(episode);
    setShowAddModal(true);
  };

  const handleAddedToPlaylist = ({ playlist: pl, action }) => {
    if (action === 'created') addPlaylist(pl);
    if (action === 'updated') updatePlaylist(pl);
  };

  const sortedEpisodes = (Array.isArray(episodes) ? [...episodes] : []).sort((a, b) => {
    const dateA = new Date(a?.created_date || a?.published_at || a?.release_date || 0);
    const dateB = new Date(b?.created_date || b?.published_at || b?.release_date || 0);
    if (sortOrder === 'Newest') {
      return dateB - dateA;
    }
    if (sortOrder === 'Oldest') {
      return dateA - dateB;
    }
    // 'Popular' sorting logic would need view counts, etc. Mocking for now.
    return 0;
  });

  if (isLoading) {
    return <div className="min-h-screen bg-black text-white text-center py-20">Loading...</div>;
  }

  if (!creatorInfo) {
    return <div className="min-h-screen bg-black text-white text-center py-20">Creator not found.</div>;
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Hero Section */}
      <div className="relative pt-16 pb-8 md:pb-12 px-2.5 lg:px-10">
        <div
          className="absolute inset-0 bg-no-repeat bg-cover bg-center opacity-10"
          style={{ backgroundImage: `url(${heroImage})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-transparent" />
        
        <div className="relative flex flex-col md:flex-row md:items-end gap-4 md:gap-8">
          <div className="w-32 h-32 md:w-48 md:h-48 rounded-lg overflow-hidden shadow-2xl flex-shrink-0 bg-gray-800">
            {heroImage ? (
              <img src={heroImage} alt={heroAuthor} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <span className="text-4xl md:text-6xl">🎙️</span>
              </div>
            )}
          </div>
          <div className="flex-1">
            <h1 className="text-3xl md:text-5xl font-bold mb-2">{heroAuthor}</h1>
            <p className="text-gray-300 mb-3 text-sm md:text-base">Episodes from {heroAuthor} <span className="text-gray-500 ml-2">{sortedEpisodes.length} episodes</span></p>
            <div className="flex flex-wrap gap-2 md:gap-3 text-xs md:text-sm text-gray-300 mb-4 md:mb-6">
              <span className="bg-gray-800/60 px-2 py-1 rounded">Non-Fiction</span>
              <span className="bg-gray-800/60 px-2 py-1 rounded">Narration</span>
              <span className="bg-gray-800/60 px-2 py-1 rounded">Monsters</span>
              <span className="bg-gray-800/60 px-2 py-1 rounded">Paranormal</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 md:gap-3">
             <Button className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white px-4 md:px-6 py-2 rounded-full flex items-center gap-2 text-sm md:text-base" onClick={() => handlePlay(sortedEpisodes[0])}>
              <Play className="w-4 h-4 fill-white" />
              Play
            </Button>
            <Button variant="outline" className="bg-transparent border-gray-600 text-white hover:bg-gray-800 hover:text-white px-4 md:px-6 py-2 rounded-full text-sm md:text-base" onClick={() => { if (!isAuthenticated) { openAuth('login'); } }}>
              Follow
            </Button>
            <Button variant="outline" className="bg-transparent border-gray-600 text-white hover:bg-gray-800 hover:text-white px-4 md:px-6 py-2 rounded-full text-sm md:text-base">Share</Button>
          </div>
        </div>
      </div>

      {/* Episodes List */}
      <div className="px-2.5 lg:px-10 py-8">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
          <h2 className="text-2xl md:text-3xl font-bold">Episodes</h2>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {['Newest', 'Oldest', 'Popular'].map(order => (
              <Button
                key={order}
                variant="ghost"
                onClick={() => setSortOrder(order)}
                className={`rounded-full px-3 md:px-4 py-2 text-sm whitespace-nowrap ${sortOrder === order ? 'bg-gray-700 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}
              >
                {order}
              </Button>
            ))}
          </div>
        </div>
        
        <EpisodesTable
          episodes={sortedEpisodes}
          show={{ title: heroAuthor, cover_image: heroImage }}
          onPlay={handlePlay}
          onAddToPlaylist={handleOpenAddToPlaylist}
        />
      </div>

      {/* Add to Playlist Modal */}
      <AddToPlaylistModal
        isOpen={showAddModal}
        episode={episodeToAdd}
        playlists={playlists}
        onClose={() => { setShowAddModal(false); setEpisodeToAdd(null); }}
        onAdded={handleAddedToPlaylist}
      />
    </div>
  );
}
