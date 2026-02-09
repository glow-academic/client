/**
 * app/(main)/analytics/activity/page.tsx
 * Activity page for the analytics section.
 * @AshokSaravanan222 & @siladiea
 * 01/20/2025
 */

import Activity from "@/components/activity/Activity";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import type { Metadata } from "next";
import { Suspense } from "react";
import { loadActivitySearchParams } from "./searchParams";

/** ---- Strong types from OpenAPI ---- */
type ActivityBundleIn = InputOf<"/api/v4/artifacts/activity/get", "post">;
type ActivityBundleOut = OutputOf<"/api/v4/artifacts/activity/get", "post">;
type ActivityListIn = InputOf<"/api/v4/artifacts/session/list", "post">;
type ActivityListOut = OutputOf<"/api/v4/artifacts/session/list", "post">;

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

const getActivityList = async (
  input: ActivityListIn
): Promise<ActivityListOut> => {
  const bypassCache = await isHardRefresh();

  return api.post("/artifacts/session/list", input, {
    cache: "no-store",
    ...(bypassCache && {
      headers: {
        "X-Bypass-Cache": "1",
      },
    }),
  });
};

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Activity",
    description:
      "View activity logs and user interactions across the platform. Track system events, user actions, and engagement metrics for comprehensive activity monitoring.",
  };
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
  const activitySearch = q.activitySearch ?? undefined;

  // Create activityKey for Suspense boundary to trigger re-fetch on URL param changes
  const activityKey = [
    activityPage,
    activityPageSize,
    activitySearch || "",
  ].join("|");

  // Fetch bundle data server-side (no pagination)
  const bundleData = await getActivityBundle({ body: {} });

  // Create empty sessions data for loading state
  const emptyActivityData: ActivityListOut = {
    items: [],
    total_count: 0,
    page: activityPage,
    page_size: activityPageSize,
    total_pages: 0,
  };

  return (
    <div className="space-y-6" data-page="activity-index">
      <Suspense
        key={activityKey}
        fallback={
          <Activity
            activityData={{
              bundleData,
              activityData: emptyActivityData,
            }}
            isLoading={true}
          />
        }
      >
        <ActivityListSection
          bundleData={bundleData}
          activityPage={activityPage}
          activityPageSize={activityPageSize}
          activitySearch={activitySearch}
        />
      </Suspense>
    </div>
  );
}

/** ---- Inline activity list section component (only used here) ---- */
async function ActivityListSection({
  bundleData,
  activityPage,
  activityPageSize,
  activitySearch,
}: {
  bundleData: ActivityBundleOut;
  activityPage: number;
  activityPageSize: number;
  activitySearch?: string | undefined;
}) {
  const activityListData = await getActivityList({
    body: {
      page_limit: activityPageSize,
      page_offset: activityPage * activityPageSize,
      ...(activitySearch && { search: activitySearch }),
    },
  });

  return (
    <Activity
      activityData={{
        bundleData,
        activityData: activityListData,
      }}
      isLoading={false}
    />
  );
}

/** ---- Export types for client (type-only imports) ---- */
export type {
  ActivityBundleIn,
  ActivityBundleOut,
  ActivityListIn,
  ActivityListOut,
};
