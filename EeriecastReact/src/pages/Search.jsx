import { useState, useEffect, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Playlist, Search as SearchApi } from "@/api/entities";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search as SearchIcon, Plus, Heart, Clock, TrendingUp, Star, Play } from "lucide-react";
import { isAudiobook, getPodcastCategoriesLower, formatDate } from "@/lib/utils";
import AddToPlaylistModal from "@/components/library/AddToPlaylistModal";
import { useUser } from "@/context/UserContext.jsx";
import { useAuthModal } from "@/context/AuthModalContext.jsx";
import { usePodcasts } from "@/context/PodcastContext.jsx";
import { useAudioPlayerContext } from "@/context/AudioPlayerContext";

/** Format duration — handles seconds (number), "HH:MM:SS" string, or "MM:SS" string */
function formatDuration(raw) {
  if (!raw && raw !== 0) return null;
  let totalSeconds;
  if (typeof raw === 'number') {
    totalSeconds = Math.floor(raw);
  } else if (typeof raw === 'string') {
    // "HH:MM:SS" or "MM:SS" or plain number string
    const parts = raw.split(':').map(Number);
    if (parts.some(isNaN)) return raw;
    if (parts.length === 3) totalSeconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
    else if (parts.length === 2) totalSeconds = parts[0] * 60 + parts[1];
    else totalSeconds = parts[0];
  } else {
    return String(raw);
  }
  if (totalSeconds < 0) return '0:00';
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** Expandable description with "Show more / Show less" */
function ExpandableDescription({ text, maxLength = 150 }) {
  const [expanded, setExpanded] = useState(false);
  if (!text) return null;
  const needsTruncation = text.length > maxLength;
  const displayText = !needsTruncation || expanded ? text : text.slice(0, maxLength).trimEnd() + '…';

  return (
    <div className="mt-1.5">
      <p className="text-gray-500 text-xs leading-snug">{displayText}</p>
      {needsTruncation && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setExpanded(v => !v); }}
          className="text-blue-400 hover:text-blue-300 text-xs mt-0.5 transition-colors"
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  );
}

