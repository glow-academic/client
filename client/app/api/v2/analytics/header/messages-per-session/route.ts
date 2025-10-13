import { createAnalyticsBFFRoute } from "@/lib/api/v2/analytics-route-factory";

export const POST = createAnalyticsBFFRoute(
  "/header/messages-per-session",
  "analytics.v2.header.messages-per-session.error",
);

