import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { createPageUrl } from "@/utils";
import { Podcast, UserLibrary, Category, Episode } from "@/api/entities";
import { qk } from "@/lib/queryClient";
import ShowCard from "../components/discover/ShowCard";
import EpisodesTable from "@/components/podcasts/EpisodesTable";
import ShowGrid from "@/components/ui/ShowGrid";
import { isAudiobook, isMusic, hasCategory, getEpisodeAudioUrl, getPodcastCategoriesLower } from "@/lib/utils";
import AddToPlaylistModal from "@/components/library/AddToPlaylistModal";
import { useUser } from '@/context/UserContext.jsx';
import { usePlaylistContext } from '@/context/PlaylistContext.jsx';
import { usePodcasts } from '@/context/PodcastContext.jsx';
import { useAuthModal } from '@/context/AuthModalContext.jsx';
import { useAudioPlayerContext } from "@/context/AudioPlayerContext";
import { useToast } from "@/components/ui/use-toast";
import { FREE_FAVORITE_LIMIT, canAccessExclusiveEpisode } from "@/lib/freeTier";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { X, Loader2, ArrowLeft } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { getCategoryStyle, normalizeCategoryKey } from "@/lib/categoryStyles";

/* ─────────────────────────── helpers ─────────────────────────── */

