/**
 * Server-side fetcher functions for analytics v2 API
 * Memoized with React cache to prevent duplicate requests
 * Used for server-side prefetching in Next.js pages and BFF routes
 */

import { getApiBase } from "@/lib/api-base";
import { cache } from "react";
import {
  AnalyticsFilters,
  AttemptHistoryResponseSchema,
  DashboardBundleResponseSchema,
  HomeOverviewResponseSchema,
  LeaderboardBundleResponseSchema,
  PracticeOverviewResponseSchema,
  PricingAnalyticsResponseSchema,
  ReportsBundleResponseSchema,
} from "../schemas/analytics";

/**
 * Fetch home overview analytics from FastAPI server (memoized)
 */
export const fetchAnalyticsHome = cache(async (filters: AnalyticsFilters) => {
  const res = await fetch(`${getApiBase()}/api/v2/analytics/home`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(filters),
  });

  if (!res.ok) {
    throw new Error("Failed to fetch analytics home");
  }

  const data = await res.json();
  return HomeOverviewResponseSchema.parse(data);
});

/**
 * Fetch practice overview analytics from FastAPI server (memoized)
 */
export const fetchAnalyticsPractice = cache(
  async (filters: AnalyticsFilters) => {
    const res = await fetch(`${getApiBase()}/api/v2/analytics/practice`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(filters),
    });

    if (!res.ok) {
      throw new Error("Failed to fetch analytics practice");
    }

    const data = await res.json();
    return PracticeOverviewResponseSchema.parse(data);
  }
);

/**
 * Fetch dashboard bundle analytics from FastAPI server (memoized)
 */
export const fetchAnalyticsDashboard = cache(
  async (filters: AnalyticsFilters) => {
    const res = await fetch(`${getApiBase()}/api/v2/analytics/dashboard`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(filters),
    });

    if (!res.ok) {
      throw new Error("Failed to fetch analytics dashboard");
    }

    const data = await res.json();
    return DashboardBundleResponseSchema.parse(data);
  }
);

/**
 * Fetch reports bundle analytics from FastAPI server (memoized)
 */
export const fetchAnalyticsReports = cache(
  async (filters: AnalyticsFilters) => {
    const res = await fetch(`${getApiBase()}/api/v2/analytics/reports`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(filters),
    });

    if (!res.ok) {
      throw new Error("Failed to fetch analytics reports");
    }

    const data = await res.json();
    return ReportsBundleResponseSchema.parse(data);
  }
);

/**
 * Fetch analytics leaderboard bundle from FastAPI server (memoized)
 * Used for prefetching leaderboard data in cohort pages
 * Includes leaderboard rows with all metrics computed server-side
 */
export const fetchAnalyticsLeaderboard = cache(
  async (filters: AnalyticsFilters) => {
    const res = await fetch(`${getApiBase()}/api/v2/analytics/leaderboard`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(filters),
    });

    if (!res.ok) {
      throw new Error("Failed to fetch analytics leaderboard");
    }

    const data = await res.json();
    return LeaderboardBundleResponseSchema.parse(data);
  }
);

/**
 * Fetch attempt history analytics from FastAPI server (memoized)
 */
export const fetchAnalyticsHistory = cache(
  async (filters: AnalyticsFilters) => {
    const res = await fetch(`${getApiBase()}/api/v2/analytics/history`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(filters),
    });

    if (!res.ok) {
      throw new Error("Failed to fetch analytics history");
    }

    const data = await res.json();
    return AttemptHistoryResponseSchema.parse(data);
  }
);

/**
 * Fetch pricing analytics from FastAPI server (memoized)
 */
export const fetchAnalyticsPricing = cache(
  async (filters: AnalyticsFilters) => {
    const res = await fetch(`${getApiBase()}/api/v2/analytics/pricing`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(filters),
    });

    if (!res.ok) {
      throw new Error("Failed to fetch analytics pricing");
    }

    const data = await res.json();
    return PricingAnalyticsResponseSchema.parse(data);
  }
);
