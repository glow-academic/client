import { createAnalyticsBFFRoute } from "@/lib/api/v2/analytics-route-factory";

export const POST = createAnalyticsBFFRoute(
  "/secondary/attempt-improvement",
  "analytics.v2.secondary.attempt-improvement.error",
);

