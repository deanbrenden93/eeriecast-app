import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { User as UserAPI, UserLibrary } from "@/api/entities";
import { djangoClient } from '@/api/djangoClient';
import PropTypes from 'prop-types';

const UserContext = React.createContext();

// ── Pure data-processing helpers (no hooks) ──

function parseFavoritesSummary(summary) {
  let resultsArray = [];
  if (Array.isArray(summary?.results)) {
    resultsArray = summary.results;
  } else if (Array.isArray(summary)) {
    resultsArray = summary;
  } else if (summary && typeof summary === 'object' && (summary.podcast || summary.episodes)) {
    resultsArray = [summary];
  } else if (Array.isArray(summary?.favorites?.results)) {
    resultsArray = summary.favorites.results;
  } else if (Array.isArray(summary?.favorites)) {
    resultsArray = summary.favorites;
  }

  const legacyPodcastsList = Array.isArray(summary?.podcasts)
    ? summary.podcasts
    : Array.isArray(summary?.podcasts?.results)
      ? summary.podcasts.results
      : [];
  const legacyFavoritesList = Array.isArray(summary?.favorites)
    ? summary.favorites
    : Array.isArray(summary?.favorites?.results)
      ? summary.favorites.results
      : [];

  let episodeIdSet = new Set();
  const podcastsDisplayList = [];
  const podcastsAllFavdList = [];

  if (resultsArray.length > 0) {
    for (const item of resultsArray) {
      if (!item) continue;
      const favIds = Array.isArray(item.favorited_episode_ids) ? item.favorited_episode_ids : [];
      for (const id of favIds) {
        const n = Number(id);
        if (Number.isFinite(n)) episodeIdSet.add(n);
      }
      const basePodcast = item.podcast || {};
      const podcastObj = { ...basePodcast };
      if (Array.isArray(item.episodes) && item.episodes.length > 0) {
        podcastObj.episodes = item.episodes;
      } else if (Array.isArray(basePodcast?.episodes)) {
        podcastObj.episodes = basePodcast.episodes;
      } else if (!Array.isArray(podcastObj.episodes)) {
        podcastObj.episodes = [];
      }
      if (typeof item.all_episodes_favorited === 'boolean') {
        podcastObj.all_episodes_favorited = item.all_episodes_favorited;
      }
      podcastsDisplayList.push(podcastObj);
      if (item.all_episodes_favorited && basePodcast) {
        podcastsAllFavdList.push(podcastObj);
      }
    }
  } else {
    for (const fav of legacyFavoritesList) {
      if (!fav) continue;
      const id = fav?.object_id || fav?.episode_id || fav?.episode?.id || fav?.id;
      const n = Number(id);
      if (Number.isFinite(n)) episodeIdSet.add(n);
    }
    if (legacyPodcastsList.length > 0) {
      for (const p of legacyPodcastsList) {
        const pod = { ...(p?.podcast || p) };
        if (!Array.isArray(pod.episodes)) pod.episodes = Array.isArray(p?.episodes) ? p.episodes : [];
        podcastsDisplayList.push(pod);
        podcastsAllFavdList.push(pod);
      }
    }
  }

  const podcastIdSet = new Set();
  for (const p of podcastsAllFavdList) {
    const id = p?.id || p?.podcast_id;
    const n = Number(id);
    if (Number.isFinite(n)) podcastIdSet.add(n);
  }

  const flatEpisodes = [];
  for (const item of resultsArray) {
    if (!item) continue;
    const favIds = new Set((Array.isArray(item.favorited_episode_ids) ? item.favorited_episode_ids : []).map(Number));
    const eps = Array.isArray(item.episodes) ? item.episodes : [];
    const podData = item.podcast || {};
    for (const ep of eps) {
      if (!ep?.id) continue;
      if (favIds.size > 0 && !favIds.has(Number(ep.id))) continue;
      flatEpisodes.push({ ...ep, podcast_data: podData });
    }
  }

  return { episodeIdSet, podcastIdSet, podcastsDisplayList, flatEpisodes };
}

function parseFollowedPodcasts(response) {
  const followedList = Array.isArray(response) ? response : (response?.results || []);
  return new Set(
    followedList
      .map((item) => item?.podcast?.id || item?.podcast_id || item?.id)
      .filter((v) => Number.isFinite(Number(v)))
      .map((v) => Number(v))
  );
}

function parseNotifications(resp) {
  const list = Array.isArray(resp) ? resp : (resp?.results || []);
  const unread = list.reduce((acc, n) => acc + (n && n.is_read === false ? 1 : 0), 0);
  return { list, unread };
}

