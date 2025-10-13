import { createAnalyticsBFFRoute } from "@/lib/api/v2/analytics-route-factory";

export const POST = createAnalyticsBFFRoute(
  "/header/highest-score",
  "analytics.v2.header.highest-score.error",
);

