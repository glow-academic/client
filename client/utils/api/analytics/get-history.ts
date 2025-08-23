import { api } from "@/lib/api/fetcher";
import "server-only";

export type SimulationFilter = "general" | "practice" | "archived";

export type AnalyticsFilters = {
  startDate: string; // ISO
  endDate: string; // ISO
  cohortIds?: string[];
  roles?: string[]; // profile_role[]
  simulationFilters?: SimulationFilter[];
  profileId?: string;
};

// Minimal server payload row types (snake_case fields from server)
export type AttemptRow = {
  id: string;
  profile_id: string | null;
  simulation_id: string;
  created_at: string;
  archived?: boolean;
  infinite_mode?: boolean;
  infinite_mode_time_limit?: number | null;
};

export type ChatRow = {
  id: string;
  attempt_id: string;
  scenario_id: string | null;
  created_at: string;
  completed_at?: string | null;
  completed?: boolean;
};

export type GradeRow = {
  id: string;
  simulation_chat_id: string;
  rubric_id: string;
  score: number;
  passed: boolean;
  time_taken: number;
  created_at?: string;
};

export type SimulationRow = {
  id: string;
  title: string;
  rubric_id: string;
  practice_simulation: boolean;
  scenario_ids?: string[];
  description?: string | null;
  time_limit?: number | null;
  active?: boolean;
};

export type ScenarioRow = {
  id: string;
  name: string;
  persona_id: string | null;
  parent_id?: string | null;
  active?: boolean;
};

export type ProfileRow = {
  id: string;
  first_name: string;
  last_name: string;
  role?: string;
};

export type RubricRow = {
  id: string;
  points: number;
  pass_points: number;
};

export type HistoryRow = {
  id: string;
  profileId: string | null;
  profileName: string;
  simulationId: string;
  simulationTitle: string;
  createdAt: string;
  archived: boolean;
  infiniteMode?: boolean;
  infiniteModeTimeLimit?: number | null;
  scenarios: Array<{
    id: string;
    attemptId: string;
    scenarioId: string | null;
    createdAt: string;
    completedAt: string | null;
    completed: boolean;
  }>;
  interactionIds: string[];
  completedWithRubricCount: number;
  totalExpected: number;
  scorePercent: number;
  isPractice: boolean;
  rootScenarioIds: string[];
  personasTested: string[];
  isIncomplete: boolean;
};

export type HistoryResponse = {
  rows: HistoryRow[];
  profiles: Array<{ id: string; name: string }>;
  simulations: Array<{ id: string; title: string }>;
  rootScenarios: Array<{ id: string; name: string }>;
};

export async function getAnalyticsHistory(filters: AnalyticsFilters) {
  return api<HistoryResponse>("/api/analytics/history", {
    method: "POST",
    body: JSON.stringify(filters),
  });
}
