import { createAnalyticsBFFRoute } from "@/lib/api/v2/analytics-route-factory";

export const POST = createAnalyticsBFFRoute(
  "/header/time-spent",
  "analytics.v2.header.time-spent.error",
);

