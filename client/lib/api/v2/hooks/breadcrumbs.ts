/**
 * Breadcrumbs hooks for v2 API
 */

import { api } from "@/lib/api/fetcher";
import { breadcrumbsKeys } from "@/lib/api/v2/keys";
import { BreadcrumbsResponseSchema } from "@/lib/api/v2/schemas/breadcrumbs";
import { useQuery } from "@tanstack/react-query";

export function useBreadcrumbs(pathname: string) {
  return useQuery({
    queryKey: breadcrumbsKeys.detail(pathname),
    queryFn: async () => {
      const res = await api<unknown>("/api/v2/breadcrumbs", {
        method: "POST",
        body: JSON.stringify({ pathname }),
      });
      return BreadcrumbsResponseSchema.parse(res);
    },
    staleTime: 0, // Always fetch fresh breadcrumbs on route change
    gcTime: 60 * 1000, // Cache for 1 minute in case user navigates back
  });
}
