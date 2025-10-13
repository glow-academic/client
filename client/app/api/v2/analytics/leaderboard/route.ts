import { createAnalyticsBFFRoute } from "@/lib/api/v2/analytics-route-factory";

export const POST = createAnalyticsBFFRoute(
  "/leaderboard",
  "analytics.v2.leaderboard.error",
);

