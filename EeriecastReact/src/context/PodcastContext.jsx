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
      // List payloads are shallower than detail payloads (no episodes,
      // sometimes no description), so any detail that was hydrated from
      // a previous detail call is now behind a shallower entry. Clear
      // the hydration flags so the next visit refetches detail.
      hydratedRef.current.clear();
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
      hydratedRef.current.clear();
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
      hydratedRef.current.clear();
      return true;
    } catch {
      return false;
    } finally {
      inflightSoftRefreshRef.current = false;
    }
  }, [fetchAllPodcasts]);

  const getById = useCallback((id) => byId[id], [byId]);

  // Keep `byId` readable from inside `ensureDetail` without making the
  // callback's identity change every time the list updates. Previously,
  // `ensureDetail` depended on `byId`, which created a subtle feedback
  // loop for consumers that include it in a `useEffect` deps array:
  //
  //   1. consumer effect runs → calls ensureDetail
  //   2. cache miss → setAllPodcasts(...) → byId rebuilds
  //   3. ensureDetail gets a new identity
  //   4. consumer effect re-runs → GOTO 1
  //
  // For shows whose backend payload doesn't satisfy the cache-hit check
  // (e.g. no description, empty episodes array — common for newly-seeded
  // music artists), step 2 fires on every invocation and the loop never
  // terminates. Visually: the show page flashes its loading skeleton in
  // and out forever.
  const byIdRef = useRef(byId);
  useEffect(() => { byIdRef.current = byId; }, [byId]);
  // Track which detail records have been hydrated in this session so the
  // cache check doesn't depend on fields the API may legitimately leave
  // null (description, empty episodes, etc.).
  const hydratedRef = useRef(new Map()); // id -> audioVariant

  const ensureDetail = useCallback(async (id) => {
    const audioVariant = isPremium ? 'premium' : 'free';
    const current = byIdRef.current[id];
    if (current && hydratedRef.current.get(id) === audioVariant) {
      return current;
    }
    const detail = await PodcastApi.get(id);
    const detailWithVariant = { ...detail, __audio_variant: audioVariant };
    hydratedRef.current.set(detailWithVariant.id, audioVariant);
    setAllPodcasts(prev => {
      const map = new Map(prev.map(p => [p.id, p]));
      map.set(detailWithVariant.id, { ...(map.get(detailWithVariant.id) || {}), ...detailWithVariant });
      return Array.from(map.values());
    });
    return detailWithVariant;
  }, [isPremium]);

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
