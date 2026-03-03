/**
 * app/(main)/analytics/activity/page.tsx
 * Activity page for the analytics section.
 * @AshokSaravanan222 & @siladiea
 * 01/20/2025
 */

import Activity from "@/components/artifacts/activity/Activity";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import {
  computeAnalyticsDefaults,
  resolveAnalyticsFilters,
} from "@/lib/search-params/analytics-defaults";
import type { Metadata } from "next";
import { loadActivitySearchParams } from "@/lib/search-params/activity";

/** ---- Strong types from OpenAPI ---- */
type ActivityBundleIn = InputOf<"/api/v5/artifacts/activity/get", "post">;
type ActivityBundleOut = OutputOf<"/api/v5/artifacts/activity/get", "post">;
type ActivityListOut = NonNullable<ActivityBundleOut["history"]>;

export type ActivityOut = {
  bundleData: ActivityBundleOut | null;
  activityData: ActivityListOut | null;
};

/** ---- Direct fetch functions ---- */
const getActivityBundle = async (
  input: ActivityBundleIn
): Promise<ActivityBundleOut> => {
  const bypassCache = await isHardRefresh();

  return api.post("/artifacts/activity/get", input, {
    cache: "no-store",
    ...(bypassCache && {
      headers: {
        "X-Bypass-Cache": "1",
      },
    }),
  });
};

/** ---- Docs types for page metadata ---- */
type DocsIn = InputOf<"/api/v5/artifacts/activity/docs", "post">;
type DocsOut = OutputOf<"/api/v5/artifacts/activity/docs", "post">;

const getDocs = async (input: DocsIn): Promise<DocsOut> => {
  return api.post("/artifacts/activity/docs", input);
};

export async function generateMetadata(): Promise<Metadata> {
  const docs = await getDocs({ body: {} });
  return { title: docs.list.title, description: docs.list.description };
}

interface ActivityPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function ActivityPage({
  searchParams,
}: ActivityPageProps) {
  // Parse search params via nuqs loader
  const q = loadActivitySearchParams(await searchParams);

  // Compute defaults and resolve filters
  const { defaults, profileContext } = await computeAnalyticsDefaults();
  const filters = resolveAnalyticsFilters(q, defaults, profileContext);

  // Activity-specific params with defaults
  const activityPage = q.activityPage ?? 0;
  const activityPageSize = q.activityPageSize ?? 50;

  // Profile summary filter from search params
  const rawParams = await searchParams;
  const summaryProfileId = typeof rawParams.summaryProfileId === "string"
    ? rawParams.summaryProfileId
    : undefined;

  // Fetch bundle + embedded session history in a single API call
  const bundleData = await getActivityBundle({
    body: {
      date_from: filters.startDate,
      date_to: filters.endDate,
      department_ids: filters.departmentIds,
      roles: filters.roles,
      page_limit: 50,
      page_offset: 0,
      summary_profile_id: summaryProfileId,
      // Embedded session history params
      history_page: activityPage,
      history_page_size: activityPageSize,
      history_sort_by: "date",
      history_sort_order: "desc",
    },
  });

  // Extract embedded history or use empty fallback
  const activityData: ActivityListOut = bundleData.history ?? {
    items: [],
    total_count: 0,
    page: activityPage,
    page_size: activityPageSize,
    total_pages: 0,
  };

  return (
    <div className="space-y-6" data-page="activity-index">
      <Activity
        activityData={{
          bundleData,
          activityData,
        }}
        isLoading={false}
      />
    </div>
  );
}

/** ---- Export types for client (type-only imports) ---- */
export type { ActivityBundleIn, ActivityBundleOut, ActivityListOut };
