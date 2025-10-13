import { createAnalyticsBFFRoute } from "@/lib/api/v2/analytics-route-factory";

export const POST = createAnalyticsBFFRoute(
  "/header/stagnation-rate",
  "analytics.v2.header.stagnation-rate.error",
);

