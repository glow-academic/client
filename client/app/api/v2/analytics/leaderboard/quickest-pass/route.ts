import { createAnalyticsBFFRoute } from "@/lib/api/v2/analytics-route-factory";

export const POST = createAnalyticsBFFRoute(
  "/leaderboard/quickest-pass",
  "analytics.v2.leaderboard.quickest-pass.error",
);