function parseHistoryToProgressMap(resp) {
  const list = Array.isArray(resp) ? resp : (resp?.results || []);
  const map = new Map();
  for (const item of list) {
    const eid = Number(item?.episode?.id || item?.episode_id || item?.id);
    if (!Number.isFinite(eid)) continue;
    const progress = Number(item?.progress) || 0;
    const duration = Number(item?.duration || item?.episode?.duration) || 0;
    const completed = item?.completed === true || (duration > 0 && progress >= duration * 0.95);
    map.set(eid, { progress, duration, completed });
  }
  return map;
}

const UserProvider = ({ children }) => {
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Listening history — Map<episodeId, { progress, duration, completed }>
  // Kept as local state because real-time updates come from AudioPlayerContext
  const [episodeProgressMap, setEpisodeProgressMap] = useState(() => new Map());

  const userId = user?.id || user?.user?.id || user?.pk || null;

  // ── TanStack Query: Favorites ──
  const { data: favoritesRaw, isLoading: favoritesLoading } = useQuery({
    queryKey: ['favorites', userId],
    queryFn: () => UserLibrary.getFavoritesSummary(),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });

  const favoritesDerived = useMemo(() => {
    if (!favoritesRaw) return { episodeIdSet: new Set(), podcastIdSet: new Set(), podcastsDisplayList: [], flatEpisodes: [] };
    return parseFavoritesSummary(favoritesRaw);
  }, [favoritesRaw]);

  const favoriteEpisodeIds = favoritesDerived.episodeIdSet;
  const favoritePodcastIds = favoritesDerived.podcastIdSet;
  const favoritePodcasts = favoritesDerived.podcastsDisplayList;
  const favoriteEpisodes = favoritesDerived.flatEpisodes;

  // ── TanStack Query: Followings ──
  const { data: followingsRaw, isLoading: followingsLoading } = useQuery({
    queryKey: ['followedPodcasts', userId],
    queryFn: () => UserLibrary.getFollowedPodcasts(),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });

  const followedPodcastIds = useMemo(() => {
    if (!followingsRaw) return new Set();
    return parseFollowedPodcasts(followingsRaw);
  }, [followingsRaw]);

  // ── TanStack Query: Notifications ──
  const { data: notificationsRaw, isLoading: notificationsLoading } = useQuery({
    queryKey: ['notifications', userId],
    queryFn: () => UserLibrary.getNotifications(),
    enabled: !!userId,
    staleTime: 3 * 60 * 1000,
  });

  const { notifications, unreadNotificationCount } = useMemo(() => {
    if (!notificationsRaw) return { notifications: [], unreadNotificationCount: 0 };
    const { list, unread } = parseNotifications(notificationsRaw);
    return { notifications: list, unreadNotificationCount: unread };
  }, [notificationsRaw]);

  // ── TanStack Query: Listening history → episode progress map ──
  const { data: historyRaw } = useQuery({
    queryKey: ['history', userId],
    queryFn: () => UserLibrary.getHistory(),
    enabled: !!userId,
    staleTime: 2 * 60 * 1000,
  });

  useEffect(() => {
    if (!historyRaw) return;
    setEpisodeProgressMap(parseHistoryToProgressMap(historyRaw));
  }, [historyRaw]);

  // Fetch user (stable), only called on mount or explicit refresh
  const fetchUser = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await UserAPI.me();
      setUser(data);
      return data;
    } catch {
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const login = useCallback(
    async (credentials) => {
      setError(null);
      try {
        await UserAPI.login(credentials);
        await fetchUser();
        // TanStack Query will automatically fetch favorites/followings/notifications
        // once userId becomes non-null (enabled: !!userId)
        return true;
      } catch (err) {
        setError(err?.data?.message || err.message || "Login failed");
        return false;
      }
    },
    [fetchUser]
  );

  const register = useCallback(
    async (payload) => {
      setError(null);
      try {
        await UserAPI.register(payload);
        if (!(await fetchUser())) {
          await login({ email: payload.email, password: payload.password });
        }
        return true;
      } catch (err) {
        setError(err?.data?.message || err.message || "Registration failed");
        return false;
      }
    },
    [fetchUser, login]
  );

  const logout = useCallback(async () => {
    try {
      if (djangoClient && typeof djangoClient.removeToken === 'function') {
        djangoClient.removeToken();
      }
    } catch { /* no-op */ }

    setUser(null);
    setEpisodeProgressMap(new Map());
    // Clear all user-specific query caches
    queryClient.removeQueries({ queryKey: ['favorites'] });
    queryClient.removeQueries({ queryKey: ['followedPodcasts'] });
    queryClient.removeQueries({ queryKey: ['notifications'] });
    queryClient.removeQueries({ queryKey: ['history'] });
    queryClient.removeQueries({ queryKey: ['listeningHistory'] });
  }, [queryClient]);

  // On initial mount, check current user once
  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  // Public method to force refresh favorites for current user
  const refreshFavorites = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['favorites', userId] });
  }, [queryClient, userId]);

  // Public method to force refresh followings for current user
  const refreshFollowings = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['followedPodcasts', userId] });
  }, [queryClient, userId]);

  // Public method to force refresh notifications for current user
  const refreshNotifications = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['notifications', userId] });
  }, [queryClient, userId]);

  // Public method to force refresh listening history for current user
  const refreshHistory = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['history', userId] });
    await queryClient.invalidateQueries({ queryKey: ['listeningHistory'] });
  }, [queryClient, userId]);

  // Update a single episode's progress in the local map (called by AudioPlayerContext in real-time)
  const updateEpisodeProgress = useCallback((episodeId, progress, dur) => {
    const eid = Number(episodeId);
    if (!Number.isFinite(eid) || eid <= 0) return;
    setEpisodeProgressMap(prev => {
      const next = new Map(prev);
      const completed = dur > 0 && progress >= dur * 0.95;
      next.set(eid, { progress, duration: dur, completed });
      return next;
    });
  }, []);

  // Mark notification read (optimistic via query cache)
  const markNotificationRead = useCallback(async (notificationId) => {
    if (!notificationId) return null;
    const qKey = ['notifications', userId];

    // Optimistic update in the query cache
    const prevData = queryClient.getQueryData(qKey);
    if (prevData) {
      const asList = Array.isArray(prevData) ? prevData : (prevData?.results || []);
      const idx = asList.findIndex((n) => n && Number(n.id) === Number(notificationId));
      if (idx >= 0 && asList[idx]?.is_read === false) {
        const optimistic = [...asList];
        optimistic[idx] = { ...optimistic[idx], is_read: true };
        queryClient.setQueryData(qKey, Array.isArray(prevData) ? optimistic : { ...prevData, results: optimistic });
      }
    }

    try {
      const updated = await UserLibrary.markNotificationRead(notificationId);
      // Refetch to ensure consistency
      await queryClient.invalidateQueries({ queryKey: qKey });
      return updated || null;
    } catch {
      // Roll back
      if (prevData) queryClient.setQueryData(qKey, prevData);
      return null;
    }
  }, [queryClient, userId]);

  // Derived flag: whether the user has an active premium subscription
  const isPremium = useMemo(() => {
    const u = user;
    if (!u) return false;
    const flag = !!u.is_premium;
    const exp = u.subscription_expires ? new Date(u.subscription_expires) : null;
    const notExpired = !exp || exp.getTime() > Date.now();
    return flag && notExpired;
  }, [user]);

  // Derived flag: whether the user is a staff/admin member (for feature flags)
  const isStaff = useMemo(() => !!user?.is_staff, [user]);

  // --- Favorite management helpers (episodes & podcasts) ---
  const inflightFavoriteOpsRef = useRef(new Set());

  const setFavorite = useCallback(async (contentType, contentId, shouldFavorite, { refresh = true } = {}) => {
    if (!contentType || !contentId) return false;
    const type = contentType === 'episode' ? 'episode' : contentType === 'podcast' ? 'podcast' : null;
    if (!type) return false;
    const idNum = Number(contentId);
    if (!Number.isFinite(idNum)) return false;

    const key = `${type}:${idNum}`;
    if (inflightFavoriteOpsRef.current.has(key)) return false;
    inflightFavoriteOpsRef.current.add(key);

    try {
      if (shouldFavorite) {
        await UserLibrary.addFavorite(type, idNum);
      } else {
        await UserLibrary.removeFavorite(type, idNum);
      }
      if (refresh) {
        await queryClient.invalidateQueries({ queryKey: ['favorites', userId] });
      }
      return true;
    } catch {
      return false;
    } finally {
      inflightFavoriteOpsRef.current.delete(key);
    }
  }, [queryClient, userId]);

  const addFavorite = useCallback((contentType, contentId, opts) => setFavorite(contentType, contentId, true, opts), [setFavorite]);
  const removeFavorite = useCallback((contentType, contentId, opts) => setFavorite(contentType, contentId, false, opts), [setFavorite]);

  // Toggle favorite; if desiredState passed, acts like setFavorite
  const toggleFavorite = useCallback(async (contentType, contentId, desiredState = null, opts) => {
    const type = contentType === 'episode' ? 'episode' : contentType === 'podcast' ? 'podcast' : null;
    if (!type) return false;
    const idNum = Number(contentId);
    if (!Number.isFinite(idNum)) return false;
    const isFav = type === 'episode' ? favoriteEpisodeIds.has(idNum) : favoritePodcastIds.has(idNum);
    const target = desiredState === null ? !isFav : !!desiredState;
    return setFavorite(type, idNum, target, opts);
  }, [favoriteEpisodeIds, favoritePodcastIds, setFavorite]);

  // Convenience: unfavorite an object (episode or podcast) or a (type,id) pair
  const unfavoriteItem = useCallback(async (target, maybeId = null) => {
    // (1) If given a type string and id
    if (typeof target === 'string') {
      const type = target;
      const id = Number(maybeId);
      if (!['episode', 'podcast'].includes(type) || !Number.isFinite(id)) return false;
      return removeFavorite(type, id);
    }

    // (2) If given an object try to infer
    const obj = target || {};
    const inferredId = Number(obj.id || obj.object_id || obj.episode_id || obj.podcast_id);
    // Heuristics for type
    let inferredType = null;
    if (obj.object_type === 'episode' || obj.content_type === 'episode') inferredType = 'episode';
    if (obj.object_type === 'podcast' || obj.content_type === 'podcast') inferredType = 'podcast';
    if (!inferredType) {
      if (Array.isArray(obj.episodes)) inferredType = 'podcast';
      else if (typeof obj.podcast === 'number' || obj.audio_url) inferredType = 'episode';
      else if (obj.total_episodes != null || (obj.slug && !obj.audio_url)) inferredType = 'podcast';
    }

    if (inferredType === 'episode') {
      if (!Number.isFinite(inferredId)) return false;
      return removeFavorite('episode', inferredId);
    }

    if (inferredType === 'podcast') {
      // If the podcast is fully favorited, remove at podcast level; otherwise bulk remove favorited episodes
      const allFav = obj.all_episodes_favorited === true;
      if (allFav && Number.isFinite(inferredId)) {
        return removeFavorite('podcast', inferredId);
      }
      // Bulk remove episodes from this group
      const eps = Array.isArray(obj.episodes) ? obj.episodes : [];
      if (eps.length === 0) return false;
      for (const ep of eps) {
        const eid = Number(ep?.id);
        if (Number.isFinite(eid)) {
          // Avoid N calls with refresh; refresh once at end
          await setFavorite('episode', eid, false, { refresh: false });
        }
      }
      await refreshFavorites();
      return true;
    }

    return false;
  }, [removeFavorite, setFavorite, refreshFavorites]);
  // --- End favorite helpers ---

  // Remove episode from a playlist helper
  const removeEpisodeFromPlaylist = useCallback(async (playlistId, episodeId) => {
    if (!Number.isFinite(Number(playlistId)) || !Number.isFinite(Number(episodeId))) return false;
    try {
      // Use Playlist entity service for consistency
      const { Playlist } = await import('@/api/entities');
      const pl = await Playlist.get(playlistId);
      if (!pl) return false;
      const current = Array.isArray(pl.episodes) ? pl.episodes : [];
      if (!current.length) return false; // nothing to remove
      const next = current.filter(id => Number(id) !== Number(episodeId));
      if (next.length === current.length) return false; // id not found
      await Playlist.update(playlistId, { episodes: next });
      return true;
    } catch (e) {
      console.warn('Failed to remove episode from playlist', e);
      return false;
    }
  }, []);

  return (
    <UserContext.Provider
      value={{
        user,
        setUser,
        loading,
        error,
        fetchUser,
        login,
        register,
        logout,
        isAuthenticated: !!user || !!djangoClient.getToken(),
        isPremium,
        isStaff,
        // favorites
        favoriteEpisodeIds,
        favoritePodcastIds,
        favoritePodcasts,
        favoriteEpisodes,
        favoritesLoading,
        refreshFavorites,
        addFavorite,
        removeFavorite,
        toggleFavorite,
        setFavorite, // direct setter if needed
        unfavoriteItem,
        // followings
        followedPodcastIds,
        followingsLoading,
        refreshFollowings,
        // notifications
        notifications,
        notificationsLoading,
        unreadNotificationCount,
        refreshNotifications,
        markNotificationRead,
        removeEpisodeFromPlaylist,
        // listening history / episode progress
        episodeProgressMap,
        refreshHistory,
        updateEpisodeProgress,
      }}
    >
      {children}
    </UserContext.Provider>
  );
};

UserProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export { UserContext, UserProvider };

export const useUser = () => React.useContext(UserContext);
