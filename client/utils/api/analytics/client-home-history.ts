import { api } from "@/lib/api/fetcher";
import type { HistoryResponse } from "@/utils/api/analytics/get-history";
import type { HomeRow } from "@/utils/api/analytics/get-home";

export type SimulationFilter = "general" | "practice" | "archived";

export type AnalyticsFilters = {
  startDate: string;
  endDate: string;
  cohortIds?: string[];
  roles?: string[];
  simulationFilters?: SimulationFilter[];
  profileId?: string | undefined;
};

export async function fetchAnalyticsHome(filters: AnalyticsFilters) {
  return api<HomeRow[]>("/api/analytics/home", {
    method: "POST",
    body: JSON.stringify(filters),
  });
}

export async function fetchAnalyticsHistory(filters: AnalyticsFilters) {
  return api<HistoryResponse>("/api/analytics/history", {
    method: "POST",
    body: JSON.stringify(filters),
  });
}
