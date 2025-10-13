import { createAnalyticsBFFRoute } from "@/lib/api/v2/analytics-route-factory";

export const POST = createAnalyticsBFFRoute(
  "/secondary/cohort-performance",
  "analytics.v2.secondary.cohort-performance.error",
);

