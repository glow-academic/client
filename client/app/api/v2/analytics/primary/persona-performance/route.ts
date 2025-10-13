import { createAnalyticsBFFRoute } from "@/lib/api/v2/analytics-route-factory";

export const POST = createAnalyticsBFFRoute(
  "/primary/persona-performance",
  "analytics.v2.primary.persona-performance.error",
);

