import { createAnalyticsBFFRoute } from "@/lib/api/v2/analytics-route-factory";

export const POST = createAnalyticsBFFRoute(
  "/header/first-attempt-pass-rate",
  "analytics.v2.header.first-attempt-pass-rate.error",
);

