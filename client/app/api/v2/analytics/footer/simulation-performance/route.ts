import { createAnalyticsBFFRoute } from "@/lib/api/v2/analytics-route-factory";

export const POST = createAnalyticsBFFRoute(
  "/footer/simulation-performance",
  "analytics.v2.footer.simulation-performance.error",
);

