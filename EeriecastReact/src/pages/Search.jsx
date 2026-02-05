import { useState, useEffect, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Playlist } from "@/api/entities";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search as SearchIcon, Plus, Heart, Clock, TrendingUp, Star } from "lucide-react";
import { isAudiobook, getPodcastCategoriesLower, formatDate } from "@/lib/utils";
import AddToPlaylistModal from "@/components/library/AddToPlaylistModal";
import { useUser } from "@/context/UserContext.jsx";
import { useAuthModal } from "@/context/AuthModalContext.jsx";
import { usePodcasts } from "@/context/PodcastContext.jsx";

export default function Search() {
  const location = useLocation();
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(location.search);
  const initialQuery = urlParams.get('q') || '';
  
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [activeTab, setActiveTab] = useState("All Content");
  const { podcasts: contextPodcasts, isLoading: podcastsLoading } = usePodcasts();
  const [searchResults, setSearchResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [playlists, setPlaylists] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [episodeToAdd, setEpisodeToAdd] = useState(null);
  const { isAuthenticated } = useUser();
  const { openAuth } = useAuthModal();

  const tabs = ["All Content", "Podcasts", "Audiobooks", "Members Only"];

  useEffect(() => {
    const loadPlaylists = async () => {
      try {
        const resp = await Playlist.list();
        const list = Array.isArray(resp) ? resp : (resp?.results || []);
        setPlaylists(list);
      } catch {
        setPlaylists([]);
      }
    };
    loadPlaylists();
  }, []);

  const performSearch = useCallback((query) => {
    setIsLoading(true);
    const lowerQuery = (query || '').toLowerCase();

    const source = Array.isArray(contextPodcasts) ? contextPodcasts : [];
    let results = source.filter(podcast => {
      const title = podcast.title?.toLowerCase() || '';
      const author = podcast.author?.toLowerCase() || '';
      const description = podcast.description?.toLowerCase() || '';
      const categories = getPodcastCategoriesLower(podcast);
      const categoryJoined = categories.join(' ');
      return (
        title.includes(lowerQuery) ||
        author.includes(lowerQuery) ||
        description.includes(lowerQuery) ||
        categoryJoined.includes(lowerQuery)
      );
    });

    // Filter by tab
    if (activeTab === "Podcasts") {
      results = results.filter(p => !isAudiobook(p));
    } else if (activeTab === "Audiobooks") {
      results = results.filter(p => isAudiobook(p));
    } else if (activeTab === "Members Only") {
      results = results.filter(p => p.is_exclusive);
    }

    setSearchResults(results);
    setIsLoading(false);
  }, [contextPodcasts, activeTab]);

  useEffect(() => {
    if (podcastsLoading) return; // wait for context to load first
    if (searchQuery.trim()) {
      performSearch(searchQuery);
    } else {
      setSearchResults([]);
    }
  }, [searchQuery, performSearch, podcastsLoading]);

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      performSearch(searchQuery);
    }
  };

  const handlePodcastPlay = (podcast) => {
    if (podcast?.id) {
      navigate(`${createPageUrl('Episodes')}?id=${encodeURIComponent(podcast.id)}`);
    }
  };

  const openAddToPlaylist = (episode) => {
    if (!isAuthenticated) { openAuth('login'); return; }
    setEpisodeToAdd(episode);
    setShowAddModal(true);
  };

  const renderShows = () => {
    const shows = searchResults.filter(p => !isAudiobook(p));
    if (shows.length === 0) return null;

    return (
      <div className="mb-8">
        <h2 className="text-lg md:text-xl font-bold text-white mb-4">Shows ({shows.length})</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3 md:gap-4">
          {shows.map((podcast) => (
            <div key={podcast.id} className="group cursor-pointer" onClick={() => handlePodcastPlay(podcast)}>
              <div className="aspect-square bg-gray-800 rounded-lg p-4 md:p-6 flex items-center justify-center mb-2 md:mb-3 transition-transform group-hover:scale-105">
                {podcast.cover_image ? (
                  <img src={podcast.cover_image} alt={podcast.title} className="w-full h-full object-cover rounded-lg" />
                ) : (
                  <span className="text-3xl md:text-4xl">🎧</span>
                )}
              </div>
              <h3 className="text-white font-semibold text-xs md:text-sm line-clamp-2 mb-1">{podcast.title}</h3>
              <p className="text-gray-400 text-xs">1 episodes</p>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderEpisodes = () => {
    if (searchResults.length === 0) return null;

    return (
      <div>
        <h2 className="text-lg md:text-xl font-bold text-white mb-4">Episodes ({searchResults.length})</h2>
        <div className="space-y-3">
          {searchResults.map((podcast) => (
            <div key={podcast.id} className="bg-gray-800/60 rounded-lg p-3 md:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0 group hover:bg-gray-800/80 transition-colors">
              <div className="flex items-start sm:items-center space-x-3 md:space-x-4 flex-1 min-w-0 w-full sm:w-auto">
                <div 
                  className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-lg overflow-hidden bg-gray-700 flex-shrink-0 cursor-pointer"
                  onClick={() => handlePodcastPlay(podcast)}
                >
                  {podcast.cover_image ? (
                    <img src={podcast.cover_image} alt={podcast.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-700 to-gray-900">
                      <span className="text-xl md:text-2xl">🎧</span>
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 
                    className="text-white font-semibold text-sm md:text-lg truncate hover:text-blue-400 cursor-pointer transition-colors"
                    onClick={() => handlePodcastPlay(podcast)}
                  >
                    {podcast.title}
                  </h3>
                  <p className="text-blue-400 text-xs md:text-sm font-semibold uppercase mb-1">{podcast.author}</p>
                  <div className="flex flex-wrap items-center gap-x-2 md:gap-x-3 gap-y-1 text-xs md:text-sm text-gray-400">
                    <span className="hidden sm:inline">Added {formatDate(podcast.created_date || podcast.published_at)}</span>
                    <span className="text-gray-600 hidden sm:inline">•</span>
                    <span>{podcast.duration || "00:54:00"}</span>
                    <span className="text-gray-600 hidden md:inline">•</span>
                    <span className="hidden md:inline">
                      {podcast.episode_number ? `Episode #${podcast.episode_number}` : (podcast.id ? `ID: ${podcast.id.toString().slice(0, 8)}` : "")}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-2 sm:space-x-2 self-end sm:self-auto">
                <button className="p-1.5 md:p-2 text-gray-400 hover:text-white transition-colors" onClick={() => openAddToPlaylist(podcast)}>
                  <Plus className="w-4 h-4 md:w-5 md:h-5" />
                </button>
                <button className="p-1.5 md:p-2 text-gray-400 hover:text-white transition-colors" onClick={() => { if (!isAuthenticated) openAuth('login'); }}>
                  <Heart className="w-4 h-4 md:w-5 md:h-5" />
                </button>
                <button className="p-1.5 md:p-2 text-gray-400 hover:text-white transition-colors">
                  <span className="w-1.5 h-1.5 md:w-2 md:h-2 bg-gray-400 rounded-full block"></span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-black text-white px-2.5 lg:px-10 py-8">
      {/* Header */}
      <div className="mb-6 md:mb-8">
        <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4 md:mb-6">Search</h1>
        {/* Search Bar */}
        <form onSubmit={handleSearch} className="mb-4 md:mb-6">
          <div className="relative max-w-2xl">
            <SearchIcon className="absolute left-3 md:left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 md:w-5 md:h-5" />
            <Input
              type="text"
              placeholder="Search for podcasts, episodes, or creators..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 md:pl-12 pr-3 md:pr-4 py-2 md:py-3 bg-gray-800 border-gray-600 text-white placeholder-gray-400 text-sm md:text-lg focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
        </form>
        {/* Tab Navigation */}
        <div className="flex space-x-2 md:space-x-4 mb-4 md:mb-6 overflow-x-auto pb-2 scrollbar-hide">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 md:px-4 py-2 rounded-full text-xs md:text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === tab
                  ? "bg-white text-black"
                  : "bg-gray-800 text-gray-300 hover:text-white hover:bg-gray-700"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      {searchQuery && (
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 md:gap-0 mb-6">
            <h2 className="text-xl md:text-2xl font-bold text-white">
              {isLoading ? 'Searching...' : `${searchResults.length} results`}
              {searchQuery && <span className="text-gray-400"> for &quot;{searchQuery}&quot;</span>}
            </h2>
            <div className="hidden md:flex items-center space-x-4">
              <Button variant="ghost" className="text-blue-400 hover:text-blue-300 text-sm">
                <Clock className="w-4 h-4 mr-2" />
                Relevance
              </Button>
              <Button variant="ghost" className="text-gray-400 hover:text-white text-sm">
                <TrendingUp className="w-4 h-4 mr-2" />
                Newest
              </Button>
              <Button variant="ghost" className="text-gray-400 hover:text-white text-sm">
                <Star className="w-4 h-4 mr-2" />
                Popular
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Search Results */}
      <div className="pb-32">
        {isLoading ? (
          <div className="text-center py-10">
            <div className="text-gray-400">Searching...</div>
          </div>
        ) : searchQuery && searchResults.length === 0 ? (
          <div className="text-center py-10">
            <div className="text-gray-400 text-lg">No results found for &quot;{searchQuery}&quot;</div>
            <div className="text-gray-500 text-sm mt-2">Try different keywords or browse our categories</div>
          </div>
        ) : searchQuery ? (
          <>
            {renderShows()}
            {renderEpisodes()}
          </>
        ) : (
          <div className="text-center py-10">
            <SearchIcon className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <div className="text-gray-400 text-lg">Start typing to search</div>
            <div className="text-gray-500 text-sm mt-2">Search for podcasts, episodes, or creators</div>
          </div>
        )}
      </div>

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