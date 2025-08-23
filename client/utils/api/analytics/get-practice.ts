import { api } from "@/lib/api/fetcher";
import "server-only";

export type SimulationFilter = "general" | "practice" | "archived";

export type AnalyticsFilters = {
  startDate: string;
  endDate: string;
  cohortIds?: string[];
  roles?: string[];
  simulationFilters?: SimulationFilter[];
  profileId?: string;
};

export type PracticeRow = {
  simulation_id: string;
  simulation_title: string;
  highest_score: number;
  has_passed: boolean;
};

export async function getPracticeRows(filters: AnalyticsFilters) {
  return api<PracticeRow[]>("/api/analytics/practice", {
    method: "POST",
    body: JSON.stringify(filters),
  });
}
