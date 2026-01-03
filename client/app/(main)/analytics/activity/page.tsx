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

/** ---- Strong types from OpenAPI ---- */
type ActivityBundleIn = InputOf<"/api/v4/activity/bundle", "post">;
type ActivityBundleOut = OutputOf<"/api/v4/activity/bundle", "post">;
type FeedbackListIn = InputOf<"/api/v4/feedback/list", "post">;
type FeedbackListOut = OutputOf<"/api/v4/feedback/list", "post">;
type ActivityListIn = InputOf<"/api/v4/activity/list", "post">;
type ActivityListOut = OutputOf<"/api/v4/activity/list", "post">;

export type ActivityOut = {
  bundleData: ActivityBundleOut | null;
  feedbackData: FeedbackListOut | null;
  activityData: ActivityListOut | null;
};

/** ---- Direct fetch functions ---- */
const getActivityBundle = async (
  input: ActivityBundleIn
): Promise<ActivityBundleOut> => {
  const bypassCache = await isHardRefresh();

  return api.post("/activity/bundle", input, {
    cache: "no-store",
    ...(bypassCache && {
      headers: {
        "X-Bypass-Cache": "1",
      },
    }),
  });
};

const getFeedbackList = async (
  input: FeedbackListIn
): Promise<FeedbackListOut> => {
  const bypassCache = await isHardRefresh();

  return api.post("/feedback/list", input, {
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

  return api.post("/activity/list", input, {
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
  // Access control handled server-side in layout
  // profileIds come from X-Profile-Id header (auto-injected by request-core.ts)

  // Parse search params
  const params = await searchParams;
  const searchParamsObj = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      if (Array.isArray(value)) {
        value.forEach((v) => searchParamsObj.append(key, v));
      } else {
        searchParamsObj.set(key, value);
      }
    }
  });

  // Extract pagination params for activity list
  const activityPage = searchParamsObj.get("activityPage")
    ? parseInt(searchParamsObj.get("activityPage") || "0", 10)
    : 0;
  const activityPageSize = searchParamsObj.get("activityPageSize")
    ? parseInt(searchParamsObj.get("activityPageSize") || "50", 10)
    : 50;
  const activitySearch = searchParamsObj.get("activitySearch") || undefined;

  // Create activityKey for Suspense boundary to trigger re-fetch on URL param changes
  const activityKey = [
    activityPage,
    activityPageSize,
    activitySearch || "",
  ].join("|");

  // Fetch bundle and feedback data server-side (no pagination)
  const bundleData = await getActivityBundle({ body: {} });
  const feedbackData = await getFeedbackList({ body: {} });

  // Create empty activity data for loading state
  const emptyActivityData: ActivityListOut = {
    activities: [],
    total_count: 0,
    page: activityPage,
    page_size: activityPageSize,
    total_pages: 0,
  };

  return (
    <div className="space-y-6" data-page="activity-index">
      {/* Activity list section with Suspense for pagination */}
      <Suspense
        key={activityKey}
        fallback={
          <Activity
            activityData={{
              bundleData,
              feedbackData,
              activityData: emptyActivityData,
            }}
            isLoading={true}
          />
        }
      >
        <ActivityListSection
          bundleData={bundleData}
          feedbackData={feedbackData}
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
  feedbackData,
  activityPage,
  activityPageSize,
  activitySearch,
}: {
  bundleData: ActivityBundleOut;
  feedbackData: FeedbackListOut;
  activityPage: number;
  activityPageSize: number;
  activitySearch?: string | undefined;
}) {
  const activityListData = await getActivityList({
    body: {
      page: activityPage,
      page_size: activityPageSize,
      ...(activitySearch && { search: activitySearch }),
    },
  });

  return (
    <Activity
      activityData={{
        bundleData,
        feedbackData,
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
  FeedbackListIn,
  FeedbackListOut,
};
