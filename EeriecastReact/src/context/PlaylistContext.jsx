import React, { useCallback, useEffect, useMemo, useRef, useState, useContext } from 'react';
import PropTypes from 'prop-types';
import { Playlist as PlaylistApi, Episode as EpisodeApi } from '@/api/entities';
import { useUser } from '@/context/UserContext.jsx';

const PlaylistContext = React.createContext(null);

// ── Module-scoped episode cache ────────────────────────────────────
//
// Used by the playlist surfaces (Library card mosaics, hero mosaic,
// detail page) to dedupe `Episode.get(id)` calls across navigations
// and across components rendered in the same view. Without this,
// switching to the Playlists tab refetches every cover tile from
// scratch, every time, and the mosaic visibly fills tile-by-tile.
//
// Two-tier:
//   • `episodeCache` — resolved episode objects, keyed by id.
//   • `episodeInflight` — in-flight `Episode.get` promises, keyed by
//     id. If two components ask for the same episode while the
//     first request is still pending, they share the promise instead
//     of firing a second request.
//
// `getEpisodesBatch` parallelizes via `Promise.all` AND dedupes
// against both tiers, so a 30-episode playlist is one round of
// concurrent requests for *unseen* episodes only.
const episodeCache = new Map();
const episodeInflight = new Map();

export async function getEpisodeCached(id) {
  const key = Number(id);
  if (!Number.isFinite(key)) return null;
  if (episodeCache.has(key)) return episodeCache.get(key);
  if (episodeInflight.has(key)) return episodeInflight.get(key);
  const p = (async () => {
    try {
      const ep = await EpisodeApi.get(key);
      if (ep) episodeCache.set(key, ep);
      return ep || null;
    } catch (e) {
      if (typeof console !== 'undefined') console.debug('episode fetch failed', key, e);
      return null;
    } finally {
      episodeInflight.delete(key);
    }
  })();
  episodeInflight.set(key, p);
  return p;
}

export async function getEpisodesBatch(ids) {
  if (!Array.isArray(ids) || ids.length === 0) return [];
  const unique = Array.from(new Set(ids.map((n) => Number(n)).filter(Number.isFinite)));
  const results = await Promise.all(unique.map((id) => getEpisodeCached(id)));
  // Re-map back to the original (possibly duplicated, possibly
  // re-ordered) input so callers can rely on positional alignment.
  const byId = new Map(unique.map((id, i) => [id, results[i]]));
  return ids.map((id) => byId.get(Number(id)) || null);
}

