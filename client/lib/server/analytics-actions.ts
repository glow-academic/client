"use server";

import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";

type RefreshAnalyticsIn = InputOf<"/api/v3/analytics/refresh", "post">;
type RefreshAnalyticsOut = OutputOf<"/api/v3/analytics/refresh", "post">;

export async function refreshAnalytics(
  input: RefreshAnalyticsIn,
): Promise<RefreshAnalyticsOut> {
  return api.post("/analytics/refresh", input);
}
