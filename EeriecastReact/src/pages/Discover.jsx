import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useLocation } from 'react-router-dom';
import { createPageUrl } from "@/utils";
import { Podcast, Playlist, UserLibrary, Category, Episode } from "@/api/entities";
import ShowCard from "../components/discover/ShowCard";
import BookCard from "../components/discover/BookCard";
import EpisodesTable from "@/components/podcasts/EpisodesTable";
import ShowGrid from "@/components/ui/ShowGrid";
import { isAudiobook, hasCategory, getEpisodeAudioUrl, getPodcastCategoriesLower } from "@/lib/utils";
import AddToPlaylistModal from "@/components/library/AddToPlaylistModal";
import SubscribeModal from "@/components/auth/SubscribeModal";
import { useUser } from '@/context/UserContext.jsx';
import { usePodcasts } from '@/context/PodcastContext.jsx';
import { useAuthModal } from '@/context/AuthModalContext.jsx';
import { useAudioPlayerContext } from "@/context/AudioPlayerContext";
import { useToast } from "@/components/ui/use-toast";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { X, Loader2 } from "lucide-react";

/* ─────────────────────────── helpers ─────────────────────────── */

// TODO [PRE-LAUNCH]: These frontend overrides for is_exclusive must be migrated to the
// Django backend (set is_exclusive=True on podcast IDs 10 & 4 in the admin panel) and
// this client-side workaround removed. The backend currently returns is_exclusive=false
// for these podcasts despite them being members-only content.
// See also: Podcasts.jsx has the same override.
const MEMBERS_ONLY_OVERRIDES = new Set([
  10, // Unexplained Encounters AFTER HOURS
  4,  // Manmade Monsters
]);

function applyExclusiveOverride(podcast) {
  if (!podcast) return podcast;
  if (MEMBERS_ONLY_OVERRIDES.has(podcast.id) && !podcast.is_exclusive) {
    return { ...podcast, is_exclusive: true };
  }
  return podcast;
}

function applyExclusiveOverrides(list) {
  return list.map(applyExclusiveOverride);
}

const getEpCount = (podcast) => {
  const n = podcast?.episodes_count ?? podcast?.episode_count ?? null;
  if (typeof n === 'number' && !Number.isNaN(n)) return `${n} Episode${n === 1 ? '' : 's'}`;
  return '';
};

/* ─────────────────────── filter toolbar ─────────────────────── */

const selectTriggerClass = "h-8 w-auto min-w-[7rem] gap-1.5 rounded-full border-white/[0.06] bg-white/[0.03] px-3.5 text-xs font-medium text-zinc-300 hover:bg-white/[0.06] hover:border-white/[0.1] hover:text-white focus:ring-0 focus:ring-offset-0 transition-all duration-300 data-[placeholder]:text-zinc-500 [&>svg]:h-3.5 [&>svg]:w-3.5 [&>svg]:text-zinc-500";
const selectContentClass = "border-white/[0.08] bg-[#18181f] shadow-xl shadow-black/40 rounded-lg";
const selectItemClass = "text-xs text-zinc-400 focus:bg-white/[0.06] focus:text-white rounded-md cursor-pointer";

