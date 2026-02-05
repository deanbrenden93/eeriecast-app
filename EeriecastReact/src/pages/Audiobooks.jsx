import { useState, useEffect } from "react";
import { Podcast, Playlist } from "@/api/entities";
import EpisodeCard from "../components/discover/EpisodeCard";
import ShowCard from "../components/discover/ShowCard";
import { isAudiobook } from "@/lib/utils";
import AddToPlaylistModal from "@/components/library/AddToPlaylistModal";
import { useUser } from "@/context/UserContext.jsx";
import { useAuthModal } from "@/context/AuthModalContext.jsx";

export default function Audiobooks() {
  const [activeTab] = useState("Recommended");
  const [podcasts, setPodcasts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [playlists, setPlaylists] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [episodeToAdd, setEpisodeToAdd] = useState(null);
  const { isAuthenticated } = useUser();
  const { openAuth } = useAuthModal();

  useEffect(() => {
    const loadPodcasts = async () => {
      setIsLoading(true);
      const resp = await Podcast.list("-created_date");
      const allPodcasts = Array.isArray(resp) ? resp : (resp?.results || []);
      // Filter to only show audiobooks
      const audiobookPodcasts = allPodcasts.filter(p => isAudiobook(p));
      setPodcasts(audiobookPodcasts);
      setIsLoading(false);
    };

    const loadPlaylists = async () => {
      try {
        const resp = await Playlist.list();
        const list = Array.isArray(resp) ? resp : (resp?.results || []);
        setPlaylists(list);
      } catch {
        setPlaylists([]);
      }
    };

    loadPodcasts();
    loadPlaylists();
  }, []);

  const handlePodcastPlay = (podcast) => {
    console.log("Playing:", podcast);
    // Future: Implement player logic
  };

  const handleOpenAddToPlaylist = (episode) => {
    if (!isAuthenticated) { openAuth('login'); return; }
    setEpisodeToAdd(episode);
    setShowAddModal(true);
  };

  const getEpCount = (podcast) => {
    const n = podcast?.episodes_count ?? podcast?.episode_count ?? null;
    if (typeof n === 'number' && !Number.isNaN(n)) return `${n} Chapter${n === 1 ? '' : 's'}`;
    return '';
  };

  const renderContent = () => {
    if (isLoading) {
      return <div className="text-white text-center py-10">Loading content...</div>;
    }

    const episodeCardView = (
      <div className="space-y-4">
        {podcasts.slice(0, 5).map((podcast) => (
          <EpisodeCard key={podcast.id} podcast={podcast} onPlay={handlePodcastPlay} onAddToPlaylist={handleOpenAddToPlaylist} />
        ))}
      </div>
    );

    const membersOnlyList = podcasts.filter(p => p.is_exclusive);
    const freeContentList = podcasts.filter(p => !p.is_exclusive);

    const renderCategoriesView = () => {
      return (
        <div>
          <h2 className="text-2xl font-bold text-white mb-6">Browse by Category</h2>
          <div className="grid grid-cols-12 gap-4 auto-rows-fr">
            {/* Row 1 */}
            <div className="col-span-3 bg-gradient-to-br from-purple-800 to-purple-900 rounded-lg p-4 cursor-pointer hover:scale-105 transition-transform duration-300">
              <h3 className="text-white font-bold text-lg mb-1">AUDIOBOOKS</h3>
              <p className="text-white/80 text-sm">8 shows</p>
            </div>
            <div className="col-span-6 bg-gradient-to-br from-indigo-800 to-indigo-900 rounded-lg p-4 cursor-pointer hover:scale-105 transition-transform duration-300">
              <h3 className="text-white font-bold text-lg mb-1">FICTION</h3>
              <p className="text-white/80 text-sm">7 shows</p>
            </div>

            {/* Row 2 */}
            <div className="col-span-4 bg-gradient-to-br from-slate-700 to-slate-800 rounded-lg p-4 cursor-pointer hover:scale-105 transition-transform duration-300">
              <h3 className="text-white font-bold text-lg mb-1">NON-FICTION</h3>
              <p className="text-white/80 text-sm">6 shows</p>
            </div>
            <div className="col-span-5 bg-gradient-to-br from-blue-800 to-blue-900 rounded-lg p-4 cursor-pointer hover:scale-105 transition-transform duration-300">
              <h3 className="text-white font-bold text-lg mb-1">MYSTERY</h3>
              <p className="text-white/80 text-sm">5 shows</p>
            </div>
            <div className="col-span-3 bg-gradient-to-br from-gray-700 to-gray-800 rounded-lg p-4 cursor-pointer hover:scale-105 transition-transform duration-300">
              <h3 className="text-white font-bold text-lg mb-1">ROMANCE</h3>
              <p className="text-white/80 text-sm">3 shows</p>
            </div>

            {/* Row 3 */}
            <div className="col-span-3 bg-gradient-to-br from-red-800 to-red-900 rounded-lg p-4 cursor-pointer hover:scale-105 transition-transform duration-300">
              <h3 className="text-white font-bold text-lg mb-1">THRILLER</h3>
              <p className="text-white/80 text-sm">3 shows</p>
            </div>
            <div className="col-span-6 bg-gradient-to-br from-indigo-700 to-indigo-800 rounded-lg p-4 cursor-pointer hover:scale-105 transition-transform duration-300">
              <h3 className="text-white font-bold text-lg mb-1">BIOGRAPHY</h3>
              <p className="text-white/80 text-sm">2 shows</p>
            </div>

            {/* Row 4 */}
            <div className="col-span-6 bg-gradient-to-br from-teal-800 to-teal-900 rounded-lg p-4 cursor-pointer hover:scale-105 transition-transform duration-300">
              <h3 className="text-white font-bold text-lg mb-1">SELF-HELP</h3>
              <p className="text-white/80 text-sm">2 shows</p>
            </div>
            <div className="col-span-6 bg-gradient-to-br from-amber-700 to-amber-800 rounded-lg p-4 cursor-pointer hover:scale-105 transition-transform duration-300">
              <h3 className="text-white font-bold text-lg mb-1">BUSINESS</h3>
              <p className="text-white/80 text-sm">2 shows</p>
            </div>
            <div className="col-span-3 bg-gradient-to-br from-gray-600 to-gray-700 rounded-lg p-4 cursor-pointer hover:scale-105 transition-transform duration-300">
              <h3 className="text-white font-bold text-lg mb-1">SCIENCE</h3>
              <p className="text-white/80 text-sm">2 shows</p>
            </div>

            {/* Row 5 */}
            <div className="col-span-6 bg-gradient-to-br from-pink-800 to-pink-900 rounded-lg p-4 cursor-pointer hover:scale-105 transition-transform duration-300">
              <h3 className="text-white font-bold text-lg mb-1">FANTASY</h3>
              <p className="text-white/80 text-sm">2 shows</p>
            </div>
            <div className="col-span-6 bg-gradient-to-br from-cyan-700 to-cyan-800 rounded-lg p-4 cursor-pointer hover:scale-105 transition-transform duration-300">
              <h3 className="text-white font-bold text-lg mb-1">HISTORY</h3>
              <p className="text-white/80 text-sm">2 shows</p>
            </div>

            {/* Row 6 */}
            <div className="col-span-6 bg-gradient-to-br from-slate-600 to-slate-700 rounded-lg p-4 cursor-pointer hover:scale-105 transition-transform duration-300">
              <h3 className="text-white font-bold text-lg mb-1">CLASSICS</h3>
              <p className="text-white/80 text-sm">2 shows</p>
            </div>
            <div className="col-span-3 bg-gradient-to-br from-green-700 to-green-800 rounded-lg p-4 cursor-pointer hover:scale-105 transition-transform duration-300">
              <h3 className="text-white font-bold text-lg mb-1">POETRY</h3>
              <p className="text-white/80 text-sm">2 shows</p>
            </div>

            {/* Row 7 */}
            <div className="col-span-3 bg-gradient-to-br from-purple-700 to-purple-800 rounded-lg p-4 cursor-pointer hover:scale-105 transition-transform duration-300">
              <h3 className="text-white font-bold text-lg mb-1">DRAMA</h3>
              <p className="text-white/80 text-sm">1 show</p>
            </div>
            <div className="col-span-3 bg-gradient-to-br from-emerald-700 to-emerald-800 rounded-lg p-4 cursor-pointer hover:scale-105 transition-transform duration-300">
              <h3 className="text-white font-bold text-lg mb-1">ADVENTURE</h3>
              <p className="text-white/80 text-sm">1 show</p>
            </div>
            <div className="col-span-3 bg-gradient-to-br from-blue-700 to-blue-800 rounded-lg p-4 cursor-pointer hover:scale-105 transition-transform duration-300">
              <h3 className="text-white font-bold text-lg mb-1">COMEDY</h3>
              <p className="text-white/80 text-sm">1 show</p>
            </div>

            {/* Row 8 */}
            <div className="col-span-3 bg-gradient-to-br from-cyan-600 to-cyan-700 rounded-lg p-4 cursor-pointer hover:scale-105 transition-transform duration-300">
              <h3 className="text-white font-bold text-lg mb-1">SCI-FI</h3>
              <p className="text-white/80 text-sm">1 show</p>
            </div>
            <div className="col-span-3 bg-gradient-to-br from-red-700 to-red-800 rounded-lg p-4 cursor-pointer hover:scale-105 transition-transform duration-300">
              <h3 className="text-white font-bold text-lg mb-1">HORROR</h3>
              <p className="text-white/80 text-sm">1 show</p>
            </div>
          </div>
        </div>
      );
    };

    switch (activeTab) {
      case "Recommended":
      case "Newest":
        return episodeCardView;
      case "Audiobooks":
        return (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-white">All Audiobooks</h2>
                <span className="text-sm text-gray-400">{podcasts.length} titles</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 gap-4">
                {podcasts.map((podcast) => (
                  <ShowCard 
                    key={podcast.id} 
                    podcast={podcast} 
                    onPlay={handlePodcastPlay} 
                    subtext={getEpCount(podcast)} 
                  />
                ))}
              </div>
            </div>
        );
      case "Books":
        return (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-white">Audiobook Collection</h2>
                <span className="text-sm text-gray-400">{podcasts.length} titles</span>
              </div>
               <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7 gap-6">
                {podcasts.map((podcast) => (
                  <ShowCard key={podcast.id} podcast={podcast} onPlay={handlePodcastPlay} subtext={getEpCount(podcast)} />
                ))}
              </div>
            </div>
        );
      case "Members-Only":
        return (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-white">Members-Only Audiobooks</h2>
                <span className="text-sm text-gray-400">{membersOnlyList.length} titles</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7 gap-6">
                {membersOnlyList.map((podcast) => (
                  <ShowCard key={podcast.id} podcast={podcast} onPlay={handlePodcastPlay} subtext={getEpCount(podcast)} />
                ))}
              </div>
            </div>
        );
      case "Free":
        return (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-white">Free Audiobooks</h2>
                <span className="text-sm text-gray-400">{freeContentList.length} titles</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7 gap-6">
                {freeContentList.map((podcast) => (
                  <ShowCard key={podcast.id} podcast={podcast} onPlay={handlePodcastPlay} subtext={getEpCount(podcast)} />
                ))}
              </div>
            </div>
        );
      case "Categories":
        return renderCategoriesView();
      default:
        return episodeCardView;
    }
  };

  return (
    <div className="min-h-screen bg-black text-white px-2.5 lg:px-10 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl md:text-5xl font-bold mb-6">Audiobooks</h1>
      </div>
      {renderContent()}

      {/* Add to Playlist Modal */}
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
    </div>
  );
}