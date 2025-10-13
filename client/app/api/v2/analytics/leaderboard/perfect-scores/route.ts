import { createAnalyticsBFFRoute } from "@/lib/api/v2/analytics-route-factory";

export const POST = createAnalyticsBFFRoute(
  "/leaderboard/perfect-scores",
  "analytics.v2.leaderboard.perfect-scores.error",
);

