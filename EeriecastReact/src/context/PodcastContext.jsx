import React, { useCallback, useEffect, useMemo, useRef, useState, useContext } from 'react';
import PropTypes from 'prop-types';
import { Podcast as PodcastApi, Creator } from '@/api/entities';
import { useUser } from '@/context/UserContext.jsx';
import { filterMaturePodcasts, isMaturePodcast } from '@/lib/utils';

const PodcastContext = React.createContext(null);

export function PodcastProvider({ children }) {
  const { isPremium, canViewMature } = useUser();
  const [allPodcasts, setAllPodcasts] = useState([]);
  const [byId, setById] = useState({});
  const [featuredCreators, setFeaturedCreators] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const fetchedListRef = useRef(false);
  const lastFetchedAtRef = useRef(0);

  // Derived: podcasts visible to the current user (hides mature for non-adult users)
  const podcasts = useMemo(
    () => filterMaturePodcasts(allPodcasts, canViewMature),
    [allPodcasts, canViewMature],
  );

  // Set of IDs for podcasts tagged as mature (built from unfiltered list)
  const maturePodcastIds = useMemo(() => {
    const ids = new Set();
    for (const p of allPodcasts) {
      if (p?.id && isMaturePodcast(p)) ids.add(p.id);
    }
    return ids;
  }, [allPodcasts]);

  // Build byId when visible podcasts change
  useEffect(() => {
    const map = Object.create(null);
    for (const p of podcasts || []) {
      if (p && (p.id || p.slug)) {
        map[p.id ?? p.slug] = p;
      }
    }
    setById(map);
  }, [podcasts]);

  /**
   * Fetch every podcast by paginating through all pages. DRF defaults to
   * page_size=20 server-side, so without this any show past the 20th would
   * be invisible to the app — category filters would silently miss them.
   * We request the max page_size (100) and follow pages until we've seen
   * everything, using the `count` field when available and falling back
   * to "partial page = done" when it isn't.
   */
  const fetchAllPodcasts = useCallback(async () => {
    const PAGE_SIZE = 100;
    const first = await PodcastApi.filter({ page_size: PAGE_SIZE, page: 1 }, '-created_date');
    // Non-paginated response (unlikely, but keep it resilient).
    if (Array.isArray(first)) return first;
    const firstResults = first?.results || [];
    const total = typeof first?.count === 'number' ? first.count : null;
    const accumulated = [...firstResults];
    let page = 1;
    while (
      (total != null ? accumulated.length < total : firstResults.length === PAGE_SIZE)
      && accumulated.length > 0
    ) {
      page += 1;
      try {
        const next = await PodcastApi.filter({ page_size: PAGE_SIZE, page }, '-created_date');
        const nextResults = Array.isArray(next) ? next : (next?.results || []);
        if (nextResults.length === 0) break;
        accumulated.push(...nextResults);
        if (nextResults.length < PAGE_SIZE) break;
        if (total != null && accumulated.length >= total) break;
      } catch {
        break;
      }
    }
    return accumulated;
  }, []);

  const loadAllOnce = useCallback(async () => {
    if (fetchedListRef.current) return;
    setIsLoading(true);
    setError(null);
    try {
      const [podcastsArr, resCreators] = await Promise.all([
        fetchAllPodcasts(),
        Creator.featured(),
      ]);
      const creatorsArr = Array.isArray(resCreators) ? resCreators : (resCreators?.results || []);

      setAllPodcasts(podcastsArr);
      setFeaturedCreators(creatorsArr);
      fetchedListRef.current = true;
      lastFetchedAtRef.current = Date.now();
    } catch (e) {
      setError(e);
    } finally {
      setIsLoading(false);
    }
  }, [fetchAllPodcasts]);

  // Initial load on mount
  useEffect(() => {
    loadAllOnce();
  }, [loadAllOnce]);

  const refreshAll = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [podcastsArr, resCreators] = await Promise.all([
        fetchAllPodcasts(),
        Creator.featured(),
      ]);
      const creatorsArr = Array.isArray(resCreators) ? resCreators : (resCreators?.results || []);
      setAllPodcasts(podcastsArr);
      setFeaturedCreators(creatorsArr);
      fetchedListRef.current = true;
      lastFetchedAtRef.current = Date.now();
      return podcastsArr;
    } catch (e) {
      setError(e);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [fetchAllPodcasts]);

  /**
   * Refetch the podcast list in the background — no loading spinner, no UI
   * flicker — when cached data is older than `maxAgeMs`. Lets pages like
   * Discover pick up newly-added categories/shows without forcing a hard
   * reload, without hammering the API on every mount.
   * Returns true if a refresh actually happened.
   */
  const inflightSoftRefreshRef = useRef(false);
  const softRefreshIfStale = useCallback(async (maxAgeMs = 60_000) => {
    const age = Date.now() - (lastFetchedAtRef.current || 0);
    if (age < maxAgeMs) return false;
    if (inflightSoftRefreshRef.current) return false;
    inflightSoftRefreshRef.current = true;
    try {
      const [podcastsArr, resCreators] = await Promise.all([
        fetchAllPodcasts(),
        Creator.featured(),
      ]);
      const creatorsArr = Array.isArray(resCreators) ? resCreators : (resCreators?.results || []);
      setAllPodcasts(podcastsArr);
      setFeaturedCreators(creatorsArr);
      lastFetchedAtRef.current = Date.now();
      return true;
    } catch {
      return false;
    } finally {
      inflightSoftRefreshRef.current = false;
    }
  }, [fetchAllPodcasts]);

  const getById = useCallback((id) => byId[id], [byId]);

  const ensureDetail = useCallback(async (id) => {
    const audioVariant = isPremium ? 'premium' : 'free';
    // If we already have full detail (episodes + description), return cached
    const current = byId[id];
    if (
      current
      && Array.isArray(current.episodes)
      && current.episodes.length > 0
      && current.description != null
      && current.__audio_variant === audioVariant
    ) {
      return current;
    }
    const detail = await PodcastApi.get(id);
    const detailWithVariant = { ...detail, __audio_variant: audioVariant };
    setAllPodcasts(prev => {
      const map = new Map(prev.map(p => [p.id, p]));
      map.set(detailWithVariant.id, { ...(map.get(detailWithVariant.id) || {}), ...detailWithVariant });
      return Array.from(map.values());
    });
    return detailWithVariant;
  }, [byId, isPremium]);

  const value = useMemo(() => ({
    podcasts,
    maturePodcastIds,
    isLoading,
    error,
    lastFetchedAt: lastFetchedAtRef.current,
    getById,
    ensureDetail,
    refreshAll,
    softRefreshIfStale,
    featuredCreators,
  }), [podcasts, maturePodcastIds, isLoading, error, getById, ensureDetail, refreshAll, softRefreshIfStale, featuredCreators]);

  return (
    <PodcastContext.Provider value={value}>
      {children}
    </PodcastContext.Provider>
  );
}

PodcastProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export function usePodcasts() {
  const ctx = useContext(PodcastContext);
  if (!ctx) throw new Error('usePodcasts must be used within a PodcastProvider');
  return ctx;
}
