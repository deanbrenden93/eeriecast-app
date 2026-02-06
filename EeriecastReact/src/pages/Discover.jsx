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

  const getEpCount = (podcast) => {
    const n = podcast?.episodes_count ?? podcast?.episode_count ?? null;
    if (typeof n === 'number' && !Number.isNaN(n)) return `${n} Episode${n === 1 ? '' : 's'}`;
    return '';
  };

  useEffect(() => {
    const loadPlaylists = async () => {
      try {
        const resp = await Playlist.list();
        const list = Array.isArray(resp) ? resp : (resp?.results || []);
        setPlaylists(list);
      } catch { setPlaylists([]); }
    };

    const loadCategories = async () => {
      try {
        setIsCategoriesLoading(true);
        const resp = await Category.list();
        const list = Array.isArray(resp) ? resp : (resp?.results || []);
        setCategories(list);
      } catch { setCategories([]); } finally { setIsCategoriesLoading(false); }
    };

    loadPlaylists();
    loadCategories();
  }, []);

  const handlePodcastPlay = async (podcast) => {
    try {
      if (!podcast?.id) return;
      if (isAudiobook(podcast)) {
        window.location.assign(`${createPageUrl('Episodes')}?id=${encodeURIComponent(podcast.id)}`);
        return;
      }
      if (podcast?.is_exclusive && !isPremium) {
        window.location.assign(`${createPageUrl('Episodes')}?id=${encodeURIComponent(podcast.id)}`);
        return;
      }
      let episodes = Array.isArray(podcast.episodes) ? podcast.episodes : [];
      if (!episodes.length) {
        const detail = await Podcast.get(podcast.id);
        episodes = Array.isArray(detail?.episodes) ? detail.episodes : (detail?.episodes?.results || []);
      }
      let resume;
      try { resume = await UserLibrary.resumeForPodcast(podcast.id); } catch { resume = null; }
      let ep;
      const resumeEp = resume && resume.episode_detail;
      if (resumeEp) {
        const found = episodes.find(e => e.id === resumeEp.id);
        ep = found ? { ...found, ...resumeEp } : resumeEp;
      } else {
        ep = episodes[0];
      }
      if (!ep) return;
      if (!getEpisodeAudioUrl(ep) && ep?.id) {
        try { const fullEp = await Episode.get(ep.id); ep = fullEp || ep; } catch { /* ignore */ }
      }
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
    if (!isAuthenticated) { openAuth('login'); return; }
    try {
      let ep = item;
      let podcastForFallback = null;
      const looksLikePodcast = Array.isArray(item?.episodes) || (item && !item?.audio_url && !item?.episode_number && item?.id);
      if (looksLikePodcast) {
        const podcast = item;
        if (!podcast?.id) return;
        podcastForFallback = podcast;
        let episodes = Array.isArray(podcast.episodes) ? podcast.episodes : [];
        if (!episodes.length) {
          const detail = await Podcast.get(podcast.id);
          episodes = Array.isArray(detail?.episodes) ? detail.episodes : (detail?.episodes?.results || []);
        }
        let resume;
        try { resume = await UserLibrary.resumeForPodcast(podcast.id); } catch { /* ignore */ }
        if (resume?.episode_detail) {
          const found = episodes.find(e => e.id === resume.episode_detail.id);
          ep = found || resume.episode_detail;
        } else {
          ep = episodes[0];
        }
      } else {
        podcastForFallback = item?.podcast && typeof item.podcast === 'object' ? item.podcast : null;
      }
      if (!ep?.id) {
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
    if (!userId || !isAuthenticated) { openAuth('login'); return; }
    try {
      await UserLibrary.addFavorite('podcast', podcast.id, { userId });
      await refreshFavorites();
    } catch (err) {
      if (typeof console !== 'undefined') console.debug('podcast favorite failed', err);
    }
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 bg-eeriecast-surface-light/50 rounded-xl animate-pulse" />
          ))}
        </div>
      );
    }

    const episodeCardView = (
      <div className="space-y-3">
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
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-eeriecast-surface-lighter hover:bg-white/[0.06] text-white border border-white/[0.06] transition-all duration-300"
            >
              <span className="text-lg">←</span>
              <span className="text-sm font-medium">Back to Categories</span>
            </button>
          </div>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-white">{heading}</h2>
            <span className="text-sm text-zinc-500">{filtered.length} {filtered.length === 1 ? 'show' : 'shows'}</span>
          </div>
          {filtered.length === 0 ? (
            <div className="text-center py-10 text-zinc-500">No podcasts found in this category.</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 gap-3">
              {filtered.map((podcast) => (
                <ShowCard key={podcast.id} podcast={podcast} onPlay={handlePodcastPlay} subtext={getEpCount(podcast)} />
              ))}
            </div>
          )}
        </div>
      );
    };

    const renderCategoriesView = () => {
      const gradients = [
        'from-red-900/60 to-red-950/80',
        'from-violet-900/60 to-violet-950/80',
        'from-slate-800/60 to-slate-900/80',
        'from-blue-900/60 to-blue-950/80',
        'from-zinc-800/60 to-zinc-900/80',
        'from-rose-900/60 to-rose-950/80',
        'from-amber-900/60 to-amber-950/80',
        'from-teal-900/60 to-teal-950/80',
        'from-purple-900/60 to-purple-950/80',
        'from-pink-900/60 to-pink-950/80',
        'from-cyan-900/60 to-cyan-950/80',
        'from-emerald-900/60 to-emerald-950/80',
        'from-indigo-900/60 to-indigo-950/80',
        'from-orange-900/60 to-orange-950/80',
      ];

      const getCountForCategory = (cat) => {
        const slug = (cat.slug || '').toLowerCase();
        const name = (cat.name || '').toLowerCase();
        const apiCount = cat.podcast_count ?? cat.count ?? cat.total ?? null;
        if (typeof apiCount === 'number') return apiCount;
        return podcasts.reduce((acc, p) => {
          try {
            if (slug ? hasCategory(p, slug) : name ? hasCategory(p, name) : false) return acc + 1;
            return acc;
          } catch { return acc; }
        }, 0);
      };

      if (isCategoriesLoading) {
        return <div className="text-zinc-500 text-center py-10">Loading categories...</div>;
      }
      if (!categories || categories.length === 0) {
        return <div className="text-center py-10 text-zinc-500">No categories available.</div>;
      }

      return (
        <div>
          <h2 className="text-2xl font-bold text-white mb-6">Browse by Category</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-3 auto-rows-[4.875rem] sm:auto-rows-[5.625rem] md:auto-rows-[6rem] grid-flow-row-dense">
            {categories.map((cat, idx) => {
              const color = gradients[idx % gradients.length];
              const shows = getCountForCategory(cat);
              const label = (cat.name || cat.title || cat.slug || '').toString();
              const slugOrName = (cat.slug || cat.name || '').toString().toLowerCase();

              const VAR_FULL = 'md:col-span-6 lg:col-span-8 xl:col-span-10';
              const VAR_XL = 'md:col-span-4 lg:col-span-6 xl:col-span-7';
              const VAR_L = 'md:col-span-3 lg:col-span-4 xl:col-span-5';
              const VAR_M = 'md:col-span-2 lg:col-span-3 xl:col-span-4';
              const VAR_S = 'md:col-span-2 lg:col-span-2 xl:col-span-3';

              const patternIdx = idx % 16;
              let sizeClass;
              switch (patternIdx) {
                case 0: sizeClass = VAR_FULL; break;
                case 1: sizeClass = VAR_XL; break;
                case 2: sizeClass = VAR_L; break;
                case 3: sizeClass = VAR_M; break;
                case 4: sizeClass = VAR_L; break;
                case 5: sizeClass = VAR_XL; break;
                case 6: sizeClass = VAR_S; break;
                case 7: sizeClass = VAR_M; break;
                case 8: sizeClass = VAR_XL; break;
                case 9: sizeClass = VAR_L; break;
                case 10: sizeClass = VAR_FULL; break;
                case 11: sizeClass = VAR_M; break;
                case 12: sizeClass = VAR_S; break;
                case 13: sizeClass = VAR_L; break;
                case 14: sizeClass = VAR_XL; break;
                case 15: sizeClass = VAR_M; break;
                default: sizeClass = VAR_M;
              }

              return (
                <div
                  key={cat.id || cat.slug || label}
                  className={`bg-gradient-to-br ${color} border border-white/[0.06] rounded-xl p-4 cursor-pointer hover:border-white/10 hover:-translate-y-0.5 transition-all duration-500 h-full ${sizeClass} flex flex-col justify-between`}
                  onClick={() => setSelectedCategory({ key: slugOrName, label, count: shows })}
                >
                  <h3 className="text-white font-bold text-sm md:text-base mb-1 truncate">{label.toUpperCase()}</h3>
                  <p className="text-white/50 text-xs">{shows} {shows === 1 ? 'show' : 'shows'}</p>
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
              <span className="text-sm text-zinc-500">{podcasts.length} shows</span>
            </div>
            <ShowGrid>
              {podcasts.map((podcast) => (
                <ShowCard key={podcast.id} podcast={podcast} onPlay={handlePodcastPlay} subtext={getEpCount(podcast)} />
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
              <span className="text-sm text-zinc-500">{books.length} titles</span>
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
              <span className="text-sm text-zinc-500">{membersOnly.length} shows</span>
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
              <span className="text-sm text-zinc-500">{freeContent.length} shows</span>
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
              <span className="text-sm text-zinc-500">{trending.length} {trending.length === 1 ? 'show' : 'shows'}</span>
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
    <div className="min-h-screen bg-eeriecast-surface text-white px-2.5 lg:px-10 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl md:text-5xl font-bold mb-2 bg-gradient-to-r from-white via-red-300 to-red-500 bg-clip-text text-transparent">
          Discover
        </h1>
        <p className="text-zinc-500 text-lg">Explore our entire collection</p>
      </div>

      {/* Tab Navigation */}
      <div className="mb-8 border-b border-white/[0.06]">
        <div className="flex space-x-4 sm:space-x-8 overflow-x-auto pb-px" style={{ scrollbarWidth: 'none', 'msOverflowStyle': 'none' }}>
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-shrink-0 pb-3 text-sm font-medium transition-all duration-300 border-b-2 ${
                activeTab === tab
                  ? "text-white border-red-600 drop-shadow-[0_2px_4px_rgba(220,38,38,0.3)]"
                  : "text-zinc-500 hover:text-white border-transparent"
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
