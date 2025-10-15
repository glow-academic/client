import { createAnalyticsBFFRoute } from "@/lib/api/v2/analytics-route-factory";

export const POST = createAnalyticsBFFRoute(
  "/dashboard",
  "analytics.v2.dashboard.error"
);
