import { createAnalyticsBFFRoute } from "@/lib/api/v2/analytics-route-factory";

export const POST = createAnalyticsBFFRoute(
  "/header/session-efficiency",
  "analytics.v2.header.session-efficiency.error",
);

