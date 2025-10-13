import { createAnalyticsBFFRoute } from "@/lib/api/v2/analytics-route-factory";

export const POST = createAnalyticsBFFRoute(
  "/footer/scenario-stats",
  "analytics.v2.footer.scenario-stats.error",
);

