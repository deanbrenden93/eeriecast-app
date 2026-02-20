import React, { useCallback, useMemo, useState, useContext } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import PropTypes from 'prop-types';
import { Podcast as PodcastApi, Creator } from '@/api/entities';

const PodcastContext = React.createContext(null);

async function fetchPodcastsAndCreators() {
  const [resPodcasts, resCreators] = await Promise.all([
    PodcastApi.list('-created_date'),
    Creator.featured(),
  ]);
  const podcasts = Array.isArray(resPodcasts) ? resPodcasts : (resPodcasts?.results || []);
  const creators = Array.isArray(resCreators) ? resCreators : (resCreators?.results || []);
  return { podcasts, creators };
}

export function PodcastProvider({ children }) {
  const queryClient = useQueryClient();

  // TanStack Query owns the fetch lifecycle — automatic caching, staleness, dedup, refetch-on-focus
  const { data, isLoading, error } = useQuery({
    queryKey: ['podcastsAndCreators'],
    queryFn: fetchPodcastsAndCreators,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const podcasts = data?.podcasts ?? [];
  const featuredCreators = data?.creators ?? [];

  // Local state for merged detail data (e.g. after ensureDetail enriches a podcast)
  const [detailOverrides, setDetailOverrides] = useState({});

  const mergedPodcasts = useMemo(() => {
    if (Object.keys(detailOverrides).length === 0) return podcasts;
    return podcasts.map((p) => detailOverrides[p.id] ? { ...p, ...detailOverrides[p.id] } : p);
  }, [podcasts, detailOverrides]);

  const byId = useMemo(() => {
    const map = Object.create(null);
    for (const p of mergedPodcasts) {
      if (p && (p.id || p.slug)) {
        map[p.id ?? p.slug] = p;
      }
    }
    return map;
  }, [mergedPodcasts]);

  const getById = useCallback((id) => byId[id], [byId]);

  const ensureDetail = useCallback(async (id) => {
    const current = byId[id];
    if (current && Array.isArray(current.episodes) && current.episodes.length > 0 && current.description != null) {
      return current;
    }
    const detail = await PodcastApi.get(id);
    setDetailOverrides((prev) => ({ ...prev, [detail.id]: detail }));
    return detail;
  }, [byId]);

  const refreshAll = useCallback(async () => {
    setDetailOverrides({});
    const result = await queryClient.fetchQuery({
      queryKey: ['podcastsAndCreators'],
      queryFn: fetchPodcastsAndCreators,
    });
    return result?.podcasts ?? [];
  }, [queryClient]);

  const value = useMemo(() => ({
    podcasts: mergedPodcasts,
    isLoading,
    error,
    getById,
    ensureDetail,
    refreshAll,
    featuredCreators,
  }), [mergedPodcasts, isLoading, error, getById, ensureDetail, refreshAll, featuredCreators]);

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
