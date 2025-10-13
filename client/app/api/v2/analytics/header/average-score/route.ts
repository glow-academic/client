import { createAnalyticsBFFRoute } from "@/lib/api/v2/analytics-route-factory";

export const POST = createAnalyticsBFFRoute(
  "/header/average-score",
  "analytics.v2.header.average-score.error"
);
