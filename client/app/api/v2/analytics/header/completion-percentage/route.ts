import { createAnalyticsBFFRoute } from "@/lib/api/v2/analytics-route-factory";

export const POST = createAnalyticsBFFRoute(
  "/header/completion-percentage",
  "analytics.v2.header.completion-percentage.error",
);

