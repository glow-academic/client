import { createAnalyticsBFFRoute } from "@/lib/api/v2/analytics-route-factory";

export const POST = createAnalyticsBFFRoute(
  "/primary/rubric-heatmap",
  "analytics.v2.primary.rubric-heatmap.error",
);

