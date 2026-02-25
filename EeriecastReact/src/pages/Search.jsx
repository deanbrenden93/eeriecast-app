import { useState, useEffect, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Search as SearchApi, Episode as EpisodeApi, UserLibrary } from "@/api/entities";
import { Button } from "@/components/ui/button";
import { Search as SearchIcon, Heart, Play, BookOpen, Headphones, Crown, ChevronRight } from "lucide-react";
import { isAudiobook, getPodcastCategoriesLower, formatDate } from "@/lib/utils";
import AddToPlaylistModal from "@/components/library/AddToPlaylistModal";
import { useUser } from "@/context/UserContext.jsx";
import { usePlaylistContext } from "@/context/PlaylistContext.jsx";
import { useAuthModal } from "@/context/AuthModalContext.jsx";
import { usePodcasts } from "@/context/PodcastContext.jsx";
import { useAudioPlayerContext } from "@/context/AudioPlayerContext";
import { FREE_FAVORITE_LIMIT } from "@/lib/freeTier";
import EpisodeMenu from "@/components/podcasts/EpisodeMenu";

/** Format duration — handles seconds (number), "HH:MM:SS" string, or "MM:SS" string */
function formatDuration(raw) {
  if (!raw && raw !== 0) return null;
  let totalSeconds;
  if (typeof raw === 'number') {
    totalSeconds = Math.floor(raw);
  } else if (typeof raw === 'string') {
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

/** Strip HTML tags and convert block-level boundaries to newlines */
function stripHtml(html) {
  if (!html || typeof html !== 'string') return '';
  // Replace block-level closing tags and <br> with newlines
  let text = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|div|li|h[1-6]|blockquote)>/gi, '\n')
    .replace(/<[^>]+>/g, '');
  // Decode common HTML entities
  text = text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
  // Collapse 3+ newlines into 2, trim
  return text.replace(/\n{3,}/g, '\n\n').trim();
}

/** Expandable description with "Show more / Show less" */
function ExpandableDescription({ text, maxLength = 150 }) {
  const [expanded, setExpanded] = useState(false);
  if (!text) return null;
  const clean = stripHtml(text);
  if (!clean) return null;
  const needsTruncation = clean.length > maxLength;
  const displayText = !needsTruncation || expanded ? clean : clean.slice(0, maxLength).trimEnd() + '…';

  return (
    <div className="mt-1.5">
      <p className="text-zinc-500 text-xs leading-relaxed whitespace-pre-line">{displayText}</p>
      {needsTruncation && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setExpanded(v => !v); }}
          className="text-red-400/80 hover:text-red-300 text-xs mt-0.5 transition-colors"
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  );
}

