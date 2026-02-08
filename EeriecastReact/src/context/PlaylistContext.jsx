import React, { useCallback, useEffect, useMemo, useRef, useState, useContext } from 'react';
import PropTypes from 'prop-types';
import { Playlist as PlaylistApi } from '@/api/entities';
import { useUser } from '@/context/UserContext.jsx';

const PlaylistContext = React.createContext(null);

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

  // Optimistic helpers — update local state instantly without a round-trip

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

  const value = useMemo(() => ({
    playlists,
    isLoadingPlaylists: isLoading,
    refreshPlaylists,
    addPlaylist,
    updatePlaylist,
    removePlaylist,
  }), [playlists, isLoading, refreshPlaylists, addPlaylist, updatePlaylist, removePlaylist]);

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
