import { createAnalyticsBFFRoute } from "@/lib/api/v2/analytics-route-factory";

export const POST = createAnalyticsBFFRoute(
  "/leaderboard/improvement-per-day",
  "analytics.v2.leaderboard.improvement-per-day.error",
);