// `is_exclusive` is now sourced exclusively from the backend admin panel.
// (Previously this file hard-coded podcast IDs 10 and 4 as members-only
// to work around a backend that was returning the wrong value — those
// overrides have been removed now that the Django admin is the single
// source of truth.)

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
  const navigate = useNavigate();
  const tabs = [
    "Recommended", "Podcasts", "Members-Only", "Free", "Newest", "Categories", "Trending"
  ];
  const queryTab = (() => {
    try {
      const params = new URLSearchParams(location.search);
      const raw = params.get('tab');
      if (!raw) return null;
      return tabs.find(t => t.toLowerCase() === raw.toLowerCase()) || null;
    } catch { return null; }
  })();

  const queryCategoryParam = (() => {
    try {
      const params = new URLSearchParams(location.search);
      return (params.get('category') || '').toLowerCase() || null;
    } catch { return null; }
  })();

  const [activeTab, setActiveTab] = useState(queryTab || "Recommended");
  const { podcasts: rawPodcasts, isLoading, getById, softRefreshIfStale } = usePodcasts();
  const [showAddModal, setShowAddModal] = useState(false);
  const [episodeToAdd, setEpisodeToAdd] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const goToPremium = () => navigate(createPageUrl('Premium'));

  // Display pagination — render 20 at a time
  const DISPLAY_PAGE_SIZE = 20;
  const [displayCount, setDisplayCount] = useState(DISPLAY_PAGE_SIZE);

  // Filters
  const [episodeFilters, setEpisodeFilters] = useState({ show: "all", category: "all", sort: "newest", access: "all" });
  const [showFilters, setShowFilters] = useState({ category: "all" });

  const { favoritePodcastIds, favoriteEpisodeIds, user, refreshFavorites, isPremium, isAuthenticated } = useUser();
  const { playlists, addPlaylist, updatePlaylist } = usePlaylistContext();
  const { openAuth } = useAuthModal();
  const { loadAndPlay } = useAudioPlayerContext();
  const { toast } = useToast();

  // Apply members-only overrides to podcasts
  const podcasts = rawPodcasts;

  // Build podcast lookup map
  const podcastMap = useMemo(() => {
    const map = {};
    for (const p of podcasts) {
      if (p?.id) map[p.id] = p;
    }
    return map;
  }, [podcasts]);

  /* ─── data loading (TanStack Query) ─── */

  // Categories — cached app-wide. Revalidates on focus by default, so edits
  // made in the backend admin surface within a minute of returning to the tab.
  const { data: categoriesData = [], isLoading: isCategoriesLoading } = useQuery({
    queryKey: ['categories', 'list'],
    queryFn: async () => {
      const resp = await Category.list();
      return Array.isArray(resp) ? resp : (resp?.results || []);
    },
  });

  const categories = categoriesData;

  // Keep the podcast list fresh when the user returns to this page. Runs on
  // mount and whenever the tab regains focus. Categories have their own
  // cache-driven refetch (refetchOnWindowFocus is on by default).
  useEffect(() => {
    const refresh = () => { softRefreshIfStale(60_000); };
    refresh();
    const onFocus = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [softRefreshIfStale]);

  // Progressively fetch ALL episodes in background. Each page is a separate
  // cache entry so revisiting the Discover page is instant. A background
  // effect below keeps pulling the next page until everything is loaded.
  const API_PAGE_SIZE = 100;
  const {
    data: episodePages,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: isEpisodesInitialLoading,
  } = useInfiniteQuery({
    queryKey: qk.episodes.allPaginated({ ordering: '-published_at', pageSize: API_PAGE_SIZE }),
    queryFn: async ({ pageParam = 1 }) => {
      const resp = await Episode.filter({ page_size: API_PAGE_SIZE, page: pageParam }, '-published_at');
      return resp;
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const results = Array.isArray(lastPage) ? lastPage : (lastPage?.results || []);
      if (results.length < API_PAGE_SIZE) return undefined;
      const total = lastPage?.count ?? null;
      if (total != null) {
        const accumulated = allPages.reduce((sum, p) => {
          const r = Array.isArray(p) ? p : (p?.results || []);
          return sum + r.length;
        }, 0);
        if (accumulated >= total) return undefined;
      }
      return allPages.length + 1;
    },
  });

  // Auto-advance pagination in the background until every page is cached.
  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const rawFetchedEpisodes = useMemo(() => {
    const pages = episodePages?.pages || [];
    return pages.flatMap((p) => (Array.isArray(p) ? p : (p?.results || [])));
  }, [episodePages]);

  const fetchedEpisodes = rawFetchedEpisodes;

  const totalEpisodeCount = episodePages?.pages?.[0]?.count ?? rawFetchedEpisodes.length;
  const allEpisodesFetched = !hasNextPage && !isFetchingNextPage;
  // Loading is only true during the initial fetch — background pagination
  // doesn't block the UI because we already have something to render.
  const episodesLoading = isEpisodesInitialLoading && rawFetchedEpisodes.length === 0;

  // Listening history — cached and only fetched for authenticated users.
  const { data: listeningHistory = [] } = useQuery({
    queryKey: ['library', 'history', 'full'],
    queryFn: async () => {
      const resp = await UserLibrary.getHistory();
      return Array.isArray(resp) ? resp : (resp?.results || []);
    },
    enabled: isAuthenticated,
  });

  // Dedicated trending feed — fetched on demand when the Trending tab opens.
  // Mirrors the home screen's "Trending Now" row so both surfaces stay in sync.
  const { data: trendingApiEpisodes = [] } = useQuery({
    queryKey: qk.episodes.feed('trending-full', { limit: 100, windowHours: 48 }),
    queryFn: async () => {
      const resp = await Episode.trending(100, 48);
      return Array.isArray(resp) ? resp : (resp?.results || []);
    },
    enabled: activeTab === "Trending",
  });

  // Reset filters and display count when tab changes
  useEffect(() => {
    setEpisodeFilters({ show: "all", category: "all", sort: "newest", access: "all" });
    setShowFilters({ category: "all" });
    setDisplayCount(DISPLAY_PAGE_SIZE);
  }, [activeTab]);

  // Pre-select a category from URL param (e.g. ?tab=Categories&category=paranormal).
  // Uses a ref to track the last applied param so it only fires once per unique value,
  // preventing re-selection when the user clicks "Back to Categories".
  const lastAppliedCategoryParam = useRef(null);
  // Remember the scroll position on the category grid so we can restore it
  // when the user clicks "Back to Categories" from a category detail view.
  const categoriesGridScrollRef = useRef(0);

  useEffect(() => {
    if (
      queryCategoryParam &&
      queryCategoryParam !== lastAppliedCategoryParam.current &&
      activeTab === "Categories" &&
      categories.length > 0
    ) {
      lastAppliedCategoryParam.current = queryCategoryParam;
      const match = categories.find(c => {
        const slug = (c.slug || '').toLowerCase();
        const name = (c.name || '').toLowerCase();
        return slug === queryCategoryParam || name === queryCategoryParam;
      });
      if (match) {
        const slug = (match.slug || match.name || '').toLowerCase();
        const label = (match.name || match.title || match.slug || '').toString();
        const shows = match.podcast_count ?? match.count ?? match.total ?? null;
        setSelectedCategory({ key: slug, label, count: shows });
      }
    }
  }, [queryCategoryParam, activeTab, categories]);

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

  /* ─── filter out audiobook + music episodes ─── */
  // Audiobooks and music each have their own landing pages; keep their
  // episodes out of the generic podcast feeds so listeners don't encounter
  // a chapter or track in a line-up of spoken-word shows.
  const nonAudiobookEpisodes = useMemo(() => {
    return fetchedEpisodes.filter(ep => {
      const podcast = podcastMap[ep.podcast || ep.podcast_id];
      if (!podcast) return true;
      return !isAudiobook(podcast) && !isMusic(podcast);
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

  // Trending: prefer the backend's dedicated `/episodes/trending/` endpoint
  // (same feed the home screen's "Trending Now" row uses — scored by recent
  // PlaybackEvent activity, with a server-side fallback to newest when
  // volume is low). If we haven't loaded it yet, fall back to the newest
  // non-audiobook episodes so the tab is never empty.
  const trendingEpisodes = useMemo(() => {
    const excludedIds = new Set(
      podcasts.filter(p => isAudiobook(p) || isMusic(p)).map(p => p.id)
    );
    const getPodId = (ep) => (typeof ep.podcast === 'object' ? ep.podcast?.id : (ep.podcast || ep.podcast_id));
    const filteredApi = (trendingApiEpisodes || []).filter(ep => !excludedIds.has(getPodId(ep)));

    if (filteredApi.length >= 10) return filteredApi.slice(0, 100);

    // Backfill: merge any API results with newest non-audiobook episodes
    // (de-duped) so there's always a useful list to display.
    const existingIds = new Set(filteredApi.map(ep => ep.id));
    const newestFallback = [...nonAudiobookEpisodes].sort(
      (a, b) => new Date(b.published_at || b.created_at) - new Date(a.published_at || a.created_at)
    );
    const merged = [
      ...filteredApi,
      ...newestFallback.filter(ep => !existingIds.has(ep.id)),
    ];
    return merged.slice(0, 100);
  }, [trendingApiEpisodes, nonAudiobookEpisodes, podcasts]);

  /* ─── play handlers ─── */

  const handleEpisodePlay = async (episode, podcast) => {
    if (!episode) return;
    const p = podcast || podcastMap[episode.podcast || episode.podcast_id];

    // Individual premium episode gate
    if (episode.is_premium && !isPremium) {
      goToPremium();
      return;
    }
    // Exclusive show gate — only the admin-assigned free sample is playable
    if (p?.is_exclusive && !isPremium) {
      if (!canAccessExclusiveEpisode(episode, p, isPremium)) {
        goToPremium();
        return;
      }
    }

    const played = await loadAndPlay({
      podcast: p || { id: episode.podcast || episode.podcast_id },
      episode,
      resume: { progress: 0 },
    });
    if (played === false) {
      toast({
        title: "Unable to play",
        description: isAuthenticated
          ? "This episode doesn't have audio available yet."
          : "Please sign in to play episodes.",
        variant: "destructive",
      });
    }
  };

  const handlePodcastPlay = async (podcast) => {
    try {
      if (!podcast?.id) return;
      // Audiobooks and music artist pages drive playback from the show
      // detail page, not an inline "play the latest" action — route there.
      if (isAudiobook(podcast) || isMusic(podcast)) {
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
        goToPremium();
        return;
      }
      await loadAndPlay({ podcast, episode: ep, resume });
    } catch (e) {
      console.debug('discover play failed', e);
    }
  };

  const handleOpenAddToPlaylist = async (item) => {
    if (!isAuthenticated) { openAuth('login'); return; }
    // Playlists are a premium feature
    if (!isPremium) { navigate(createPageUrl('Premium')); return; }
    if (item?.id) {
      setEpisodeToAdd(item);
      setShowAddModal(true);
    }
  };

  const onFavoriteClick = async (podcast) => {
    if (!podcast?.id) return;
    const userId = user?.id || user?.user?.id || user?.pk;
    if (!userId || !isAuthenticated) { openAuth('login'); return; }
    // Free users can have up to FREE_FAVORITE_LIMIT favorites; premium is unlimited
    if (!isPremium && favoriteEpisodeIds.size >= FREE_FAVORITE_LIMIT) {
      toast({
        title: "Favorite limit reached",
        description: `Free accounts can save up to ${FREE_FAVORITE_LIMIT} favorites. Upgrade to premium for unlimited.`,
        variant: "destructive",
      });
      return;
    }
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
    const pod = podcastMap[ep.podcast || ep.podcast_id];
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
            podcasts={podcasts.filter(p => !isAudiobook(p) && !isMusic(p))}
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

  /* ─── categories view ─── */

  const handleEnterCategory = useCallback((payload) => {
    // Remember scroll position so we can restore it on back.
    try { categoriesGridScrollRef.current = window.scrollY || 0; } catch { /* noop */ }
    setSelectedCategory(payload);
  }, []);

  const handleExitCategory = useCallback(() => {
    setSelectedCategory(null);
    lastAppliedCategoryParam.current = null;
    // Clear the category URL param so a page refresh shows the grid.
    const params = new URLSearchParams(location.search);
    if (params.has('category')) {
      params.delete('category');
      navigate(`${location.pathname}?${params.toString()}`, { replace: true });
    }
    // Restore scroll position after the grid remounts.
    const y = categoriesGridScrollRef.current || 0;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        try { window.scrollTo({ top: y, left: 0, behavior: 'auto' }); } catch { /* noop */ }
      });
    });
  }, [location.pathname, location.search, navigate]);

  const renderCategoryDetailView = () => {
    const selKey = normalizeCategoryKey(selectedCategory?.key);
    const filtered = podcasts.filter(p => {
      if (!selKey) return true;
      if (selKey === 'audiobook' || selKey === 'audiobooks') return isAudiobook(p);
      if (selKey === 'music') return isMusic(p);
      if (selKey === 'free') return !p.is_exclusive && !isAudiobook(p) && !isMusic(p);
      if (selKey === 'members-only' || selKey === 'members_only') return p.is_exclusive || isAudiobook(p);
      return hasCategory(p, selKey);
    });
    const heading = (selectedCategory?.label || selKey || 'All').toString();
    const style = getCategoryStyle({ slug: selKey });
    const Icon = style.icon;

    return (
      <motion.div
        key="category-detail"
        initial={{ opacity: 0, x: 16 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -12 }}
        transition={{ duration: 0.28, ease: [0.25, 0.1, 0.25, 1] }}
      >
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={handleExitCategory}
            className="group inline-flex items-center gap-2 pl-3 pr-4 py-2 rounded-full bg-white/[0.04] hover:bg-white/[0.08] text-white/80 hover:text-white border border-white/[0.06] hover:border-white/[0.12] transition-all duration-300"
            aria-label="Back to categories"
          >
            <ArrowLeft className="w-4 h-4 transition-transform duration-300 group-hover:-translate-x-0.5" />
            <span className="text-sm font-medium">Back to Categories</span>
          </button>
        </div>
        {/* Hero-ish heading block using the category's theme */}
        <div className={`relative overflow-hidden rounded-2xl border ${style.border} bg-gradient-to-br ${style.gradient} p-5 md:p-6 mb-6`}>
          <div className={`absolute -top-10 -right-10 w-40 h-40 rounded-full ${style.iconBg} blur-3xl opacity-50 pointer-events-none`} />
          <div className="relative flex items-center gap-4">
            <div className={`flex-shrink-0 w-12 h-12 md:w-14 md:h-14 rounded-2xl ${style.iconBg} border ${style.border} flex items-center justify-center`}>
              <Icon className={`w-6 h-6 md:w-7 md:h-7 ${style.iconColor}`} strokeWidth={1.75} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold tracking-[0.2em] text-white/40 uppercase mb-1">Category</p>
              <h2 className="text-2xl md:text-3xl font-bold text-white truncate">{heading}</h2>
              <p className="text-xs md:text-sm text-white/50 mt-1">{filtered.length} {filtered.length === 1 ? 'show' : 'shows'}</p>
            </div>
          </div>
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
      </motion.div>
    );
  };

  const renderCategoriesView = () => {
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
      return (
        <motion.div
          key="category-loading"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="text-zinc-500 text-center py-10"
        >
          Loading categories...
        </motion.div>
      );
    }
    if (!categories || categories.length === 0) {
      return (
        <motion.div
          key="category-empty"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="text-center py-10 text-zinc-500"
        >
          No categories available.
        </motion.div>
      );
    }

    return (
      <motion.div
        key="category-grid"
        initial={{ opacity: 0, x: -12 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 16 }}
        transition={{ duration: 0.28, ease: [0.25, 0.1, 0.25, 1] }}
      >
        <div className="mb-5">
          <h2 className="text-2xl md:text-3xl font-bold text-white">Browse by Category</h2>
          <p className="text-zinc-500 text-sm mt-1">Tap a category to see every show in it.</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-2.5 md:gap-3">
          {categories.map((cat, idx) => {
            const shows = getCountForCategory(cat);
            const label = (cat.name || cat.title || cat.slug || '').toString();
            const slugOrName = (cat.slug || cat.name || '').toString().toLowerCase();
            const style = getCategoryStyle(cat);
            const Icon = style.icon;

            return (
              <motion.button
                key={cat.id || cat.slug || label}
                type="button"
                onClick={() => handleEnterCategory({ key: slugOrName, label, count: shows })}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: Math.min(idx * 0.02, 0.24), ease: [0.25, 0.1, 0.25, 1] }}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.97 }}
                className={`group relative overflow-hidden text-left bg-gradient-to-br ${style.gradient} border ${style.border} hover:border-white/15 rounded-xl p-3 md:p-3.5 h-[4.25rem] md:h-[4.5rem] flex items-center gap-3 transition-colors duration-300 shadow-md shadow-black/20 ${style.glow} hover:shadow-lg`}
              >
                {/* ambient glow */}
                <div className={`absolute -top-4 -right-4 w-16 h-16 rounded-full ${style.iconBg} blur-2xl opacity-60 group-hover:opacity-90 transition-opacity duration-500`} />
                {/* shimmer */}
                <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/[0.04] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />

                <div className={`relative z-10 flex-shrink-0 ${style.iconBg} rounded-lg p-1.5 border ${style.border} group-hover:scale-110 transition-transform duration-300`}>
                  <Icon className={`w-4 h-4 ${style.iconColor}`} strokeWidth={1.75} />
                </div>

                <div className="relative z-10 min-w-0 flex-1">
                  <h3 className="text-white font-bold text-[11px] md:text-xs uppercase tracking-wider truncate leading-tight">
                    {label}
                  </h3>
                  <p className="text-[10px] text-white/40 mt-0.5 truncate">
                    {shows} {shows === 1 ? 'show' : 'shows'}
                  </p>
                </div>
              </motion.button>
            );
          })}
        </div>
      </motion.div>
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
        return renderEpisodeList(
          trendingEpisodes,
          "Trending Now",
          "Episodes picking up steam — falls back to the newest releases when it's quiet.",
          "No trending episodes at the moment.",
          100
        );
      case "Podcasts":
        return renderShowList(
          podcasts.filter(p => !isAudiobook(p) && !isMusic(p)),
          "All Podcasts",
          "No podcasts found.",
        );
      case "Members-Only": {
        // Audiobooks live behind the member paywall alongside exclusive
        // shows; music artists surface via their own landing page.
        const membersOnly = podcasts.filter(p => (p.is_exclusive || isAudiobook(p)) && !isMusic(p));
        return renderShowList(membersOnly, "Members-Only", "No members-only content found.");
      }
      case "Free": {
        // The Free tab is strictly for freely-listenable podcasts (no
        // exclusive shows, no audiobooks, no music — all of which have
        // their own dedicated surfaces).
        const freeContent = podcasts.filter(p => !p.is_exclusive && !isAudiobook(p) && !isMusic(p));
        return renderShowList(freeContent, "Free Content", "No free content found.");
      }
      case "Categories":
        return (
          <AnimatePresence mode="wait" initial={false}>
            {selectedCategory ? renderCategoryDetailView() : renderCategoriesView()}
          </AnimatePresence>
        );
      default:
        return renderEpisodeList(recommendedEpisodes, "Recommended for You");
    }
  };

  return (
    <div className="min-h-screen bg-eeriecast-surface text-white px-2.5 lg:px-10 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl md:text-5xl font-bold mb-2 text-white">
          Podcasts
        </h1>
        <p className="text-zinc-500 text-lg">Our entire collection of shows</p>
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
          if (action === 'created') addPlaylist(pl);
          if (action === 'updated') updatePlaylist(pl);
        }}
      />

    </div>
  );
}
