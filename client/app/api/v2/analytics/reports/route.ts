import { createAnalyticsBFFRoute } from "@/lib/api/v2/analytics-route-factory";

export const POST = createAnalyticsBFFRoute(
  "/reports",
  "analytics.v2.reports.error",
);

