import { useState, useEffect } from "react";
import { useLocation } from 'react-router-dom';
import { createPageUrl } from "@/utils";
import { Podcast, Playlist, UserLibrary, Category, Episode } from "@/api/entities";
import EpisodeCard from "../components/discover/EpisodeCard";
import ShowCard from "../components/discover/ShowCard";
import ShowGrid from "@/components/ui/ShowGrid";
import { isAudiobook, hasCategory, getEpisodeAudioUrl } from "@/lib/utils";
import AddToPlaylistModal from "@/components/library/AddToPlaylistModal";
import SubscribeModal from "@/components/auth/SubscribeModal";
import { useUser } from '@/context/UserContext.jsx';
import { usePodcasts } from '@/context/PodcastContext.jsx';
import { useAuthModal } from '@/context/AuthModalContext.jsx';
import { useAudioPlayerContext } from "@/context/AudioPlayerContext";

export default function Discover() {
  const location = useLocation();
  const tabs = [
    "Recommended", "Podcasts", "Books", "Members-Only", "Free", "Newest", "Categories", "Trending"
  ];
  const queryTab = (() => {
    try {
      const params = new URLSearchParams(location.search);
      const raw = params.get('tab');
      if (!raw) return null;
      return tabs.find(t => t.toLowerCase() === raw.toLowerCase()) || null;
    } catch { return null; }
  })();
  const [activeTab, setActiveTab] = useState(queryTab || "Recommended");
  const { podcasts, isLoading } = usePodcasts();
  const [playlists, setPlaylists] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [episodeToAdd, setEpisodeToAdd] = useState(null);
  const [categories, setCategories] = useState([]);
  const [isCategoriesLoading, setIsCategoriesLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [showSubscribeModal, setShowSubscribeModal] = useState(false);
  const [subscribeLabel, setSubscribeLabel] = useState("");

  const { favoritePodcastIds, user, refreshFavorites, isPremium, isAuthenticated } = useUser();
  const { openAuth } = useAuthModal();
  const { loadAndPlay } = useAudioPlayerContext();

  // Helper to derive an episodes count display if available
  const getEpCount = (podcast) => {
    const n = podcast?.episodes_count ?? podcast?.episode_count ?? null;
    if (typeof n === 'number' && !Number.isNaN(n)) return `${n} Episode${n === 1 ? '' : 's'}`;
    // fallback to a stable-looking pseudo count for aesthetics
    return '';
  };

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

    const loadCategories = async () => {
      try {
        setIsCategoriesLoading(true);
        const resp = await Category.list();
        const list = Array.isArray(resp) ? resp : (resp?.results || []);
        setCategories(list);
      } catch {
        setCategories([]);
      } finally {
        setIsCategoriesLoading(false);
      }
    };

    loadPlaylists();
    loadCategories();
  }, []);

  const handlePodcastPlay = async (podcast) => {
    try {
      if (!podcast?.id) return;

      // For audiobooks: ALWAYS navigate to show page per client request
      if (isAudiobook(podcast)) {
        window.location.assign(`${createPageUrl('Episodes')}?id=${encodeURIComponent(podcast.id)}`);
        return;
      }

      // For members-only: allow browse, gate on play inside Episodes
      if (podcast?.is_exclusive && !isPremium) {
        window.location.assign(`${createPageUrl('Episodes')}?id=${encodeURIComponent(podcast.id)}`);
        return;
      }

      // Ensure episode list is present
      let episodes = Array.isArray(podcast.episodes) ? podcast.episodes : [];
      if (!episodes.length) {
        const detail = await Podcast.get(podcast.id);
        episodes = Array.isArray(detail?.episodes) ? detail.episodes : (detail?.episodes?.results || []);
      }

      // Try resume for this podcast
      let resume;
      try { resume = await UserLibrary.resumeForPodcast(podcast.id); } catch { resume = null; }

      // Choose episode: resumed or first
      let ep;
      const resumeEp = resume && resume.episode_detail;
      if (resumeEp) {
        const found = episodes.find(e => e.id === resumeEp.id);
        ep = found ? { ...found, ...resumeEp } : resumeEp;
      } else {
        ep = episodes[0];
      }
      if (!ep) return;

      // Hydrate audio URL if missing
      if (!getEpisodeAudioUrl(ep) && ep?.id) {
        try {
          const fullEp = await Episode.get(ep.id);
          ep = fullEp || ep;
        } catch { /* ignore */ }
      }

      // Gate premium episodes
      if (ep?.is_premium && !isPremium) {
        setSubscribeLabel(ep?.title || podcast?.title || 'Premium episode');
        setShowSubscribeModal(true);
        return;
      }

      await loadAndPlay({ podcast, episode: ep, resume });
    } catch (e) {
      if (typeof console !== 'undefined') console.debug('discover play failed', e);
    }
  };

  const handleOpenAddToPlaylist = async (item) => {
    // Require login to add to playlists
    if (!isAuthenticated) { openAuth('login'); return; }

    try {
      let ep = item;
      let podcastForFallback = null;

      // If a podcast object was passed (no audio fields, has episodes/podcast-ish), resolve an episode to add
      const looksLikePodcast = Array.isArray(item?.episodes) || (item && !item?.audio_url && !item?.episode_number && item?.id);
      if (looksLikePodcast) {
        const podcast = item;
        if (!podcast?.id) return;
        podcastForFallback = podcast;
        // Ensure we have episodes
        let episodes = Array.isArray(podcast.episodes) ? podcast.episodes : [];
        if (!episodes.length) {
          const detail = await Podcast.get(podcast.id);
          episodes = Array.isArray(detail?.episodes) ? detail.episodes : (detail?.episodes?.results || []);
        }
        // Prefer resume episode if available
        let resume;
        try { resume = await UserLibrary.resumeForPodcast(podcast.id); } catch { /* ignore */ }
        if (resume?.episode_detail) {
          const found = episodes.find(e => e.id === resume.episode_detail.id);
          ep = found || resume.episode_detail;
        } else {
          ep = episodes[0];
        }
      } else {
        // Treat item as an episode; if it has a parent podcast, save for fallback
        podcastForFallback = item?.podcast && typeof item.podcast === 'object' ? item.podcast : null;
      }

      // Validate we have an episode id
      if (!ep?.id) {
        // Fallback: query the latest ep for the podcast if known
        if (podcastForFallback?.id) {
          try {
            const res = await Episode.filter({ podcast: podcastForFallback.id }, '-created_date', 1);
            const arr = Array.isArray(res) ? res : (res?.results || []);
            if (arr[0]?.id) ep = arr[0];
          } catch (err) {
            if (typeof console !== 'undefined') console.debug('episode filter fallback failed', err);
          }
        }
      } else {
        // Verify the episode exists server-side; if 404, fallback to fetch the latest by podcast
        try {
          const fetched = await Episode.get(ep.id);
          if (fetched?.id) ep = fetched;
        } catch (err) {
          if (typeof console !== 'undefined') console.debug('episode verify failed, trying latest by podcast', err);
          if (podcastForFallback?.id) {
            try {
              const res = await Episode.filter({ podcast: podcastForFallback.id }, '-created_date', 1);
              const arr = Array.isArray(res) ? res : (res?.results || []);
              if (arr[0]?.id) ep = arr[0];
            } catch (e2) {
              if (typeof console !== 'undefined') console.debug('second filter fallback failed', e2);
            }
          }
        }
      }

      if (!ep?.id) return;
      setEpisodeToAdd(ep);
      setShowAddModal(true);
    } catch (e) {
      if (typeof console !== 'undefined') console.debug('open add-to-playlist failed', e);
    }
  };

  const onFavoriteClick = async (podcast) => {
    if (!podcast?.id) return;
    const userId = user?.id || user?.user?.id || user?.pk;
    if (!userId || !isAuthenticated) {
      openAuth('login');
      return;
    }

    try {
      await UserLibrary.addFavorite('podcast', podcast.id, { userId });
      // Refresh favorites to update both episode and podcast favorites from backend
      await refreshFavorites();
    } catch (err) {
      if (typeof console !== 'undefined') console.debug('podcast favorite failed', err);
    }
  };

  const renderContent = () => {
    if (isLoading) {
      return <div className="text-white text-center py-10">Loading content...</div>;
    }

    const episodeCardView = (
      <div className="space-y-4">
        {podcasts.slice(0, 5).map((podcast) => (
          <EpisodeCard
            key={podcast.id}
            podcast={podcast}
            onPlay={handlePodcastPlay}
            onAddToPlaylist={handleOpenAddToPlaylist}
            initialFavorited={favoritePodcastIds.has(podcast.id)}
            canFavorite={false}
            onFavoriteClick={onFavoriteClick}
          />
        ))}
      </div>
    );

    const renderCategoryDetailView = () => {
      const selKey = (selectedCategory?.key || '').toLowerCase();

      const filtered = podcasts.filter(p => {
        if (!selKey) return true;
        if (selKey === 'audiobook' || selKey === 'audiobooks') return isAudiobook(p);
        if (selKey === 'free') return !p.is_exclusive;
        if (selKey === 'members-only' || selKey === 'members only' || selKey === 'members_only') return p.is_exclusive;
        return hasCategory(p, selKey);
      });

      const heading = (selectedCategory?.label || selKey || 'All').toString();

      return (
        <div>
          <div className="flex items-center gap-4 mb-6">
            <button
              onClick={() => setSelectedCategory(null)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gray-800/70 hover:bg-gray-700 text-white border border-gray-700/60 transition-colors"
            >
              <span className="text-lg">←</span>
              <span className="text-sm font-medium">Back to Categories</span>
            </button>
          </div>

          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-white">{heading}</h2>
            <span className="text-sm text-gray-400">{filtered.length} {filtered.length === 1 ? 'show' : 'shows'}</span>
          </div>

          {filtered.length === 0 ? (
            <div className="text-center py-10 text-gray-400">No podcasts found in this category.</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 gap-4">
              {filtered.map((podcast) => (
                <ShowCard
                  key={podcast.id}
                  podcast={podcast}
                  onPlay={handlePodcastPlay}
                  subtext={getEpCount(podcast)}
                />
              ))}
            </div>
          )}
        </div>
      );
    };

    const renderCategoriesView = () => {
      // Build a deterministic palette for category tiles
      const gradients = [
        'from-purple-800 to-purple-900',
        'from-indigo-800 to-indigo-900',
        'from-slate-700 to-slate-800',
        'from-blue-800 to-blue-900',
        'from-gray-700 to-gray-800',
        'from-red-800 to-red-900',
        'from-orange-700 to-orange-800',
        'from-teal-800 to-teal-900',
        'from-amber-700 to-amber-800',
        'from-pink-800 to-pink-900',
        'from-cyan-700 to-cyan-800',
        'from-slate-600 to-slate-700',
        'from-green-700 to-green-800',
        'from-emerald-700 to-emerald-800',
        'from-blue-700 to-blue-800',
        'from-cyan-600 to-cyan-700',
        'from-red-700 to-red-800',
      ];

      // Helper to compute count for a category from loaded podcasts if API does not provide it
      const getCountForCategory = (cat) => {
        const slug = (cat.slug || '').toLowerCase();
        const name = (cat.name || '').toLowerCase();
        // Prefer provided counts from API if available
        const apiCount = cat.podcast_count ?? cat.count ?? cat.total ?? null;
        if (typeof apiCount === 'number') return apiCount;
        // Fallback: compute from our loaded podcasts
        return podcasts.reduce((acc, p) => {
          try {
            if (slug ? hasCategory(p, slug) : name ? hasCategory(p, name) : false) {
              return acc + 1;
            }
            return acc;
          } catch {
            return acc;
          }
        }, 0);
      };

      if (isCategoriesLoading) {
        return <div className="text-white text-center py-10">Loading categories...</div>;
      }

      if (!categories || categories.length === 0) {
        return <div className="text-center py-10 text-gray-400">No categories available.</div>;
      }

      return (
        <div>
          <h2 className="text-2xl font-bold text-white mb-6">Browse by Category</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-4 auto-rows-[4.875rem] sm:auto-rows-[5.625rem] md:auto-rows-[6rem] grid-flow-row-dense">
            {categories.map((cat, idx) => {
              const color = gradients[idx % gradients.length];
              const shows = getCountForCategory(cat);
              const label = (cat.name || cat.title || cat.slug || '').toString();
              const slugOrName = (cat.slug || cat.name || '').toString().toLowerCase();

              // Responsive width variants (uniform height)
              const VAR_FULL = 'md:col-span-6 lg:col-span-8 xl:col-span-10';
              const VAR_XL = 'md:col-span-4 lg:col-span-6 xl:col-span-7';
              const VAR_L = 'md:col-span-3 lg:col-span-4 xl:col-span-5';
              const VAR_M = 'md:col-span-2 lg:col-span-3 xl:col-span-4';
              const VAR_S = 'md:col-span-2 lg:col-span-2 xl:col-span-3';

              // Create a richer repeating pattern of widths
              const patternIdx = idx % 16;
              let sizeClass;
              switch (patternIdx) {
                case 0:
                  sizeClass = VAR_FULL; // hero wide
                  break;
                case 1:
                  sizeClass = VAR_XL;
                  break;
                case 2:
                  sizeClass = VAR_L;
                  break;
                case 3:
                  sizeClass = VAR_M;
                  break;
                case 4:
                  sizeClass = VAR_L;
                  break;
                case 5:
                  sizeClass = VAR_XL;
                  break;
                case 6:
                  sizeClass = VAR_S;
                  break;
                case 7:
                  sizeClass = VAR_M;
                  break;
                case 8:
                  sizeClass = VAR_XL;
                  break;
                case 9:
                  sizeClass = VAR_L;
                  break;
                case 10:
                  sizeClass = VAR_FULL; // another hero wide
                  break;
                case 11:
                  sizeClass = VAR_M;
                  break;
                case 12:
                  sizeClass = VAR_S;
                  break;
                case 13:
                  sizeClass = VAR_L;
                  break;
                case 14:
                  sizeClass = VAR_XL;
                  break;
                case 15:
                  sizeClass = VAR_M;
                  break;
                default:
                  sizeClass = VAR_M;
              }

              return (
                <div
                  key={cat.id || cat.slug || label}
                  className={`bg-gradient-to-br ${color} rounded-lg p-4 cursor-pointer hover:scale-105 transition-transform duration-300 h-full ${sizeClass} flex flex-col justify-between`}
                  onClick={() => setSelectedCategory({ key: slugOrName, label, count: shows })}
                >
                  <h3 className="text-white font-bold text-sm md:text-base mb-1 truncate">{label.toUpperCase()}</h3>
                  <p className="text-white/80 text-xs">{shows} {shows === 1 ? 'show' : 'shows'}</p>
                </div>
              );
            })}
          </div>
        </div>
      );
    };

    switch (activeTab) {
      case "Recommended":
      case "Newest":
        return episodeCardView;
      case "Podcasts":
        return (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-white">All Podcasts</h2>
              <span className="text-sm text-gray-400">{podcasts.length} shows</span>
            </div>
            <ShowGrid>
              {podcasts.map((podcast) => (
                <ShowCard
                  key={podcast.id}
                  podcast={podcast}
                  onPlay={handlePodcastPlay}
                  subtext={getEpCount(podcast)}
                />
              ))}
            </ShowGrid>
          </div>
        );
      case "Books": {
        const books = podcasts.filter(p => isAudiobook(p));
        return (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-white">Audiobook Collection</h2>
              <span className="text-sm text-gray-400">{books.length} titles</span>
            </div>
            <ShowGrid>
              {books.map((podcast) => (
                <ShowCard key={podcast.id} podcast={podcast} onPlay={handlePodcastPlay} subtext={getEpCount(podcast)} />
              ))}
            </ShowGrid>
          </div>
        );
      }
      case "Members-Only": {
        const membersOnly = podcasts.filter(p => p.is_exclusive);
        return (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-white">Members-Only</h2>
              <span className="text-sm text-gray-400">{membersOnly.length} shows</span>
            </div>
            <ShowGrid>
              {membersOnly.map((podcast) => (
                <ShowCard key={podcast.id} podcast={podcast} onPlay={handlePodcastPlay} subtext={getEpCount(podcast)} />
              ))}
            </ShowGrid>
          </div>
        );
      }
      case "Free": {
        const freeContent = podcasts.filter(p => !p.is_exclusive);
        return (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-white">Free Content</h2>
              <span className="text-sm text-gray-400">{freeContent.length} shows</span>
            </div>
            <ShowGrid>
              {freeContent.map((podcast) => (
                <ShowCard key={podcast.id} podcast={podcast} onPlay={handlePodcastPlay} subtext={getEpCount(podcast)} />
              ))}
            </ShowGrid>
          </div>
        );
      }
      case "Categories":
        return selectedCategory ? renderCategoryDetailView() : renderCategoriesView();
      case "Trending": {
        const trending = podcasts.filter(p => p.is_trending);
        return (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-white">Trending Now</h2>
              <span className="text-sm text-gray-400">{trending.length} {trending.length === 1 ? 'show' : 'shows'}</span>
            </div>
            <ShowGrid>
              {trending.map((podcast) => (
                <ShowCard key={podcast.id} podcast={podcast} onPlay={handlePodcastPlay} subtext={getEpCount(podcast)} />
              ))}
            </ShowGrid>
          </div>
        );
      }
      default:
        return episodeCardView;
    }
  };

  return (
    <div className="min-h-screen bg-black text-white px-2.5 lg:px-10 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl md:text-5xl font-bold mb-2 bg-gradient-to-r from-white via-pink-400 to-purple-500 bg-clip-text text-transparent">
          Discover
        </h1>
        <p className="text-gray-400 text-lg">Explore our entire collection</p>
      </div>

      {/* Tab Navigation */}
      <div className="mb-8 border-b border-gray-800">
        <div className="flex space-x-4 sm:space-x-8 overflow-x-auto pb-px" style={{ scrollbarWidth: 'none', 'msOverflowStyle': 'none' }}>
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-shrink-0 pb-3 text-sm font-medium transition-colors border-b-2 ${
                activeTab === tab
                  ? "text-white border-red-500"
                  : "text-gray-400 hover:text-white border-transparent"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="pb-32">
        {renderContent()}
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

      {/* Subscribe / Premium gating modal */}
      <SubscribeModal
        open={showSubscribeModal}
        onOpenChange={setShowSubscribeModal}
        itemLabel={subscribeLabel}
        title="Subscribe to listen"
        message="This podcast is available to members only. Subscribe to unlock all premium shows and episodes."
      />
    </div>
  );
}
