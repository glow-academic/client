/**
 * app/(main)/analytics/activity/page.tsx
 * Activity page for the analytics section.
 * @AshokSaravanan222 & @siladiea
 * 01/20/2025
 */

import Activity from "@/components/artifacts/activity/Activity";
import { AnalyticsFilters } from "@/components/common/layout/AnalyticsFilters";
import { PageHeader } from "@/components/common/layout/PageHeader";
import { refreshPage } from "@/app/(main)/layout-server";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import type { Metadata } from "next";
import { loadActivitySearchParams } from "@/lib/search-params/activity";

/** ---- Strong types from OpenAPI ---- */
type ActivityBundleIn = InputOf<"/activity/get", "post">;
type ActivityBundleOut = OutputOf<"/activity/get", "post">;
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

  return api.post("/activity/get", input, {
    cache: "no-store",
    ...(bypassCache && {
      headers: {
        "X-Bypass-Cache": "1",
      },
    }),
  });
};

/** ---- Docs types for page metadata ---- */
type DocsIn = InputOf<"/activity/docs", "post">;
type DocsOut = OutputOf<"/activity/docs", "post">;

const getDocs = async (input: DocsIn): Promise<DocsOut> => {
  return api.post("/activity/docs", input);
};

export async function generateMetadata(): Promise<Metadata> {
  const docs = await getDocs({ body: {} });
  return { title: docs.page_metadata?.list.title, description: docs.page_metadata?.list.description };
}

interface ActivityPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function ActivityPage({
  searchParams,
}: ActivityPageProps) {
  // Parse search params via nuqs loader
  const q = loadActivitySearchParams(await searchParams);

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
      ...(q.startDate && { date_from: q.startDate }),
      ...(q.endDate && { date_to: q.endDate }),
      ...(q.departmentIds?.length && { department_ids: q.departmentIds }),
      ...(q.roles?.length && { roles: q.roles }),
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

  // Extract inline analytics facets from response
  const facets = bundleData.analytics;

  // Extract embedded history or use empty fallback
  const activityData: ActivityListOut = bundleData.history ?? {
    items: [],
    total_count: 0,
    page: activityPage,
    page_size: activityPageSize,
    total_pages: 0,
  };

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { title: "Analytics", section: "analytics", url: "/analytics" },
          { title: "Activity" },
        ]}
        toolbar={
          <AnalyticsFilters
            refreshPage={refreshPage}
            analyticsFilters={facets}
          />
        }
      />
      <div className="space-y-6 px-4" data-page="activity-index">
        <Activity
          activityData={{
            bundleData,
            activityData,
          }}
          isLoading={false}
        />
      </div>
    </>
  );
}

/** ---- Export types for client (type-only imports) ---- */
export type { ActivityBundleIn, ActivityBundleOut, ActivityListOut };
