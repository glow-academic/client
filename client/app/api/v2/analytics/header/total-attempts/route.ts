import { createAnalyticsBFFRoute } from "@/lib/api/v2/analytics-route-factory";

export const POST = createAnalyticsBFFRoute(
  "/header/total-attempts",
  "analytics.v2.header.total-attempts.error",
);

