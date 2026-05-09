import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { User as UserAPI, UserLibrary } from "@/api/entities";
import { djangoClient } from '@/api/djangoClient';
import PropTypes from 'prop-types';

const UserContext = React.createContext();

// Persisted snapshot of the currently-authenticated user. Rehydrated
// synchronously when <UserProvider> mounts so consumers reading
// `user` (avatar, name, premium gates, "For You" feed, etc.) see
// the logged-in chrome on the very first paint instead of flashing
// logged-out chrome for the ~150–500 ms it takes /me to resolve.
//
// Trade-off: the cached payload can briefly be stale (e.g. user
// upgraded to premium on another device); we accept that because
// the background revalidation in `fetchUser` reconciles within
// one network round-trip and the cache is wiped the moment that
// call returns 401 or `logout` runs. We also bump CACHE_VERSION
// any time the on-the-wire `/me` shape changes so old cached
// objects can't poison a new build.
const USER_CACHE_KEY = 'eeriecast_user_cache_v1';

const readCachedUser = () => {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    // Only trust the cache if there's also an auth token present
    // — otherwise some other tab logged us out and our cached
    // user is meaningless. Reading the token here is sync.
    const token = djangoClient.getToken && djangoClient.getToken();
    if (!token) return null;
    const raw = window.localStorage.getItem(USER_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
};

const writeCachedUser = (data) => {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    if (data && typeof data === 'object') {
      window.localStorage.setItem(USER_CACHE_KEY, JSON.stringify(data));
    } else {
      window.localStorage.removeItem(USER_CACHE_KEY);
    }
  } catch { /* quota / private-mode — non-fatal */ }
};

