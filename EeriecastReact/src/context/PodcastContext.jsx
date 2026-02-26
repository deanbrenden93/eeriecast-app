import React, { useCallback, useEffect, useMemo, useRef, useState, useContext } from 'react';
import PropTypes from 'prop-types';
import { Podcast as PodcastApi, Creator } from '@/api/entities';
import { useUser } from '@/context/UserContext.jsx';

const PodcastContext = React.createContext(null);

export function PodcastProvider({ children }) {
  const { isPremium } = useUser();
  const [podcasts, setPodcasts] = useState([]);
  const [byId, setById] = useState({});
  const [featuredCreators, setFeaturedCreators] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const fetchedListRef = useRef(false);
  const lastFetchedAtRef = useRef(0);

  // Build byId when podcasts change
  useEffect(() => {
    const map = Object.create(null);
    for (const p of podcasts || []) {
      if (p && (p.id || p.slug)) {
        map[p.id ?? p.slug] = p;
      }
    }
    setById(map);
  }, [podcasts]);

  const loadAllOnce = useCallback(async () => {
    if (fetchedListRef.current) return; // already loaded
    setIsLoading(true);
    setError(null);
    try {
      const [resPodcasts, resCreators] = await Promise.all([
        PodcastApi.list('-created_date'),
        Creator.featured(),
      ]);

      const arr = Array.isArray(resPodcasts) ? resPodcasts : (resPodcasts?.results || []);
      const creatorsArr = Array.isArray(resCreators) ? resCreators : (resCreators?.results || []);

      console.log('PodcastProvider loaded', arr);
      setPodcasts(arr);
      setFeaturedCreators(creatorsArr);
      fetchedListRef.current = true;
      lastFetchedAtRef.current = Date.now();
    } catch (e) {
      setError(e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial load on mount
  useEffect(() => {
    loadAllOnce();
  }, [loadAllOnce]);

  const refreshAll = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [resPodcasts, resCreators] = await Promise.all([
        PodcastApi.list('-created_date'),
        Creator.featured(),
      ]);
      const arr = Array.isArray(resPodcasts) ? resPodcasts : (resPodcasts?.results || []);
      const creatorsArr = Array.isArray(resCreators) ? resCreators : (resCreators?.results || []);
      setPodcasts(arr);
      setFeaturedCreators(creatorsArr);
      fetchedListRef.current = true;
      lastFetchedAtRef.current = Date.now();
      return arr;
    } catch (e) {
      setError(e);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

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
    // Fetch detail and merge into state
    const detail = await PodcastApi.get(id);
    const detailWithVariant = { ...detail, __audio_variant: audioVariant };
    setPodcasts(prev => {
      const map = new Map(prev.map(p => [p.id, p]));
      map.set(detailWithVariant.id, { ...(map.get(detailWithVariant.id) || {}), ...detailWithVariant });
      return Array.from(map.values());
    });
    return detailWithVariant;
  }, [byId, isPremium]);

  const value = useMemo(() => ({
    podcasts,
    isLoading,
    error,
    lastFetchedAt: lastFetchedAtRef.current,
    getById,
    ensureDetail,
    refreshAll,
    featuredCreators,
  }), [podcasts, isLoading, error, getById, ensureDetail, refreshAll, featuredCreators]);

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