export default function Search() {
  const location = useLocation();
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(location.search);
  const initialQuery = urlParams.get('q') || '';
  
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [activeTab, setActiveTab] = useState("All Content");
  const { podcasts: contextPodcasts, isLoading: podcastsLoading, getById } = usePodcasts();
  const [showResults, setShowResults] = useState([]);
  const [episodeResults, setEpisodeResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [playlists, setPlaylists] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [episodeToAdd, setEpisodeToAdd] = useState(null);
  const { isAuthenticated } = useUser();
  const { openAuth } = useAuthModal();
  const { loadAndPlay } = useAudioPlayerContext();

  const tabs = ["All Content", "Podcasts", "Episodes", "Audiobooks", "Members Only"];

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

  const performSearch = useCallback(async (query) => {
    setIsLoading(true);
    const lowerQuery = (query || '').toLowerCase();

    // --- Client-side podcast search (fast, uses full context data) ---
    const source = Array.isArray(contextPodcasts) ? contextPodcasts : [];
    let podcastResults = source.filter(podcast => {
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
      podcastResults = podcastResults.filter(p => !isAudiobook(p));
    } else if (activeTab === "Audiobooks") {
      podcastResults = podcastResults.filter(p => isAudiobook(p));
    } else if (activeTab === "Members Only") {
      podcastResults = podcastResults.filter(p => p.is_exclusive);
    }

    setShowResults(podcastResults);

    // --- Server-side episode search (uses /api/search/ endpoint) ---
    if (activeTab !== "Podcasts" && activeTab !== "Audiobooks") {
      try {
        const searchResp = await SearchApi.search(query);
        const apiEpisodes = Array.isArray(searchResp?.episodes) ? searchResp.episodes : [];

        // Enrich episode results with podcast data from context
        const enrichedEpisodes = apiEpisodes.map(ep => {
          const podcastData = ep.podcast ? getById(ep.podcast) : null;
          return {
            ...ep,
            podcast_id: ep.podcast,
            podcast_title: podcastData?.title || '',
            podcast_author: podcastData?.author || '',
            podcast_cover_image: podcastData?.cover_image || '',
            cover_image: ep.cover_image || podcastData?.cover_image || '',
          };
        });

        // If "Members Only" tab, filter episodes too
        let filteredEpisodes = enrichedEpisodes;
        if (activeTab === "Members Only") {
          filteredEpisodes = enrichedEpisodes.filter(ep => ep.is_premium);
        }

        setEpisodeResults(filteredEpisodes);
      } catch (err) {
        console.error('Episode search failed:', err);
        setEpisodeResults([]);
      }
    } else {
      setEpisodeResults([]);
    }

    setIsLoading(false);
  }, [contextPodcasts, activeTab, getById]);

  useEffect(() => {
    if (podcastsLoading) return; // wait for context to load first
    if (searchQuery.trim()) {
      performSearch(searchQuery);
    } else {
      setShowResults([]);
      setEpisodeResults([]);
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

  const handleEpisodePlay = async (episode) => {
    const podcastData = episode.podcast_id ? getById(episode.podcast_id) : null;
    if (podcastData) {
      await loadAndPlay({ podcast: podcastData, episode, resume: { progress: 0 } });
    } else if (episode.podcast_id) {
      // Navigate to the episodes page for the podcast
      navigate(`${createPageUrl('Episodes')}?id=${encodeURIComponent(episode.podcast_id)}`);
    }
  };

  const openAddToPlaylist = (episode) => {
    if (!isAuthenticated) { openAuth('login'); return; }
    setEpisodeToAdd(episode);
    setShowAddModal(true);
  };

  const totalResults = showResults.length + episodeResults.length;

  const renderShows = () => {
    if (activeTab === "Episodes") return null;
    const shows = activeTab === "Audiobooks"
      ? showResults
      : showResults.filter(p => !isAudiobook(p));
    if (shows.length === 0) return null;

    const label = activeTab === "Audiobooks" ? "Audiobooks" : "Shows";

    return (
      <div className="mb-8">
        <h2 className="text-lg md:text-xl font-bold text-white mb-4">{label} ({shows.length})</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3 md:gap-4">
          {shows.map((podcast) => (
            <div key={podcast.id} className="group cursor-pointer" onClick={() => handlePodcastPlay(podcast)}>
              <div className="aspect-square bg-gray-800 rounded-lg p-4 md:p-6 flex items-center justify-center mb-2 md:mb-3 transition-transform group-hover:scale-105 overflow-hidden">
                {podcast.cover_image ? (
                  <img src={podcast.cover_image} alt={podcast.title} className="w-full h-full object-cover rounded-lg" />
                ) : (
                  <span className="text-3xl md:text-4xl">🎧</span>
                )}
              </div>
              <h3 className="text-white font-semibold text-xs md:text-sm line-clamp-2 mb-1">{podcast.title}</h3>
              <p className="text-gray-400 text-xs">{podcast.author || 'Eeriecast'}</p>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderEpisodes = () => {
    if (activeTab === "Podcasts" || activeTab === "Audiobooks") return null;
    if (episodeResults.length === 0) return null;

    return (
      <div>
        <h2 className="text-lg md:text-xl font-bold text-white mb-4">Episodes ({episodeResults.length})</h2>
        <div className="space-y-3">
          {episodeResults.map((episode) => {
            const formattedDuration = formatDuration(episode.duration);

            return (
              <div key={episode.id} className="bg-gray-800/60 rounded-lg p-3 md:p-4 group hover:bg-gray-800/80 transition-colors">
                <div className="flex items-start space-x-3 md:space-x-4">
                  {/* Cover image + play overlay */}
                  <div
                    className="relative w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-lg overflow-hidden bg-gray-700 flex-shrink-0 cursor-pointer group/thumb"
                    onClick={() => handleEpisodePlay(episode)}
                  >
                    {episode.cover_image ? (
                      <img src={episode.cover_image} alt={episode.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-700 to-gray-900">
                        <span className="text-xl md:text-2xl">🎧</span>
                      </div>
                    )}
                    {/* Play button overlay */}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center">
                      <Play className="w-5 h-5 md:w-6 md:h-6 text-white fill-white" />
                    </div>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h3
                          className="text-white font-semibold text-sm md:text-lg truncate hover:text-blue-400 cursor-pointer transition-colors"
                          onClick={() => handleEpisodePlay(episode)}
                        >
                          {episode.title}
                        </h3>
                        {episode.podcast_id ? (
                          <button
                            type="button"
                            className="text-blue-400 hover:text-blue-300 text-xs md:text-sm font-semibold uppercase mb-1 transition-colors text-left"
                            onClick={(e) => { e.stopPropagation(); navigate(`${createPageUrl('Episodes')}?id=${encodeURIComponent(episode.podcast_id)}`); }}
                          >
                            {episode.podcast_title || episode.podcast_author || ''}
                          </button>
                        ) : (
                          <p className="text-blue-400 text-xs md:text-sm font-semibold uppercase mb-1">
                            {episode.podcast_title || episode.podcast_author || ''}
                          </p>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center space-x-1 flex-shrink-0">
                        <button
                          className="p-1.5 md:p-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-white/5"
                          title="Add to playlist"
                          onClick={() => openAddToPlaylist(episode)}
                        >
                          <Plus className="w-4 h-4 md:w-5 md:h-5" />
                        </button>
                        <button
                          className="p-1.5 md:p-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-white/5"
                          title="Favorite"
                          onClick={() => { if (!isAuthenticated) openAuth('login'); }}
                        >
                          <Heart className="w-4 h-4 md:w-5 md:h-5" />
                        </button>
                        <button
                          className="p-1.5 md:p-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-white/5"
                          title="Play"
                          onClick={() => handleEpisodePlay(episode)}
                        >
                          <Play className="w-4 h-4 md:w-5 md:h-5 fill-current" />
                        </button>
                      </div>
                    </div>

                    {/* Meta row */}
                    <div className="flex flex-wrap items-center gap-x-2 md:gap-x-3 gap-y-1 text-xs md:text-sm text-gray-400">
                      {episode.published_at && (
                        <span>{formatDate(episode.published_at)}</span>
                      )}
                      {formattedDuration && (
                        <>
                          <span className="text-gray-600">•</span>
                          <span>{formattedDuration}</span>
                        </>
                      )}
                      {episode.episode_number && (
                        <>
                          <span className="text-gray-600 hidden md:inline">•</span>
                          <span className="hidden md:inline">Episode #{episode.episode_number}</span>
                        </>
                      )}
                      {episode.is_premium && (
                        <>
                          <span className="text-gray-600">•</span>
                          <span className="text-yellow-400 text-xs font-medium">PREMIUM</span>
                        </>
                      )}
                    </div>

                    {/* Expandable description */}
                    <ExpandableDescription text={episode.description} maxLength={160} />
                  </div>
                </div>
              </div>
            );
          })}
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
              {isLoading ? 'Searching...' : `${totalResults} results`}
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
        ) : searchQuery && totalResults === 0 ? (
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
