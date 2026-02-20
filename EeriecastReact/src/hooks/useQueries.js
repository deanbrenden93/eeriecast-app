import { useQuery, useQueries } from '@tanstack/react-query';
import { Episode, Podcast as PodcastApi, UserLibrary } from '@/api/entities';

// ── Episode list (used by NewReleasesRow, Discover, etc.) ──
export function useEpisodeList(ordering = '-published_at', limit = 40) {
  return useQuery({
    queryKey: ['episodes', ordering, limit],
    queryFn: () => Episode.list(ordering, limit),
    staleTime: 5 * 60 * 1000,
  });
}

// ── Single episode detail ──
export function useEpisode(id) {
  return useQuery({
    queryKey: ['episode', id],
    queryFn: () => Episode.get(id),
    enabled: !!id,
    staleTime: 10 * 60 * 1000,
  });
}

// ── Batch episode details (parallel, deduplicated) ──
export function useEpisodeBatch(ids = []) {
  return useQueries({
    queries: ids.map((id) => ({
      queryKey: ['episode', id],
      queryFn: () => Episode.get(id),
      enabled: !!id,
      staleTime: 10 * 60 * 1000,
    })),
  });
}

// ── Podcast list ──
export function usePodcastList(sort = '-created_date') {
  return useQuery({
    queryKey: ['podcasts', sort],
    queryFn: () => PodcastApi.list(sort),
    staleTime: 5 * 60 * 1000,
  });
}

// ── Single podcast detail ──
export function usePodcastDetail(id) {
  return useQuery({
    queryKey: ['podcast', id],
    queryFn: () => PodcastApi.get(id),
    enabled: !!id,
    staleTime: 10 * 60 * 1000,
  });
}

// ── User listening history ──
export function useListeningHistory(enabled = true) {
  return useQuery({
    queryKey: ['listeningHistory'],
    queryFn: () => UserLibrary.getHistory(100),
    enabled,
    staleTime: 2 * 60 * 1000,
  });
}

// ── Keep Listening: parallel resume calls ──
export function useKeepListeningResume(podcastIds = [], enabled = true) {
  return useQueries({
    queries: podcastIds.map((pid) => ({
      queryKey: ['resume', pid],
      queryFn: () => UserLibrary.resumeForPodcast(pid).catch(() => null),
      enabled: enabled && !!pid,
      staleTime: 2 * 60 * 1000,
    })),
  });
}

// ── Favorites summary ──
export function useFavoritesSummary(userId) {
  return useQuery({
    queryKey: ['favorites', userId],
    queryFn: () => UserLibrary.getFavoritesSummary(),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });
}

// ── Followed podcasts ──
export function useFollowedPodcasts(userId) {
  return useQuery({
    queryKey: ['followedPodcasts', userId],
    queryFn: () => UserLibrary.getFollowedPodcasts(),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });
}

// ── Notifications ──
export function useNotifications(userId) {
  return useQuery({
    queryKey: ['notifications', userId],
    queryFn: () => UserLibrary.getNotifications(),
    enabled: !!userId,
    staleTime: 3 * 60 * 1000,
  });
}