export function PlaylistProvider({ children }) {
  const [playlists, setPlaylists] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const fetchedRef = useRef(false);
  const { isAuthenticated } = useUser();

  // Fetch playlists from API
  const fetchPlaylists = useCallback(async () => {
    setIsLoading(true);
    try {
      const resp = await PlaylistApi.list();
      const list = Array.isArray(resp) ? resp : (resp?.results || []);
      setPlaylists(list);
    } catch (e) {
      if (typeof console !== 'undefined') console.debug('PlaylistContext: fetch failed', e);
      setPlaylists([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load once when user is authenticated
  useEffect(() => {
    if (isAuthenticated && !fetchedRef.current) {
      fetchedRef.current = true;
      fetchPlaylists();
    }
    if (!isAuthenticated) {
      fetchedRef.current = false;
      setPlaylists([]);
    }
  }, [isAuthenticated, fetchPlaylists]);

  // Force re-fetch from API (useful after bulk operations)
  const refreshPlaylists = useCallback(async () => {
    await fetchPlaylists();
  }, [fetchPlaylists]);

  // ── Optimistic store helpers ────────────────────────────────────

  const addPlaylist = useCallback((pl) => {
    if (!pl) return;
    setPlaylists(prev => [pl, ...prev]);
  }, []);

  const updatePlaylist = useCallback((pl) => {
    if (!pl?.id) return;
    setPlaylists(prev => prev.map(p => p.id === pl.id ? pl : p));
  }, []);

  const removePlaylist = useCallback((id) => {
    if (!id) return;
    setPlaylists(prev => prev.filter(p => p.id !== id));
  }, []);

  // ── Episode-level mutations ─────────────────────────────────────
  //
  // All three return the freshly-PATCHed playlist from the server so
  // callers can rely on `approximate_length_minutes` being accurate
  // (the Django M2M signal recalculates on every change). Each does
  // an *optimistic* local update first (so the UI flips instantly),
  // then merges the canonical response when it arrives — and rolls
  // back on failure.

  const addEpisodeToPlaylist = useCallback(async (playlistId, episodeId) => {
    const pid = Number(playlistId);
    const eid = Number(episodeId);
    if (!Number.isFinite(pid) || !Number.isFinite(eid)) return null;

    let snapshot = null;
    let optimistic = null;
    setPlaylists(prev => prev.map(p => {
      if (p.id !== pid) return p;
      snapshot = p;
      const current = Array.isArray(p.episodes) ? p.episodes.map(Number) : [];
      if (current.includes(eid)) {
        optimistic = p;
        return p;
      }
      const next = [...current, eid];
      optimistic = { ...p, episodes: next };
      return optimistic;
    }));

    if (!snapshot) return null;
    if (optimistic === snapshot) return snapshot; // already a member

    try {
      const updated = await PlaylistApi.update(pid, { episodes: optimistic.episodes });
      if (updated?.id) {
        setPlaylists(prev => prev.map(p => p.id === pid ? updated : p));
      }
      return updated || optimistic;
    } catch (e) {
      // Roll back on failure
      setPlaylists(prev => prev.map(p => p.id === pid ? snapshot : p));
      if (typeof console !== 'undefined') console.debug('addEpisodeToPlaylist failed', e);
      throw e;
    }
  }, []);

  const removeEpisodeFromPlaylist = useCallback(async (playlistId, episodeId) => {
    const pid = Number(playlistId);
    const eid = Number(episodeId);
    if (!Number.isFinite(pid) || !Number.isFinite(eid)) return null;

    let snapshot = null;
    let optimistic = null;
    setPlaylists(prev => prev.map(p => {
      if (p.id !== pid) return p;
      snapshot = p;
      const current = Array.isArray(p.episodes) ? p.episodes.map(Number) : [];
      const next = current.filter(id => id !== eid);
      if (next.length === current.length) {
        optimistic = p;
        return p;
      }
      optimistic = { ...p, episodes: next };
      return optimistic;
    }));

    if (!snapshot) return null;
    if (optimistic === snapshot) return snapshot; // not a member

    try {
      const updated = await PlaylistApi.update(pid, { episodes: optimistic.episodes });
      if (updated?.id) {
        setPlaylists(prev => prev.map(p => p.id === pid ? updated : p));
      }
      return updated || optimistic;
    } catch (e) {
      setPlaylists(prev => prev.map(p => p.id === pid ? snapshot : p));
      if (typeof console !== 'undefined') console.debug('removeEpisodeFromPlaylist failed', e);
      throw e;
    }
  }, []);

  // Reorder uses the same PATCH shape — the backend `set(...)`
  // preserves the array order. Caller passes the entire desired
  // ordering of episode IDs.
  const reorderPlaylist = useCallback(async (playlistId, nextEpisodeIds) => {
    const pid = Number(playlistId);
    if (!Number.isFinite(pid) || !Array.isArray(nextEpisodeIds)) return null;

    let snapshot = null;
    setPlaylists(prev => prev.map(p => {
      if (p.id !== pid) return p;
      snapshot = p;
      return { ...p, episodes: nextEpisodeIds.map(Number) };
    }));

    if (!snapshot) return null;

    try {
      const updated = await PlaylistApi.update(pid, { episodes: nextEpisodeIds });
      if (updated?.id) {
        setPlaylists(prev => prev.map(p => p.id === pid ? updated : p));
      }
      return updated;
    } catch (e) {
      setPlaylists(prev => prev.map(p => p.id === pid ? snapshot : p));
      if (typeof console !== 'undefined') console.debug('reorderPlaylist failed', e);
      throw e;
    }
  }, []);

  const value = useMemo(() => ({
    playlists,
    isLoadingPlaylists: isLoading,
    refreshPlaylists,
    addPlaylist,
    updatePlaylist,
    removePlaylist,
    addEpisodeToPlaylist,
    removeEpisodeFromPlaylist,
    reorderPlaylist,
  }), [
    playlists,
    isLoading,
    refreshPlaylists,
    addPlaylist,
    updatePlaylist,
    removePlaylist,
    addEpisodeToPlaylist,
    removeEpisodeFromPlaylist,
    reorderPlaylist,
  ]);

  return (
    <PlaylistContext.Provider value={value}>
      {children}
    </PlaylistContext.Provider>
  );
}

PlaylistProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export function usePlaylistContext() {
  const ctx = useContext(PlaylistContext);
  if (!ctx) throw new Error('usePlaylistContext must be used within a PlaylistProvider');
  return ctx;
}
