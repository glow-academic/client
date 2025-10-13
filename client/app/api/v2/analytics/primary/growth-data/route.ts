import { createAnalyticsBFFRoute } from "@/lib/api/v2/analytics-route-factory";

export const POST = createAnalyticsBFFRoute(
  "/primary/growth-data",
  "analytics.v2.primary.growth-data.error",
);