/* ── Show / Audiobook card ───────────────────────────────────────── */
function ShowCard({ podcast, onClick, isBook }) {
  return (
    <div className="group cursor-pointer" onClick={onClick}>
      <div className={`relative overflow-hidden rounded-xl bg-white/[0.03] border border-white/[0.06] mb-2.5 transition-all duration-300 group-hover:border-white/[0.12] group-hover:shadow-lg group-hover:shadow-black/30 ${
        isBook ? 'aspect-[3/4]' : 'aspect-square'
      }`}>
        {podcast.cover_image ? (
          <img src={podcast.cover_image} alt={podcast.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-white/[0.04] to-white/[0.01]">
            {isBook ? <BookOpen className="w-8 h-8 text-zinc-600" /> : <Headphones className="w-8 h-8 text-zinc-600" />}
          </div>
        )}
        {/* Hover overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-3">
          <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
            <Play className="w-4 h-4 text-white fill-white" />
          </div>
        </div>
      </div>
      <h3 className="text-white/90 font-semibold text-xs md:text-sm line-clamp-2 mb-0.5 group-hover:text-white transition-colors">{podcast.title}</h3>
      <p className="text-zinc-500 text-[11px]">{podcast.author || 'Eeriecast'}</p>
    </div>
  );
}

/* ── Episode card ────────────────────────────────────────────────── */
function EpisodeCard({ episode, onPlay, onAddToPlaylist, onShowLink, isAuthenticated, isPremium, favoriteEpisodeIds, refreshFavorites, openAuth }) {
  const formattedDur = formatDuration(episode.duration);
  const isFav = favoriteEpisodeIds.has(episode.id);

  const handleFavorite = async () => {
    if (!isAuthenticated) {
      openAuth('login');
      return;
    }
    const alreadyFav = favoriteEpisodeIds.has(episode.id);
    // Free-tier limit check (only when adding)
    if (!alreadyFav && !isPremium && favoriteEpisodeIds.size >= FREE_FAVORITE_LIMIT) {
      window.location.assign('/Premium');
      return;
    }
    try {
      if (alreadyFav) {
        await UserLibrary.removeFavorite('episode', episode.id);
      } else {
        await UserLibrary.addFavorite('episode', episode.id);
      }
      await refreshFavorites();
    } catch (err) {
      if (typeof console !== 'undefined') console.debug('search favorite toggle failed', err);
    }
  };

  return (
    <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3 md:p-4 hover:bg-white/[0.05] hover:border-white/[0.1] transition-all duration-300 group">
      <div className="flex items-start gap-3 md:gap-4">
        {/* Cover */}
        <div
          className="relative w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-lg overflow-hidden bg-white/[0.04] flex-shrink-0 cursor-pointer group/thumb ring-1 ring-white/[0.06]"
          onClick={onPlay}
        >
          {episode.cover_image ? (
            <img src={episode.cover_image} alt={episode.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-white/[0.06] to-white/[0.02]">
              <Headphones className="w-5 h-5 text-zinc-600" />
            </div>
          )}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center">
            <Play className="w-5 h-5 text-white fill-white" />
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h3
                className="text-white/90 font-semibold text-sm md:text-base truncate hover:text-white cursor-pointer transition-colors"
                onClick={onPlay}
              >
                {episode.title}
              </h3>
              {episode.podcast_id ? (
                <button
                  type="button"
                  className="text-red-400/80 hover:text-red-300 text-[11px] md:text-xs font-semibold uppercase tracking-wide mb-1 transition-colors text-left"
                  onClick={(e) => { e.stopPropagation(); onShowLink(); }}
                >
                  {episode.podcast_title || episode.podcast_author || ''}
                </button>
              ) : (
                <p className="text-red-400/80 text-[11px] md:text-xs font-semibold uppercase tracking-wide mb-1">
                  {episode.podcast_title || episode.podcast_author || ''}
                </p>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-0.5 flex-shrink-0">
              <EpisodeMenu
                episode={episode}
                podcast={{ id: episode.podcast_id || episode.podcast, title: episode.podcast_title }}
                onAddToPlaylist={onAddToPlaylist}
              />
              <button
                className={`p-1.5 transition-colors rounded-lg hover:bg-white/[0.04] ${isFav ? 'text-red-500' : 'text-zinc-600 hover:text-white'}`}
                title={isFav ? 'Remove from favorites' : 'Favorite'}
                onClick={handleFavorite}
              >
                <Heart className={`w-4 h-4 ${isFav ? 'fill-current' : ''}`} />
              </button>
              <button
                className="p-1.5 text-zinc-600 hover:text-red-400 transition-colors rounded-lg hover:bg-white/[0.04]"
                title="Play"
                onClick={onPlay}
              >
                <Play className="w-4 h-4 fill-current" />
              </button>
            </div>
          </div>

          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-x-2 md:gap-x-3 gap-y-1 text-[11px] md:text-xs text-zinc-500">
            {episode.published_at && (
              <span>{formatDate(episode.published_at)}</span>
            )}
            {formattedDur && (
              <>
                <span className="text-zinc-700">·</span>
                <span>{formattedDur}</span>
              </>
            )}
            {episode.episode_number && (
              <>
                <span className="text-zinc-700 hidden md:inline">·</span>
                <span className="hidden md:inline">Ep. {episode.episode_number}</span>
              </>
            )}
            {episode.is_premium && (
              <>
                <span className="text-zinc-700">·</span>
                <span className="inline-flex items-center gap-1 text-amber-400/80 text-[10px] font-semibold">
                  <Crown className="w-2.5 h-2.5" /> PREMIUM
                </span>
              </>
            )}
          </div>

          {/* Description */}
          <ExpandableDescription text={episode.description} maxLength={160} />
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   SEARCH PAGE
   ═══════════════════════════════════════════════════════════════════ */
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
  const [showAddModal, setShowAddModal] = useState(false);
  const [episodeToAdd, setEpisodeToAdd] = useState(null);
  const { isAuthenticated, isPremium, favoriteEpisodeIds, refreshFavorites } = useUser();
  const { playlists, addPlaylist, updatePlaylist } = usePlaylistContext();
  const { openAuth } = useAuthModal();
  const { loadAndPlay } = useAudioPlayerContext();

  const tabs = ["All Content", "Podcasts", "Episodes", "Audiobooks", "Members Only"];


  const performSearch = useCallback(async (query) => {
    setIsLoading(true);
    const lowerQuery = (query || '').toLowerCase();

    // --- Client-side podcast search ---
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

    // --- Episode search (multi-source: dedicated API + client-side fallback) ---
    if (activeTab !== "Podcasts" && activeTab !== "Audiobooks") {
      const seenIds = new Set();
      let allEpisodes = [];

      const enrichEpisode = (ep) => {
        const podId = ep.podcast_id || ep.podcast;
        const podcastData = podId ? getById(podId) : null;
        return {
          ...ep,
          podcast_id: podId,
          podcast_title: ep.podcast_title || podcastData?.title || '',
          podcast_author: ep.podcast_author || podcastData?.author || '',
          podcast_cover_image: ep.podcast_cover_image || podcastData?.cover_image || '',
          cover_image: ep.cover_image || podcastData?.cover_image || '',
        };
      };

      const addUnique = (episodes) => {
        for (const ep of episodes) {
          const key = ep.id || ep.slug || `${ep.title}-${ep.podcast_id || ep.podcast}`;
          if (!seenIds.has(key)) {
            seenIds.add(key);
            allEpisodes.push(enrichEpisode(ep));
          }
        }
      };

      // Fire all API sources in parallel — each is individually try/caught so one failure doesn't block the rest
      const [epSearchResult, generalSearchResult, episodeFilterResult] = await Promise.allSettled([
        // Source 1: Dedicated episode search endpoint (/search/episodes/)
        SearchApi.searchEpisodes(query),
        // Source 2: General search endpoint (/search/)
        SearchApi.search(query),
        // Source 3: Episodes list with search filter (/episodes/?search=)
        EpisodeApi.filter({ search: query }, null, 50),
      ]);

      // Process Source 1
      if (epSearchResult.status === 'fulfilled') {
        const epResp = epSearchResult.value;
        const epResults = Array.isArray(epResp) ? epResp : (epResp?.results || epResp?.episodes || []);
        addUnique(epResults);
      } else {
        console.error('Episode search endpoint failed:', epSearchResult.reason);
      }

      // Process Source 2 — try multiple response shapes
      if (generalSearchResult.status === 'fulfilled') {
        const searchResp = generalSearchResult.value;
        // Shape A: { episodes: [...] }
        if (Array.isArray(searchResp?.episodes)) {
          addUnique(searchResp.episodes);
        }
        // Shape B: { results: [...] } — flat list that may contain episode objects
        if (Array.isArray(searchResp?.results)) {
          const episodeLike = searchResp.results.filter(r =>
            r.type === 'episode' || r.episode_number != null || r.audio_file || r.audio_url
          );
          addUnique(episodeLike);
        }
        // Shape C: direct array
        if (Array.isArray(searchResp)) {
          const episodeLike = searchResp.filter(r =>
            r.type === 'episode' || r.episode_number != null || r.audio_file || r.audio_url
          );
          addUnique(episodeLike);
        }
      } else {
        console.error('General search endpoint failed:', generalSearchResult.reason);
      }

      // Process Source 3 — /episodes/?search= (standard DRF search filter)
      if (episodeFilterResult.status === 'fulfilled') {
        const filterResp = episodeFilterResult.value;
        const filterResults = Array.isArray(filterResp) ? filterResp : (filterResp?.results || []);
        addUnique(filterResults);
      } else {
        console.error('Episode filter endpoint failed:', episodeFilterResult.reason);
      }

      // Source 4: Client-side search across loaded podcast episodes (instant, no network)
      for (const podcast of source) {
        if (!Array.isArray(podcast.episodes)) continue;
        const matchingEps = podcast.episodes.filter(ep => {
          const t = ep.title?.toLowerCase() || '';
          const d = ep.description?.toLowerCase() || '';
          return t.includes(lowerQuery) || d.includes(lowerQuery);
        });
        const enriched = matchingEps.map(ep => ({
          ...ep,
          podcast_id: ep.podcast_id || ep.podcast || podcast.id,
          podcast: ep.podcast || podcast.id,
        }));
        addUnique(enriched);
      }

      let filteredEpisodes = allEpisodes;
      if (activeTab === "Members Only") {
        filteredEpisodes = allEpisodes.filter(ep => ep.is_premium);
      }

      setEpisodeResults(filteredEpisodes);
    } else {
      setEpisodeResults([]);
    }

    setIsLoading(false);
  }, [contextPodcasts, activeTab, getById]);

  useEffect(() => {
    if (podcastsLoading) return;
    if (searchQuery.trim()) {
      performSearch(searchQuery);
    } else {
      setShowResults([]);
      setEpisodeResults([]);
    }
  }, [searchQuery, performSearch, podcastsLoading]);

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) performSearch(searchQuery);
  };

  const handlePodcastPlay = (podcast) => {
    if (podcast?.id) navigate(`${createPageUrl('Episodes')}?id=${encodeURIComponent(podcast.id)}`);
  };

  const handleEpisodePlay = async (episode) => {
    const podcastData = episode.podcast_id ? getById(episode.podcast_id) : null;
    if (podcastData) {
      await loadAndPlay({ podcast: podcastData, episode, resume: { progress: 0 } });
    } else if (episode.podcast_id) {
      navigate(`${createPageUrl('Episodes')}?id=${encodeURIComponent(episode.podcast_id)}`);
    }
  };

  const openAddToPlaylist = (episode) => {
    if (!isAuthenticated) { openAuth('login'); return; }
    // Playlists are a premium feature
    if (!isPremium) { window.location.assign('/Premium'); return; }
    setEpisodeToAdd(episode);
    setShowAddModal(true);
  };

  // ── Derived result arrays ───────────────────────────────────────
  const podcastShows = showResults.filter(p => !isAudiobook(p));
  const audiobookShows = showResults.filter(p => isAudiobook(p));
  const totalResults = showResults.length + episodeResults.length;

  // Limit items on "All Content" to keep it scannable
  const ALL_CONTENT_LIMIT = 6;
  const isAllTab = activeTab === "All Content";

  // ── Section renderers ───────────────────────────────────────────

  const renderShowGrid = (shows, label, tabName, isBookGrid = false, limit) => {
    if (shows.length === 0) return null;
    const capped = limit ? shows.slice(0, limit) : shows;
    const hasMore = limit && shows.length > limit;

    return (
      <section className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg md:text-xl font-bold text-white/90">{label} <span className="text-zinc-600 font-normal text-base">({shows.length})</span></h2>
          {hasMore && (
            <button
              type="button"
              onClick={() => setActiveTab(tabName)}
              className="inline-flex items-center gap-1 text-xs text-red-400/80 hover:text-red-300 font-medium transition-colors"
            >
              View all <ChevronRight className="w-3 h-3" />
            </button>
          )}
        </div>
        <div className={`grid gap-3 md:gap-4 ${
          isBookGrid
            ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'
            : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8'
        }`}>
          {capped.map((podcast) => (
            <ShowCard key={podcast.id} podcast={podcast} isBook={isBookGrid} onClick={() => handlePodcastPlay(podcast)} />
          ))}
        </div>
      </section>
    );
  };

  const renderEpisodeList = (episodes, limit) => {
    if (episodes.length === 0) return null;
    const capped = limit ? episodes.slice(0, limit) : episodes;
    const hasMore = limit && episodes.length > limit;

    return (
      <section className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg md:text-xl font-bold text-white/90">Episodes <span className="text-zinc-600 font-normal text-base">({episodes.length})</span></h2>
          {hasMore && (
            <button
              type="button"
              onClick={() => setActiveTab("Episodes")}
              className="inline-flex items-center gap-1 text-xs text-red-400/80 hover:text-red-300 font-medium transition-colors"
            >
              View all <ChevronRight className="w-3 h-3" />
            </button>
          )}
        </div>
        <div className="space-y-2.5">
          {capped.map((episode) => (
            <EpisodeCard
              key={episode.id}
              episode={episode}
              onPlay={() => handleEpisodePlay(episode)}
              onAddToPlaylist={openAddToPlaylist}
              onShowLink={() => navigate(`${createPageUrl('Episodes')}?id=${encodeURIComponent(episode.podcast_id)}`)}
              isAuthenticated={isAuthenticated}
              isPremium={isPremium}
              favoriteEpisodeIds={favoriteEpisodeIds}
              refreshFavorites={refreshFavorites}
              openAuth={openAuth}
            />
          ))}
        </div>
      </section>
    );
  };

  const renderResults = () => {
    if (activeTab === "All Content") {
      // Show all three sections with caps
      return (
        <>
          {renderShowGrid(podcastShows, "Shows", "Podcasts", false, ALL_CONTENT_LIMIT)}
          {renderShowGrid(audiobookShows, "Audiobooks", "Audiobooks", true, ALL_CONTENT_LIMIT)}
          {renderEpisodeList(episodeResults, ALL_CONTENT_LIMIT)}
        </>
      );
    }
    if (activeTab === "Podcasts") {
      return renderShowGrid(podcastShows, "Shows", "Podcasts");
    }
    if (activeTab === "Audiobooks") {
      return renderShowGrid(audiobookShows, "Audiobooks", "Audiobooks", true);
    }
    if (activeTab === "Episodes") {
      return renderEpisodeList(episodeResults);
    }
    if (activeTab === "Members Only") {
      return (
        <>
          {renderShowGrid(showResults, "Members-Only Shows", "Members Only")}
          {renderEpisodeList(episodeResults)}
        </>
      );
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-eeriecast-surface text-white px-4 lg:px-10 py-8">
      {/* ─── Header ─────────────────────────────────────────────── */}
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6">Search</h1>

        {/* Search input */}
        <form onSubmit={handleSearch} className="mb-6">
          <div className="relative max-w-2xl">
            <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 w-4 h-4 md:w-5 md:h-5 pointer-events-none" />
            <input
              type="text"
              placeholder="Search shows, episodes, audiobooks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 md:pl-12 pr-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.06] text-white placeholder-zinc-500 text-sm md:text-base focus:outline-none focus:border-red-500/40 focus:ring-1 focus:ring-red-500/20 transition-all"
            />
          </div>
        </form>

        {/* Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-full text-xs md:text-sm font-medium transition-all duration-300 whitespace-nowrap border ${
                activeTab === tab
                  ? "bg-gradient-to-r from-red-600 to-red-700 text-white border-red-500/30 shadow-lg shadow-red-900/20"
                  : "bg-white/[0.03] text-zinc-400 border-white/[0.06] hover:bg-white/[0.06] hover:text-zinc-200"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* ─── Results summary ────────────────────────────────────── */}
      {searchQuery && !isLoading && (
        <div className="mb-6">
          <p className="text-sm text-zinc-400">
            {totalResults} {totalResults === 1 ? 'result' : 'results'} for <span className="text-white/80 font-medium">&quot;{searchQuery}&quot;</span>
          </p>
        </div>
      )}

      {/* ─── Results ────────────────────────────────────────────── */}
      <div className="pb-32">
        {isLoading ? (
          <div className="text-center py-16">
            <div className="w-8 h-8 border-2 border-red-500/30 border-t-red-500 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-zinc-500 text-sm">Searching...</p>
          </div>
        ) : searchQuery && totalResults === 0 ? (
          <div className="text-center py-16">
            <SearchIcon className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
            <p className="text-zinc-400 text-lg mb-1">No results found</p>
            <p className="text-zinc-600 text-sm">Try different keywords or browse our categories</p>
          </div>
        ) : searchQuery ? (
          renderResults()
        ) : (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mx-auto mb-5">
              <SearchIcon className="w-7 h-7 text-zinc-600" />
            </div>
            <p className="text-zinc-400 text-lg mb-1">Start typing to search</p>
            <p className="text-zinc-600 text-sm">Find shows, episodes, and audiobooks</p>
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
          if (action === 'created') addPlaylist(pl);
          if (action === 'updated') updatePlaylist(pl);
        }}
      />
    </div>
  );
}
