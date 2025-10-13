import { createAnalyticsBFFRoute } from "@/lib/api/v2/analytics-route-factory";

export const POST = createAnalyticsBFFRoute(
  "/secondary/skill-performance",
  "analytics.v2.secondary.skill-performance.error",
);

