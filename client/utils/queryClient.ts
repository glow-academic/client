// utils/react-query/queryClient.ts
import { QueryClient } from "@tanstack/react-query";

let client: QueryClient | null = null;

export const getQueryClient = () => {
  if (!client) {
    client = new QueryClient({
      defaultOptions: {
        queries: { staleTime: 60_000, refetchOnWindowFocus: false },
      },
    });
  }
  return client;
};