const UserProvider = ({ children }) => {
  // Initialize from the cached snapshot so the very first render
  // already knows whether the user is logged in. If we didn't
  // cache anything (or there's no token), `user` stays null and
  // the UI renders in its normal logged-out state. The lazy init
  // form means localStorage is only read once on mount, not on
  // every re-render.
  const [user, setUser] = useState(() => readCachedUser());
  // If we had a cached user, we don't want to gate UI on a
  // "loading" spinner — the real content is already on screen and
  // we're just revalidating in the background.
  const hadCachedUserOnMountRef = useRef(false);
  const [loading, setLoading] = useState(() => {
    const cached = readCachedUser();
    hadCachedUserOnMountRef.current = !!cached;
    return !cached;
  });
  const [error, setError] = useState(null);
  const [favoriteEpisodeIds, setFavoriteEpisodeIds] = useState(() => new Set());
  const [favoritePodcastIds, setFavoritePodcastIds] = useState(() => new Set());
  const [favoritePodcasts, setFavoritePodcasts] = useState(() => []);
  const [favoriteEpisodes, setFavoriteEpisodes] = useState(() => []);
  const [favoritesLoading, setFavoritesLoading] = useState(false);
  const [followedPodcastIds, setFollowedPodcastIds] = useState(() => new Set());
  const [followingsLoading, setFollowingsLoading] = useState(false);
  const [notifications, setNotifications] = useState(() => []);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  // Listening history — Map<episodeId, { progress, duration, completed }>
  const [episodeProgressMap, setEpisodeProgressMap] = useState(() => new Map());
  const lastFavoritesForUserRef = useRef(null);
  const lastFollowingsForUserRef = useRef(null);
  const lastNotificationsForUserRef = useRef(null);
  const lastHistoryForUserRef = useRef(null);

  // Fetch favorites for a specific user id (stable, no dependency on user state)
  const fetchFavoritesForUser = useCallback(async (uid) => {
    if (!uid) {
      setFavoriteEpisodeIds(new Set());
      setFavoritePodcastIds(new Set());
      setFavoritePodcasts([]);
      setFavoriteEpisodes([]);
      return { episodes: new Set(), podcasts: new Set(), podcastsList: [] };
    }
    setFavoritesLoading(true);
    try {
      const summary = await UserLibrary.getFavoritesSummary();

      // Normalize into an array of items shaped like { podcast, episodes, favorited_episode_ids?, all_episodes_favorited? }
      let resultsArray = [];
      if (Array.isArray(summary?.results)) {
        resultsArray = summary.results;
      } else if (Array.isArray(summary)) {
        resultsArray = summary;
      } else if (summary && typeof summary === 'object' && (summary.podcast || summary.episodes)) {
        // API sometimes returns a single item (not wrapped in results)
        resultsArray = [summary];
      } else if (Array.isArray(summary?.favorites?.results)) {
        resultsArray = summary.favorites.results;
      } else if (Array.isArray(summary?.favorites)) {
        resultsArray = summary.favorites;
      }

      // Legacy fallbacks
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
          // Favorited episode ids per podcast (for Play All)
          const favIds = Array.isArray(item.favorited_episode_ids) ? item.favorited_episode_ids : [];
          for (const id of favIds) {
            const n = Number(id);
            if (Number.isFinite(n)) episodeIdSet.add(n);
          }

          // Build podcast object for UI (always include all items under results)
          const basePodcast = item.podcast || {};
          const podcastObj = { ...basePodcast };
          // Ensure episodes exist for duration/count in UI - prefer the favorited subset if provided on item
          if (Array.isArray(item.episodes) && item.episodes.length > 0) {
            podcastObj.episodes = item.episodes;
          } else if (Array.isArray(basePodcast?.episodes)) {
            podcastObj.episodes = basePodcast.episodes;
          } else if (!Array.isArray(podcastObj.episodes)) {
            podcastObj.episodes = [];
          }
          // Keep a hint flag if provided
          if (typeof item.all_episodes_favorited === 'boolean') {
            podcastObj.all_episodes_favorited = item.all_episodes_favorited;
          }
          podcastsDisplayList.push(podcastObj);

          // Track shows where all episodes are favorited (for id set semantics)
          if (item.all_episodes_favorited && basePodcast) {
            podcastsAllFavdList.push(podcastObj);
          }
        }
      } else {
        // Legacy mapping
        for (const fav of legacyFavoritesList) {
          if (!fav) continue;
          const id = fav?.object_id || fav?.episode_id || fav?.episode?.id || fav?.id;
          const n = Number(id);
          if (Number.isFinite(n)) episodeIdSet.add(n);
        }
        // Display: legacy podcasts list if present
        if (legacyPodcastsList.length > 0) {
          for (const p of legacyPodcastsList) {
            const pod = { ...(p?.podcast || p) };
            if (!Array.isArray(pod.episodes)) pod.episodes = Array.isArray(p?.episodes) ? p.episodes : [];
            podcastsDisplayList.push(pod);
            podcastsAllFavdList.push(pod);
          }
        }
      }

      // Derive podcast ids set (for podcasts with all episodes favorited)
      const podcastIdSet = new Set();
      for (const p of podcastsAllFavdList) {
        const id = p?.id || p?.podcast_id;
        const n = Number(id);
        if (Number.isFinite(n)) podcastIdSet.add(n);
      }

      setFavoriteEpisodeIds(episodeIdSet);
      setFavoritePodcastIds(podcastIdSet);
      // UI expects an array of podcast-like objects with .episodes
      setFavoritePodcasts(podcastsDisplayList);

      // Build flat list of favorited episode objects (for episode-level favorites tab)
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
      setFavoriteEpisodes(flatEpisodes);

      return { episodes: episodeIdSet, podcasts: podcastIdSet, podcastsList: podcastsDisplayList };
    } catch (e) {
      console.warn('Failed to fetch favorites summary', e);
      setFavoriteEpisodeIds(new Set());
      setFavoritePodcastIds(new Set());
      setFavoritePodcasts([]);
      setFavoriteEpisodes([]);
      return { episodes: new Set(), podcasts: new Set(), podcastsList: [] };
    } finally {
      setFavoritesLoading(false);
    }
  }, []);

  // Fetch followed podcasts for a specific user id
  const fetchFollowingsForUser = useCallback(async (uid) => {
    if (!uid) {
      setFollowedPodcastIds(new Set());
      return new Set();
    }
    setFollowingsLoading(true);
    try {
      const response = await UserLibrary.getFollowedPodcasts();
      const followedList = Array.isArray(response) ? response : (response?.results || []);
      const podcastIds = new Set(
        followedList
          .map((item) => item?.podcast?.id || item?.podcast_id || item?.id)
          .filter((v) => Number.isFinite(Number(v)))
          .map((v) => Number(v))
      );
      setFollowedPodcastIds(podcastIds);
      return podcastIds;
    } catch {
      setFollowedPodcastIds(new Set());
      return new Set();
    } finally {
      setFollowingsLoading(false);
    }
  }, []);

  // Fetch notifications for a specific user id
  const fetchNotificationsForUser = useCallback(async (uid) => {
    if (!uid) {
      setNotifications([]);
      setUnreadNotificationCount(0);
      return [];
    }
    setNotificationsLoading(true);
    try {
      const resp = await UserLibrary.getNotifications();
      const list = Array.isArray(resp) ? resp : (resp?.results || []);
      setNotifications(list);
      const unread = list.reduce((acc, n) => acc + (n && n.is_read === false ? 1 : 0), 0);
      setUnreadNotificationCount(unread);
      return list;
    } catch {
      setNotifications([]);
      setUnreadNotificationCount(0);
      return [];
    } finally {
      setNotificationsLoading(false);
    }
  }, []);

  // Fetch listening history to build episode progress map
  const fetchHistoryForUser = useCallback(async (uid) => {
    if (!uid) {
      setEpisodeProgressMap(new Map());
      return new Map();
    }
    try {
      const resp = await UserLibrary.getHistory();
      const list = Array.isArray(resp) ? resp : (resp?.results || []);
      const map = new Map();
      for (const item of list) {
        // Django serializer returns the FK as a bare integer in `episode` and
        // the nested object under `episode_detail`. Prefer those before the
        // history-row id so the map is keyed by episode id, not row id.
        const eid = Number(
          item?.episode_detail?.id
          ?? (typeof item?.episode === 'object' ? item?.episode?.id : item?.episode)
          ?? item?.episode_id
        );
        if (!Number.isFinite(eid)) continue;
        const progress = Number(item?.progress) || 0;
        const duration = Number(item?.duration || item?.episode_detail?.duration || item?.episode?.duration) || 0;
        const completed = item?.completed === true || (duration > 0 && progress >= duration * 0.95);
        map.set(eid, { progress, duration, completed });
      }
      setEpisodeProgressMap(map);
      return map;
    } catch {
      setEpisodeProgressMap(new Map());
      return new Map();
    }
  }, []);

  // Fetch user (stable), only called on mount or explicit refresh.
  //
  // If we already rehydrated a cached user on mount, this runs as
  // a *background revalidation* — we skip flipping `loading` to
  // true so consumers don't see a spinner over content that's
  // already correctly rendered. Only when there's no cached user
  // (cold load with no token, or the cache was wiped) do we show
  // the loading state.
  const fetchUser = useCallback(async ({ background = false } = {}) => {
    if (!background) setLoading(true);
    setError(null);
    try {
      const data = await UserAPI.me();
      setUser(data);
      writeCachedUser(data);
      return data;
    } catch {
      setUser(null); // not authenticated
      writeCachedUser(null);
      setFavoriteEpisodeIds(new Set());
      setFavoritePodcastIds(new Set());
      setFavoritePodcasts([]);
      setFavoriteEpisodes([]);
      setFollowedPodcastIds(new Set());
      setNotifications([]);
      setUnreadNotificationCount(0);
      return null;
    } finally {
      if (!background) setLoading(false);
    }
  }, []);

  const login = useCallback(
    async (credentials) => {
      setError(null);
      try {
        await UserAPI.login(credentials);
        await fetchUser();
        // favorites/followings/notifications will be fetched by the effects below (once per user id)
        return { success: true };
      } catch (err) {
        const errorData = err?.data || {};
        const msg = errorData.message || err.message || "Login failed";
        setError(msg);
        return {
          success: false,
          error: msg,
          code: errorData.error,
          email: errorData.email || credentials.email,
          data: errorData
        };
      }
    },
    [fetchUser]
  );

  const register = useCallback(
    async (payload) => {
      setError(null);
      try {
        const response = await UserAPI.register(payload);
        // Registration endpoint returns access_token and user data - use them directly
        if (response?.access_token) {
          djangoClient.setToken(response.access_token);
          await fetchUser();
          return { success: true };
        }
        // Fallback: if no token in response, try logging in
        const loginResult = await login({ email: payload.email, password: payload.password });
        return loginResult;
      } catch (err) {
        const errorData = err?.data || {};
        const msg = errorData.message || err.message || "Registration failed";
        setError(msg);
        return {
          success: false,
          error: msg,
          code: errorData.error,
          email: errorData.email || payload.email,
          data: errorData
        };
      }
    },
    [fetchUser, login]
  );

  const logout = useCallback(async () => {
    try {
      await UserAPI.logout();
    } catch { /* best-effort: server may not have this endpoint yet */ }

    try {
      if (djangoClient && typeof djangoClient.removeToken === 'function') {
        djangoClient.removeToken();
      }
    } catch { /* no-op */ }

    // Per-user local data — wipe on logout so a different user
    // signing in on the same browser never inherits the previous
    // session's player state, recently-played list, or stored DOB.
    // The audio player rehydration logic also defends against this
    // via a userId match check, but clearing here is the cleaner
    // first line of defense.
    try { localStorage.removeItem('eeriecast_user_dob'); } catch { /* */ }
    try { localStorage.removeItem('eeriecast_player_state'); } catch { /* */ }
    try { localStorage.removeItem('recentlyPlayed'); } catch { /* */ }
    // Wipe the rehydration snapshot so the next visit doesn't
    // momentarily show this user's chrome before /me 401s.
    writeCachedUser(null);

    window.location.replace('/');
  }, []);

  // On initial mount, revalidate the current user once. If we
  // rehydrated a cached snapshot on init we revalidate in the
  // background so the UI doesn't flicker; otherwise it's a normal
  // foreground fetch with the loading flag set.
  useEffect(() => {
    fetchUser({ background: hadCachedUserOnMountRef.current });
  }, [fetchUser]);

  // When user id becomes available, fetch favorites ONCE per user id
  useEffect(() => {
    const uid = user?.id || user?.user?.id || user?.pk;
    if (uid && lastFavoritesForUserRef.current !== uid) {
      lastFavoritesForUserRef.current = uid;
      fetchFavoritesForUser(uid);
    }
  }, [user, fetchFavoritesForUser]);

  // When user id becomes available, fetch followings ONCE per user id
  useEffect(() => {
    const uid = user?.id || user?.user?.id || user?.pk;
    if (uid && lastFollowingsForUserRef.current !== uid) {
      lastFollowingsForUserRef.current = uid;
      fetchFollowingsForUser(uid);
    }
  }, [user, fetchFollowingsForUser]);

  // When user id becomes available, fetch notifications ONCE per user id
  useEffect(() => {
    const uid = user?.id || user?.user?.id || user?.pk;
    if (uid && lastNotificationsForUserRef.current !== uid) {
      lastNotificationsForUserRef.current = uid;
      fetchNotificationsForUser(uid);
    }
  }, [user, fetchNotificationsForUser]);

  // When user id becomes available, fetch listening history ONCE per user id
  useEffect(() => {
    const uid = user?.id || user?.user?.id || user?.pk;
    if (uid && lastHistoryForUserRef.current !== uid) {
      lastHistoryForUserRef.current = uid;
      fetchHistoryForUser(uid);
    }
  }, [user, fetchHistoryForUser]);

  // Public method to force refresh favorites for current user
  const refreshFavorites = useCallback(async () => {
    const uid = user?.id || user?.user?.id || user?.pk;
    return fetchFavoritesForUser(uid);
  }, [user, fetchFavoritesForUser]);

  // Public method to force refresh followings for current user
  const refreshFollowings = useCallback(async () => {
    const uid = user?.id || user?.user?.id || user?.pk;
    return fetchFollowingsForUser(uid);
  }, [user, fetchFollowingsForUser]);

  // Public method to force refresh notifications for current user
  const refreshNotifications = useCallback(async () => {
    const uid = user?.id || user?.user?.id || user?.pk;
    return fetchNotificationsForUser(uid);
  }, [user, fetchNotificationsForUser]);

  // Public method to force refresh listening history for current user
  const refreshHistory = useCallback(async () => {
    const uid = user?.id || user?.user?.id || user?.pk;
    return fetchHistoryForUser(uid);
  }, [user, fetchHistoryForUser]);

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

  // Manual "Mark as Listened" — flips the listening-history row to
  // completed=true server-side and updates the local progress map
  // optimistically so UI affordances (greyed-out rows, completion
  // checkmarks, "Unplayed" sort filter, etc.) reflect the change
  // immediately. The backend endpoint upserts the row, so calling
  // this on an episode the user has never started still creates the
  // history entry, which is what makes the action save.
  const markEpisodeListened = useCallback(async (episodeId, episodeDuration = null) => {
    const eid = Number(episodeId);
    if (!Number.isFinite(eid) || eid <= 0) return false;
    // Use whichever duration we know about — passed in, in the local
    // map already, or zero as a last resort. The backend doesn't
    // strictly require duration to honor `event: 'complete'`, but
    // it's needed for the threshold-based completion calc, and we
    // also want the local progress bar to render full.
    const known = episodeProgressMap.get(eid);
    const duration = Number(episodeDuration) || known?.duration || 0;
    const progress = duration > 0 ? duration : (known?.progress ?? 0);

    setEpisodeProgressMap(prev => {
      const next = new Map(prev);
      next.set(eid, { progress, duration, completed: true });
      return next;
    });

    try {
      await UserLibrary.updateProgress(eid, {
        progress,
        duration,
        event: 'complete',
        source: 'manual_mark_complete',
      });
      return true;
    } catch (e) {
      // Roll back on failure so the local map matches reality.
      setEpisodeProgressMap(prev => {
        const next = new Map(prev);
        if (known) next.set(eid, known);
        else next.delete(eid);
        return next;
      });
      throw e;
    }
  }, [episodeProgressMap]);

  // Manual "Mark as Unplayed" — resets progress to 0 and flips the
  // completed flag off on both the backend and the local map. The
  // PATCH handler decides completion from `(progress >= duration * 0.9)
  // OR event == 'complete'`, so sending progress=0 with no complete
  // event is enough to undo a prior completion.
  const markEpisodeUnplayed = useCallback(async (episodeId) => {
    const eid = Number(episodeId);
    if (!Number.isFinite(eid) || eid <= 0) return false;
    const known = episodeProgressMap.get(eid);
    const duration = known?.duration || 0;

    setEpisodeProgressMap(prev => {
      const next = new Map(prev);
      next.set(eid, { progress: 0, duration, completed: false });
      return next;
    });

    try {
      await UserLibrary.updateProgress(eid, {
        progress: 0,
        duration,
        source: 'manual_mark_unplayed',
      });
      return true;
    } catch (e) {
      setEpisodeProgressMap(prev => {
        const next = new Map(prev);
        if (known) next.set(eid, known);
        else next.delete(eid);
        return next;
      });
      throw e;
    }
  }, [episodeProgressMap]);

  // Mark notification read (optimistic)
  const markNotificationRead = useCallback(async (notificationId) => {
    if (!notificationId) return null;
    // Find existing notification
    const idx = notifications.findIndex((n) => n && Number(n.id) === Number(notificationId));
    if (idx === -1) {
      try {
        // Fall back to direct call (no optimistic state)
        const updated = await UserLibrary.markNotificationRead(notificationId);
        // If response includes updated notification, merge into list
        if (updated && updated.id) {
          setNotifications((prev) => {
            const copy = Array.isArray(prev) ? [...prev] : [];
            const i2 = copy.findIndex((n) => n && Number(n.id) === Number(updated.id));
            if (i2 >= 0) copy[i2] = { ...copy[i2], ...updated };
            else copy.unshift(updated);
            return copy;
          });
          if (updated.is_read === true) setUnreadNotificationCount((c) => Math.max(0, c - 1));
        }
        return updated || null;
      } catch {
        return null;
      }
    }

    const prevList = notifications;
    const wasUnread = prevList[idx]?.is_read === false;
    // Optimistic update
    const nextList = [...prevList];
    nextList[idx] = { ...nextList[idx], is_read: true };
    setNotifications(nextList);
    if (wasUnread) setUnreadNotificationCount((c) => Math.max(0, c - 1));

    try {
      const updated = await UserLibrary.markNotificationRead(notificationId);
      if (updated && updated.id) {
        setNotifications((curr) => {
          const copy = Array.isArray(curr) ? [...curr] : [];
          const i3 = copy.findIndex((n) => n && Number(n.id) === Number(updated.id));
          if (i3 >= 0) copy[i3] = { ...copy[i3], ...updated };
          return copy;
        });
      }
      return updated || null;
    } catch {
      // Roll back on failure
      setNotifications(prevList);
      if (wasUnread) setUnreadNotificationCount((c) => c + 1);
      return null;
    }
  }, [notifications]);

  // Batch "Mark all as read" — fires mark_read for every unread notification
  // in parallel, with optimistic UI updates so the UI flips instantly.
  // Delete a notification permanently (swipe-to-delete in the
  // notification feed). The action is optimistic + rollback so the
  // row drops out of the list the instant the user releases the
  // swipe; if the network call fails we re-insert the row in its
  // original spot and restore the unread badge if relevant.
  const deleteNotification = useCallback(async (notificationId) => {
    if (!notificationId) return false;
    const idNum = Number(notificationId);
    let removed = null;
    let removedIdx = -1;

    setNotifications((prev) => {
      const list = Array.isArray(prev) ? prev : [];
      removedIdx = list.findIndex((n) => n && Number(n.id) === idNum);
      if (removedIdx === -1) return prev;
      removed = list[removedIdx];
      const next = [...list.slice(0, removedIdx), ...list.slice(removedIdx + 1)];
      return next;
    });

    if (removed && removed.is_read === false) {
      setUnreadNotificationCount((c) => Math.max(0, c - 1));
    }

    try {
      await UserLibrary.deleteNotification(idNum);
      return true;
    } catch (e) {
      if (removed != null) {
        setNotifications((prev) => {
          const list = Array.isArray(prev) ? prev : [];
          // Re-insert at the original position (or the head if the
          // list mutated underneath us in the meantime).
          const insertAt = Math.min(removedIdx, list.length);
          return [...list.slice(0, insertAt), removed, ...list.slice(insertAt)];
        });
        if (removed.is_read === false) {
          setUnreadNotificationCount((c) => c + 1);
        }
      }
      throw e;
    }
  }, []);

  // Clear (permanently delete) every notification for the current
  // user. Optimistic: empties the local list immediately so the
  // popover can play its row-exit animations. If the backend call
  // fails we DON'T snap-rollback to the previous list — that was
  // making the rows pop right back into place faster than
  // AnimatePresence could finish their exit animations, so the
  // listener saw "they cleared and instantly came back" with no
  // motion. Instead we let the optimistic state stand for a beat,
  // then refetch from the server, which restores truth via a
  // normal render pass that allows enter animations to play.
  const clearAllNotifications = useCallback(async () => {
    const prevCount = Array.isArray(notifications) ? notifications.length : 0;
    if (prevCount === 0) return { cleared: 0 };
    setNotifications([]);
    setUnreadNotificationCount(0);
    try {
      await UserLibrary.clearAllNotifications();
      return { cleared: prevCount };
    } catch (e) {
      // Keep the empty optimistic state visible long enough for
      // the row-exit animations to finish (≈220ms), then ask the
      // server for the source of truth. If the endpoint is
      // genuinely missing (e.g. Django wasn't restarted after
      // adding the action) the refetch will repopulate the list
      // and the user can retry.
      const uid = user?.id || user?.user?.id || user?.pk;
      setTimeout(() => {
        if (uid) fetchNotificationsForUser(uid);
      }, 260);
      throw e;
    }
  }, [notifications, user, fetchNotificationsForUser]);

  const markAllNotificationsRead = useCallback(async () => {
    const unread = (notifications || []).filter((n) => n && n.is_read === false);
    if (unread.length === 0) return { updated: 0 };
    const prevList = notifications;
    // Optimistic: mark all unread as read locally
    const nextList = (notifications || []).map((n) => (
      n && n.is_read === false ? { ...n, is_read: true } : n
    ));
    setNotifications(nextList);
    setUnreadNotificationCount(0);
    try {
      await Promise.all(
        unread.map((n) => UserLibrary.markNotificationRead(n.id).catch(() => null))
      );
      return { updated: unread.length };
    } catch {
      // Rollback on failure — best-effort; individual calls shouldn't throw
      setNotifications(prevList);
      setUnreadNotificationCount(unread.length);
      return { updated: 0 };
    }
  }, [notifications]);

  // Derived flag: whether the user has an active premium subscription
  const isPremium = useMemo(() => {
    const u = user;
    if (!u) return false;
    const flag = !!u.is_premium;
    const exp = u.subscription_expires ? new Date(u.subscription_expires) : null;
    const notExpired = !exp || exp.getTime() > Date.now();
    return flag && notExpired;
  }, [user]);

  // Admin access flags — matched to Django's User.is_staff / is_superuser.
  // `isAdmin` is the one gate you want almost everywhere: it requires
  // BOTH staff and superuser so a plain staff moderator can't wander
  // into revenue dashboards by accident.
  const isStaff = useMemo(() => !!user?.is_staff, [user]);
  const isSuperuser = useMemo(() => !!user?.is_superuser, [user]);
  const isAdmin = useMemo(() => isStaff && isSuperuser, [isStaff, isSuperuser]);

  // Legacy trial information
  const isOnLegacyTrial = useMemo(() => {
    return !!user?.is_on_legacy_trial;
  }, [user]);

  const legacyTrialEnds = useMemo(() => {
    return user?.free_trial_ends || null;
  }, [user]);

  const legacyTrialDaysRemaining = useMemo(() => {
    return user?.legacy_trial_days_remaining || 0;
  }, [user]);

  const legacyPlanType = useMemo(() => {
    return user?.memberful_plan_type || null;
  }, [user]);

  // True if the user has a card/payment method on file (derived from their
  // local Subscription record; kept in sync by Stripe webhooks). Used to
  // suppress "trial ending" reminders for users who will auto-renew anyway.
  const hasPaymentMethod = useMemo(() => !!user?.has_payment_method, [user]);

  // Unified trial information: covers both the standard 7-day Stripe trial
  // and legacy (imported) trials. Prefers Stripe trial when both are present.
  const isOnTrial = useMemo(() => !!user?.is_on_trial, [user]);
  const trialType = useMemo(() => user?.trial_type || null, [user]);
  const trialEnds = useMemo(() => user?.trial_ends || null, [user]);
  const trialDaysRemaining = useMemo(() => user?.trial_days_remaining || 0, [user]);

  // Derived: user's age in whole years (null if DOB unavailable)
  const userAge = useMemo(() => {
    const dob = user?.date_of_birth;
    if (!dob) return null;
    const birth = new Date(dob);
    if (isNaN(birth.getTime())) return null;
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    const monthDiff = now.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) age--;
    return age;
  }, [user]);

  // Guest (non-logged-in) mature opt-in, persisted in localStorage. We honor
  // this in the same `canViewMature` gate that logged-in users go through so
  // every filter across the app stays consistent. The setter is exposed
  // through context for the Settings page; flipping it on requires the guest
  // to confirm they're 18+ via a modal there.
  const GUEST_MATURE_KEY = 'eeriecast_guest_mature_ok';
  const [guestAllowMature, setGuestAllowMatureState] = useState(() => {
    try { return localStorage.getItem(GUEST_MATURE_KEY) === '1'; }
    catch { return false; }
  });
  const setGuestAllowMature = useCallback((val) => {
    const next = !!val;
    setGuestAllowMatureState(next);
    try {
      if (next) localStorage.setItem(GUEST_MATURE_KEY, '1');
      else localStorage.removeItem(GUEST_MATURE_KEY);
    } catch { /* storage unavailable — in-memory is fine */ }
  }, []);

  // Only users whose age confirms 18+ AND have enabled mature content can
  // view it. Guests rely on the localStorage opt-in (gated behind a confirm
  // modal in Settings). Logged-in users qualify if EITHER their DOB proves
  // they're 18+, OR their DOB is missing but they've explicitly toggled
  // ``allow_mature_content`` on (which also goes through a self-attestation
  // modal in Settings). A DOB on file that says < 18 always blocks access.
  const canViewMature = useMemo(() => {
    if (!user) return guestAllowMature === true;
    if (user.allow_mature_content !== true) return false;
    if (userAge === null) return true; // self-attested (DOB unknown)
    return userAge >= 18;
  }, [user, userAge, guestAllowMature]);

  // --- Favorite management helpers (episodes & podcasts) ---
  // Track inflight operations to avoid duplicate calls per (type,id)
  const inflightFavoriteOpsRef = useRef(new Set());

  const setFavorite = useCallback(async (contentType, contentId, shouldFavorite, { refresh = true } = {}) => {
    // Validate inputs
    if (!contentType || !contentId) return false;
    const type = contentType === 'episode' ? 'episode' : contentType === 'podcast' ? 'podcast' : null;
    if (!type) return false;
    const idNum = Number(contentId);
    if (!Number.isFinite(idNum)) return false;

    const key = `${type}:${idNum}`;
    if (inflightFavoriteOpsRef.current.has(key)) {
      // Prevent overlapping operations
      return false;
    }
    inflightFavoriteOpsRef.current.add(key);

    // Optimistic update
    let rollbackFn = () => {};
    if (type === 'episode') {
      setFavoriteEpisodeIds(prev => {
        const next = new Set(prev);
        const existed = next.has(idNum);
        if (shouldFavorite && !existed) next.add(idNum);
        if (!shouldFavorite && existed) next.delete(idNum);
        // Prepare rollback
        rollbackFn = () => setFavoriteEpisodeIds(existed ? prev : (shouldFavorite ? new Set([...prev]) : new Set([...prev, idNum])));
        return next;
      });
    } else if (type === 'podcast') {
      setFavoritePodcastIds(prev => {
        const next = new Set(prev);
        const existed = next.has(idNum);
        if (shouldFavorite && !existed) next.add(idNum);
        if (!shouldFavorite && existed) next.delete(idNum);
        rollbackFn = () => setFavoritePodcastIds(existed ? prev : (shouldFavorite ? new Set([...prev]) : new Set([...prev, idNum])));
        return next;
      });
    }

    try {
      if (shouldFavorite) {
        await UserLibrary.addFavorite(type, idNum);
      } else {
        await UserLibrary.removeFavorite(type, idNum);
      }
      if (refresh) {
        // Refresh summary to sync derived lists (e.g., favoritePodcasts)
        await refreshFavorites();
      }
      return true;
    } catch {
      // Roll back optimistic update on failure
      rollbackFn();
      return false;
    } finally {
      inflightFavoriteOpsRef.current.delete(key);
    }
  }, [refreshFavorites]);

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

  // NOTE: `removeEpisodeFromPlaylist` previously lived here. It was
  // moved into `PlaylistContext` so the playlist optimistic store,
  // server response merging (which carries the freshly recalculated
  // `approximate_length_minutes`), and rollback-on-failure live in
  // one place. Callers should use `usePlaylistContext()` instead.

  return (
    <UserContext.Provider
      value={{
        user,
        setUser,
        loading,
        error,
        fetchUser,
        refreshUser: fetchUser,
        login,
        register,
        logout,
        isAuthenticated: !!user || !!djangoClient.getToken(),
        isPremium,
        isStaff,
        isSuperuser,
        isAdmin,
        userAge,
        canViewMature,
        guestAllowMature,
        setGuestAllowMature,
        // legacy trial
        isOnLegacyTrial,
        legacyTrialEnds,
        legacyTrialDaysRemaining,
        legacyPlanType,
        hasPaymentMethod,
        // unified trial (standard 7-day Stripe OR legacy imported)
        isOnTrial,
        trialType,
        trialEnds,
        trialDaysRemaining,
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
        markAllNotificationsRead,
        deleteNotification,
        clearAllNotifications,
        // listening history / episode progress
        episodeProgressMap,
        refreshHistory,
        updateEpisodeProgress,
        markEpisodeListened,
        markEpisodeUnplayed,
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
