import { createAnalyticsBFFRoute } from "@/lib/api/v2/analytics-route-factory";

export const POST = createAnalyticsBFFRoute(
  "/header/persona-response-times",
  "analytics.v2.header.persona-response-times.error",
);

