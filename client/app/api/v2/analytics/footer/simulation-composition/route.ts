import { createAnalyticsBFFRoute } from "@/lib/api/v2/analytics-route-factory";

export const POST = createAnalyticsBFFRoute(
  "/footer/simulation-composition",
  "analytics.v2.footer.simulation-composition.error",
);

