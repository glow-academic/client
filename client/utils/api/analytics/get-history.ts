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

// Server payload row types (snake_case fields)
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

export type MessageRow = {
  id: string;
  chat_id: string;
  created_at?: string;
  type?: string;
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

export type CohortRow = {
  id: string;
  title: string;
  active: boolean;
  profile_ids: string[];
  simulation_ids: string[];
  created_at: string;
};

export type RubricRow = {
  id: string;
  points: number;
  pass_points: number;
};

export type StandardGroupRow = {
  id: string;
  rubric_id: string;
};

export type StandardRow = {
  id: string;
  standard_group_id: string;
};

export type AnalyticsBasePayload = {
  attempts: AttemptRow[];
  chats: ChatRow[];
  grades: GradeRow[];
  feedbacks: unknown[];
  messages: MessageRow[];
  simulations: SimulationRow[];
  scenarios: ScenarioRow[];
  profiles: ProfileRow[];
  cohorts: CohortRow[];
  rubrics: RubricRow[];
  standardGroups: StandardGroupRow[];
  standards: StandardRow[];
};

export async function getAnalyticsHistory(filters: AnalyticsFilters) {
  return api<AnalyticsBasePayload>("/api/analytics/history", {
    method: "POST",
    body: JSON.stringify(filters),
  });
}
