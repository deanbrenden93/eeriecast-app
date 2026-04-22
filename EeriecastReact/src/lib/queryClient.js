import { QueryClient } from '@tanstack/react-query';

/**
 * App-wide TanStack Query client.
 *
 * Sensible defaults for a streaming/content app:
 *   - staleTime: 60s → cached responses are treated as fresh for a minute,
 *     so re-visiting the home screen doesn't refetch and flash skeletons.
 *   - gcTime: 5min → unmounted queries stay in cache for five minutes before
 *     they're garbage-collected.
 *   - refetchOnWindowFocus: revalidate silently when the user returns to the
 *     tab (the user never sees a spinner because cached data is shown first).
 *   - retry: 1 → one automatic retry on failure, then surface the error.
 *
 * Individual `useQuery` calls can override any of these via their options.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      gcTime: 5 * 60 * 1000,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      retry: 1,
      refetchOnMount: false,
    },
  },
});

/**
 * Namespaced query keys. Centralizing them avoids typos and makes targeted
 * invalidation (e.g. `queryClient.invalidateQueries({ queryKey: qk.episodes.all() })`)
 * straightforward from anywhere in the app.
 */
export const qk = {
  episodes: {
    all: () => ['episodes'],
    feed: (feedType, params = {}) => ['episodes', 'feed', feedType, params],
    allPaginated: (params = {}) => ['episodes', 'all-paginated', params],
    detail: (id) => ['episodes', 'detail', id],
  },
  library: {
    history: (limit) => ['library', 'history', { limit }],
  },
  podcast: {
    detail: (id) => ['podcast', 'detail', id],
  },
};
