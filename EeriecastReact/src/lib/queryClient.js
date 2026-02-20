import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,      // 5 min — data is "fresh" for 5 minutes
      gcTime: 30 * 60 * 1000,         // 30 min — unused cache entries kept for 30 min
      refetchOnWindowFocus: true,
      retry: 1,
      refetchOnMount: true,
    },
  },
});