function FilterDropdown({ value, options, onChange, placeholder }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={selectTriggerClass}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className={selectContentClass}>
        {options.map(opt => (
          <SelectItem key={opt.value} value={opt.value} className={selectItemClass}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function FilterPill({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`h-8 px-3.5 rounded-full text-xs font-medium transition-all duration-300 border ${
        active
          ? "bg-white/[0.08] border-white/[0.12] text-white"
          : "bg-white/[0.02] border-white/[0.04] text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.05] hover:border-white/[0.08]"
      }`}
    >
      {label}
    </button>
  );
}

function SectionHeader({ title, subtitle, count, countLabel = "items", children }) {
  return (
    <div className="mb-6">
      <div className="flex items-baseline gap-3 mb-1">
        <h2 className="text-xl font-semibold text-white">{title}</h2>
        {typeof count === 'number' && (
          <span className="text-xs text-zinc-600 font-medium tabular-nums">{count} {count === 1 ? countLabel.replace(/s$/, '') : countLabel}</span>
        )}
      </div>
      {subtitle && <p className="text-sm text-zinc-500 mb-4">{subtitle}</p>}
      {children && (
        <div className="flex items-center gap-2 flex-wrap mt-3">
          {children}
        </div>
      )}
    </div>
  );
}

function EpisodeFilterBar({ podcasts, categories, filters, onFilterChange, resultCount }) {
  const showOptions = useMemo(() => [
    { value: "all", label: "All Shows" },
    ...podcasts.map(p => ({ value: String(p.id), label: p.title }))
  ], [podcasts]);

  const categoryOptions = useMemo(() => [
    { value: "all", label: "All Categories" },
    ...categories.map(c => ({ value: c.slug || c.name, label: c.name }))
  ], [categories]);

  const sortOptions = [
    { value: "newest", label: "Newest" },
    { value: "oldest", label: "Oldest" },
  ];

  const hasActiveFilters = filters.show !== "all" || filters.category !== "all" || filters.access !== "all";

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <FilterDropdown value={filters.show} options={showOptions} onChange={(v) => onFilterChange({ ...filters, show: v })} placeholder="Show" />
      <FilterDropdown value={filters.category} options={categoryOptions} onChange={(v) => onFilterChange({ ...filters, category: v })} placeholder="Category" />
      <FilterDropdown value={filters.sort} options={sortOptions} onChange={(v) => onFilterChange({ ...filters, sort: v })} placeholder="Sort" />
      <div className="flex items-center gap-1.5">
        <FilterPill label="All" active={filters.access === "all"} onClick={() => onFilterChange({ ...filters, access: "all" })} />
        <FilterPill label="Free" active={filters.access === "free"} onClick={() => onFilterChange({ ...filters, access: "free" })} />
        <FilterPill label="Members" active={filters.access === "members"} onClick={() => onFilterChange({ ...filters, access: "members" })} />
      </div>
      {hasActiveFilters && (
        <button
          onClick={() => onFilterChange({ show: "all", category: "all", sort: filters.sort, access: "all" })}
          className="inline-flex items-center gap-1 text-[11px] text-zinc-600 hover:text-zinc-300 transition-colors"
        >
          <X className="w-3 h-3" />
          Reset
        </button>
      )}
    </div>
  );
}

function ShowFilterBar({ categories, filters, onFilterChange }) {
  const categoryOptions = useMemo(() => [
    { value: "all", label: "All Categories" },
    ...categories.map(c => ({ value: c.slug || c.name, label: c.name }))
  ], [categories]);

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <FilterDropdown value={filters.category} options={categoryOptions} onChange={(v) => onFilterChange({ ...filters, category: v })} placeholder="Category" />
      {filters.category !== "all" && (
        <button
          onClick={() => onFilterChange({ ...filters, category: "all" })}
          className="inline-flex items-center gap-1 text-[11px] text-zinc-600 hover:text-zinc-300 transition-colors"
        >
          <X className="w-3 h-3" />
          Reset
        </button>
      )}
    </div>
  );
}

/* ──────────────────── infinite scroll sentinel ──────────────────── */

function InfiniteScrollSentinel({ onVisible }) {
  const ref = useRef(null);
  const firedRef = useRef(false);

  useEffect(() => {
    // Reset fired flag when onVisible changes (new render cycle)
    firedRef.current = false;
  }, [onVisible]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !firedRef.current) {
          firedRef.current = true;
          onVisible();
        }
      },
      { rootMargin: '300px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [onVisible]);

  return (
    <div ref={ref} className="flex items-center justify-center py-4">
      <Loader2 className="w-5 h-5 animate-spin text-zinc-600" />
    </div>
  );
}

/* ─────────────────────────── main ─────────────────────────── */

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
  const { podcasts: rawPodcasts, isLoading, getById } = usePodcasts();
  const [playlists, setPlaylists] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [episodeToAdd, setEpisodeToAdd] = useState(null);
  const [categories, setCategories] = useState([]);
  const [isCategoriesLoading, setIsCategoriesLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [showSubscribeModal, setShowSubscribeModal] = useState(false);
  const [subscribeLabel, setSubscribeLabel] = useState("");

  // Episode data for episode-based tabs (progressively loaded)
  const [fetchedEpisodes, setFetchedEpisodes] = useState([]);
  const [episodesLoading, setEpisodesLoading] = useState(true);
  const [allEpisodesFetched, setAllEpisodesFetched] = useState(false);
  const [totalEpisodeCount, setTotalEpisodeCount] = useState(0);
  const [listeningHistory, setListeningHistory] = useState([]);
  const fetchCancelledRef = useRef(false);

  // Display pagination — render 20 at a time
  const DISPLAY_PAGE_SIZE = 20;
  const [displayCount, setDisplayCount] = useState(DISPLAY_PAGE_SIZE);

  // Filters
  const [episodeFilters, setEpisodeFilters] = useState({ show: "all", category: "all", sort: "newest", access: "all" });
  const [showFilters, setShowFilters] = useState({ category: "all" });
  const [bookFilters, setBookFilters] = useState({ category: "all", sort: "newest" });

  const { favoritePodcastIds, user, refreshFavorites, isPremium, isAuthenticated } = useUser();
  const { openAuth } = useAuthModal();
  const { loadAndPlay } = useAudioPlayerContext();
  const { toast } = useToast();

  // Apply members-only overrides to podcasts
  const podcasts = useMemo(() => applyExclusiveOverrides(rawPodcasts), [rawPodcasts]);

  // Build podcast lookup map
  const podcastMap = useMemo(() => {
    const map = {};
    for (const p of podcasts) {
      if (p?.id) map[p.id] = p;
    }
    return map;
  }, [podcasts]);

  /* ─── data loading ─── */

  useEffect(() => {
    Playlist.list().then(resp => {
      setPlaylists(Array.isArray(resp) ? resp : (resp?.results || []));
    }).catch(() => setPlaylists([]));

    (async () => {
      try {
        setIsCategoriesLoading(true);
        const resp = await Category.list();
        setCategories(Array.isArray(resp) ? resp : (resp?.results || []));
      } catch { setCategories([]); } finally { setIsCategoriesLoading(false); }
    })();
  }, []);

  // Progressively fetch ALL episodes in background (page_size=100 batches)
  useEffect(() => {
    fetchCancelledRef.current = false;
    const API_PAGE_SIZE = 100;
    let page = 1;
    let accumulated = [];

    (async () => {
      setEpisodesLoading(true);
      while (!fetchCancelledRef.current) {
        try {
          const resp = await Episode.filter({ page_size: API_PAGE_SIZE, page }, '-published_at');
          if (fetchCancelledRef.current) break;
          const results = Array.isArray(resp) ? resp : (resp?.results || []);
          const total = resp?.count ?? 0;
          if (page === 1) setTotalEpisodeCount(total);
          if (results.length === 0) break;

          accumulated = [...accumulated, ...results];
          setFetchedEpisodes([...accumulated]);

          // After first page, the UI has enough to show — stop blocking
          if (page === 1) setEpisodesLoading(false);

          if (accumulated.length >= total || results.length < API_PAGE_SIZE) break;
          page++;
        } catch {
          break;
        }
      }
      if (!fetchCancelledRef.current) {
        setAllEpisodesFetched(true);
        setEpisodesLoading(false);
      }
    })();

    return () => { fetchCancelledRef.current = true; };
  }, []);

  // Fetch listening history for recommendations (authenticated users only)
  useEffect(() => {
    if (!isAuthenticated) return;
    (async () => {
      try {
        const resp = await UserLibrary.getHistory();
        const list = Array.isArray(resp) ? resp : (resp?.results || []);
        setListeningHistory(list);
      } catch {
        setListeningHistory([]);
      }
    })();
  }, [isAuthenticated]);

  // Reset filters and display count when tab changes
  useEffect(() => {
    setEpisodeFilters({ show: "all", category: "all", sort: "newest", access: "all" });
    setShowFilters({ category: "all" });
    setBookFilters({ category: "all", sort: "newest" });
    setDisplayCount(DISPLAY_PAGE_SIZE);
  }, [activeTab]);

  /* ─── episode filtering ─── */

  const filterEpisodes = useCallback((episodes, filters) => {
    let filtered = [...episodes];

    // Filter by show
    if (filters.show !== "all") {
      const showId = Number(filters.show);
      filtered = filtered.filter(ep => ep.podcast === showId || ep.podcast_id === showId);
    }

    // Filter by access (members/free)
    if (filters.access === "members") {
      filtered = filtered.filter(ep => {
        const podcast = podcastMap[ep.podcast || ep.podcast_id];
        return ep.is_premium || podcast?.is_exclusive;
      });
    } else if (filters.access === "free") {
      filtered = filtered.filter(ep => {
        const podcast = podcastMap[ep.podcast || ep.podcast_id];
        return !ep.is_premium && !podcast?.is_exclusive;
      });
    }

    // Filter by category (of the parent podcast)
    if (filters.category !== "all") {
      filtered = filtered.filter(ep => {
        const podcast = podcastMap[ep.podcast || ep.podcast_id];
        return podcast && hasCategory(podcast, filters.category);
      });
    }

    // Sort
    if (filters.sort === "oldest") {
      filtered.sort((a, b) => new Date(a.published_at || a.created_at) - new Date(b.published_at || b.created_at));
    } else {
      filtered.sort((a, b) => new Date(b.published_at || b.created_at) - new Date(a.published_at || a.created_at));
    }

    return filtered;
  }, [podcastMap]);

  const filterShows = useCallback((shows, filters) => {
    if (filters.category === "all") return shows;
    return shows.filter(p => hasCategory(p, filters.category));
  }, []);

  /* ─── filter out audiobook episodes ─── */

  const nonAudiobookEpisodes = useMemo(() => {
    return fetchedEpisodes.filter(ep => {
      const podcast = podcastMap[ep.podcast || ep.podcast_id];
      return !podcast || !isAudiobook(podcast);
    });
  }, [fetchedEpisodes, podcastMap]);

  /* ─── recommended episodes (all, scored) ─── */

  const recommendedEpisodes = useMemo(() => {
    if (!nonAudiobookEpisodes.length) return [];

    // Extract context from listening history
    const historyPodcastIds = new Set();
    const historyCategories = new Set();

    for (const item of listeningHistory) {
      const epDetail = item?.episode_detail || item?.episode;
      const podId = epDetail?.podcast || item?.podcast_id || item?.podcast;
      if (podId) {
        historyPodcastIds.add(Number(podId));
        const podcast = podcastMap[podId];
        if (podcast) {
          for (const cat of getPodcastCategoriesLower(podcast)) {
            historyCategories.add(cat);
          }
        }
      }
    }

    // If user has no history, return all episodes by recency (they can browse)
    if (listeningHistory.length === 0) {
      return nonAudiobookEpisodes;
    }

    // Score each episode based on relevance to history
    const scored = nonAudiobookEpisodes.map(ep => {
      const podId = ep.podcast || ep.podcast_id;
      const podcast = podcastMap[podId];
      let score = 0;

      // Boost if from a podcast user has listened to
      if (historyPodcastIds.has(Number(podId))) score += 10;

      // Boost if podcast shares categories with listening history
      if (podcast) {
        const podCats = getPodcastCategoriesLower(podcast);
        for (const cat of podCats) {
          if (historyCategories.has(cat)) score += 3;
        }
      }

      // Small boost for recency
      const age = Date.now() - new Date(ep.published_at || ep.created_at).getTime();
      const dayAge = age / (1000 * 60 * 60 * 24);
      if (dayAge < 7) score += 5;
      else if (dayAge < 30) score += 2;

      // Small boost for play_count
      score += Math.min((ep.play_count || 0) * 0.1, 5);

      return { ep, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.map(s => s.ep);
  }, [nonAudiobookEpisodes, listeningHistory, podcastMap]);

  /* ─── trending episodes (capped at 100) ─── */

  const trendingEpisodes = useMemo(() => {
    return [...nonAudiobookEpisodes]
      .sort((a, b) => (b.play_count || 0) - (a.play_count || 0))
      .slice(0, 100);
  }, [nonAudiobookEpisodes]);

  /* ─── play handlers ─── */

  const handleEpisodePlay = async (episode, podcast) => {
    if (!episode) return;
    const p = podcast || podcastMap[episode.podcast || episode.podcast_id];

    if ((episode.is_premium || p?.is_exclusive) && !isPremium) {
      setSubscribeLabel(episode.title || p?.title || 'Premium episode');
      setShowSubscribeModal(true);
      return;
    }

    const played = await loadAndPlay({
      podcast: p || { id: episode.podcast || episode.podcast_id },
      episode,
      resume: { progress: 0 },
    });
    if (played === false) {
      toast({
        title: "Unable to play",
        description: "Please sign in to play episodes.",
        variant: "destructive",
      });
    }
  };

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
      console.debug('discover play failed', e);
    }
  };

  const handleOpenAddToPlaylist = async (item) => {
    if (!isAuthenticated) { openAuth('login'); return; }
    if (item?.id) {
      setEpisodeToAdd(item);
      setShowAddModal(true);
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
      console.debug('podcast favorite failed', err);
    }
  };

  /* ─── render helpers ─── */

  // Enrich an episode with its parent podcast object for EpisodesTable
  const enrichEpisode = useCallback((ep) => {
    if (!ep) return ep;
    const pod = applyExclusiveOverride(podcastMap[ep.podcast || ep.podcast_id]);
    if (pod && (!ep.podcast || typeof ep.podcast !== 'object')) {
      return { ...ep, podcast: pod };
    }
    return ep;
  }, [podcastMap]);

  const renderEpisodeList = (episodes, heading, subtitle = null, emptyMessage = "No episodes found.", maxCap = Infinity) => {
    const filtered = filterEpisodes(episodes, episodeFilters);
    const capped = maxCap < Infinity ? filtered.slice(0, maxCap) : filtered;
    const visible = capped.slice(0, displayCount).map(enrichEpisode);
    const hasMore = capped.length > displayCount;
    const stillLoading = !allEpisodesFetched && maxCap === Infinity;

    return (
      <div>
        <SectionHeader title={heading} subtitle={subtitle} count={capped.length} countLabel="episodes">
          <EpisodeFilterBar
            podcasts={podcasts.filter(p => !isAudiobook(p))}
            categories={categories}
            filters={episodeFilters}
            onFilterChange={(f) => { setEpisodeFilters(f); setDisplayCount(DISPLAY_PAGE_SIZE); }}
            resultCount={capped.length}
          />
        </SectionHeader>
        {visible.length === 0 ? (
          <div className="text-center py-16 text-zinc-500">{emptyMessage}</div>
        ) : (
          <EpisodesTable
            episodes={visible}
            show={null}
            onPlay={(ep) => handleEpisodePlay(ep, ep.podcast)}
            onAddToPlaylist={handleOpenAddToPlaylist}
          />
        )}

        {/* Infinite scroll sentinel + loading indicator */}
        {hasMore && (
          <InfiniteScrollSentinel onVisible={() => setDisplayCount(prev => prev + DISPLAY_PAGE_SIZE)} />
        )}
        {stillLoading && (
          <div className="flex items-center justify-center gap-2 text-xs text-zinc-500 mt-6">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Loading more episodes...
            <span>({fetchedEpisodes.length}{totalEpisodeCount ? ` of ${totalEpisodeCount}` : ''})</span>
          </div>
        )}
      </div>
    );
  };

  const renderShowList = (shows, heading, emptyMessage = "No shows found.") => {
    const filtered = filterShows(shows, showFilters);
    return (
      <div>
        <SectionHeader title={heading} count={filtered.length} countLabel="shows">
          <ShowFilterBar
            categories={categories}
            filters={showFilters}
            onFilterChange={setShowFilters}
          />
        </SectionHeader>
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-zinc-500">{emptyMessage}</div>
        ) : (
          <ShowGrid>
            {filtered.map(podcast => (
              <ShowCard key={podcast.id} podcast={podcast} onPlay={handlePodcastPlay} subtext={getEpCount(podcast)} />
            ))}
          </ShowGrid>
        )}
      </div>
    );
  };

  /* ─── audiobooks view ─── */

  const renderBookList = (books) => {
    let filtered = [...books];

    // Category filter
    if (bookFilters.category !== "all") {
      filtered = filtered.filter(p => hasCategory(p, bookFilters.category));
    }

    // Sort
    if (bookFilters.sort === "oldest") {
      filtered.sort((a, b) => new Date(a.created_date || 0) - new Date(b.created_date || 0));
    } else {
      filtered.sort((a, b) => new Date(b.created_date || 0) - new Date(a.created_date || 0));
    }

    const sortOptions = [
      { value: "newest", label: "Newest First" },
      { value: "oldest", label: "Oldest First" },
    ];

    const categoryOptions = [
      { value: "all", label: "All Categories" },
      ...categories.map(c => ({ value: c.slug || c.name, label: c.name })),
    ];

    return (
      <div>
        <SectionHeader title="Audiobook Collection" count={filtered.length} countLabel="titles">
          <FilterDropdown value={bookFilters.category} options={categoryOptions} onChange={(v) => setBookFilters(prev => ({ ...prev, category: v }))} placeholder="Category" />
          <FilterDropdown value={bookFilters.sort} options={sortOptions} onChange={(v) => setBookFilters(prev => ({ ...prev, sort: v }))} placeholder="Sort" />
          {bookFilters.category !== "all" && (
            <button
              onClick={() => setBookFilters(prev => ({ ...prev, category: "all" }))}
              className="inline-flex items-center gap-1 text-[11px] text-zinc-600 hover:text-zinc-300 transition-colors"
            >
              <X className="w-3 h-3" />
              Reset
            </button>
          )}
        </SectionHeader>

        {filtered.length === 0 ? (
          <div className="text-center py-16 text-zinc-500">No audiobooks found.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filtered.map(book => (
              <BookCard key={book.id} podcast={book} />
            ))}
          </div>
        )}
      </div>
    );
  };

  /* ─── categories view ─── */

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
          <ShowGrid>
            {filtered.map(podcast => (
              <ShowCard key={podcast.id} podcast={podcast} onPlay={handlePodcastPlay} subtext={getEpCount(podcast)} />
            ))}
          </ShowGrid>
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

  /* ─── main render ─── */

  const renderContent = () => {
    if (isLoading || episodesLoading) {
      return (
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-20 bg-eeriecast-surface-light/50 rounded-xl animate-pulse" />
          ))}
        </div>
      );
    }

    switch (activeTab) {
      case "Recommended":
        return renderEpisodeList(
          recommendedEpisodes,
          "Recommended for You",
          "Personalized picks based on your listening history",
          isAuthenticated
            ? "No recommendations yet. Listen to some episodes to get personalized suggestions."
            : "Sign in to get personalized recommendations based on your listening history."
        );
      case "Newest":
        return renderEpisodeList(nonAudiobookEpisodes, "Latest Episodes", "The most recently published episodes across all shows");
      case "Trending":
        return renderEpisodeList(trendingEpisodes, "Trending Now", "Episodes with the most listens right now", "No trending episodes at the moment.", 100);
      case "Podcasts":
        return renderShowList(podcasts.filter(p => !isAudiobook(p)), "All Podcasts", "No podcasts found.");
      case "Books":
        return renderBookList(podcasts.filter(p => isAudiobook(p)));
      case "Members-Only": {
        const membersOnly = podcasts.filter(p => p.is_exclusive);
        return renderShowList(membersOnly, "Members-Only", "No members-only content found.");
      }
      case "Free": {
        const freeContent = podcasts.filter(p => !p.is_exclusive);
        return renderShowList(freeContent, "Free Content", "No free content found.");
      }
      case "Categories":
        return selectedCategory ? renderCategoryDetailView() : renderCategoriesView();
      default:
        return renderEpisodeList(recommendedEpisodes, "Recommended for You");
    }
  };

  return (
    <div className="min-h-screen bg-eeriecast-surface text-white px-2.5 lg:px-10 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl md:text-5xl font-bold mb-2 text-white">
          Discover
        </h1>
        <p className="text-zinc-500 text-lg">Explore our entire collection</p>
      </div>

      {/* Tab Navigation */}
      <div className="mb-8 border-b border-white/[0.06]">
        <div className="flex space-x-4 sm:space-x-8 overflow-x-auto pb-px" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-shrink-0 pb-3 text-sm font-medium transition-all duration-300 border-b-2 ${
                activeTab === tab
                  ? "text-white border-white"
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
