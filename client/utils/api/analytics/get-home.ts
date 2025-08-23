import { api } from "@/lib/api/fetcher";

export type SimulationFilter = "general" | "practice" | "archived";

export type AnalyticsFilters = {
  startDate: string; // ISO
  endDate: string; // ISO
  cohortIds?: string[];
  roles?: string[]; // profile_role[]
  simulationFilters?: SimulationFilter[];
  profileId?: string;
};

export type HomeRow = {
  simulation_id: string;
  simulation_title: string;
  cohort_ids?: string[];
  cohort_titles?: string[];
  total_members: number;
  passed_count: number;
  in_progress_count: number;
  not_started_count: number;
  passed_members?: string[];
  in_progress_members?: string[];
};

export async function getAnalyticsHome(filters: AnalyticsFilters) {
  return api<HomeRow[]>("/api/analytics/home", {
    method: "POST",
    body: JSON.stringify(filters),
  });
}
