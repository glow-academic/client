import { api } from "@/lib/api/fetcher";
import {
  analyticsDashboardKeys,
  analyticsHomeKeys,
  analyticsKeys,
  analyticsLeaderboardKeys,
  analyticsPracticeKeys,
  analyticsReportsKeys,
} from "@/lib/api/keys";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

export type SimulationFilter = "general" | "practice" | "archived";

export type AnalyticsFilters = {
  startDate: string; // ISO
  endDate: string; // ISO
  cohortIds?: string[];
  roles?: string[]; // profile_role[]
  simulationFilters?: SimulationFilter[];
  profileId?: string;
};

export function useAnalyticsData(filters: AnalyticsFilters, enabled = true) {
  return useQuery({
    queryKey: analyticsKeys.list(filters),
    enabled,
    queryFn: () =>
      api<unknown[]>("/api/v1/analytics", {
        method: "POST",
        body: JSON.stringify(filters),
      }),
  });
}

// Zod schemas per view

// Leaderboard
export const LeaderboardRowSchema = z.object({
  profile_id: z.string().uuid(),
  first_name: z.string(),
  last_name: z.string(),
  total_attempts: z.number(),
  highest_score_avg: z.number(),
  messages_per_session: z.number(),
  time_spent_minutes: z.number(),
  quickest_pass_minutes: z.number(),
  most_improved_percent: z.number().optional().default(0),
  improvement_rate_per_day: z.number().optional().default(0),
  perfect_score_count: z.number().optional().default(0),
});
export const LeaderboardResponseSchema = z.array(LeaderboardRowSchema);

// Reports (per-profile aggregates)
export const ReportsRowSchema = z.object({
  profile_id: z.string().uuid(),
  first_name: z.string(),
  last_name: z.string(),
  total_attempts: z.number(),
  average_score: z.number(),
  messages_per_session: z.number(),
  time_spent_minutes: z.number(),
  pass_rate_fraction: z.number(),
});
export const ReportsResponseSchema = z.array(ReportsRowSchema);

// Dashboard header metrics
export const DashboardResponseSchema = z
  .object({
    average_score: z.number(),
    pass_rate_fraction: z.number(),
    messages_per_session: z.number(),
    time_spent_minutes: z.number(),
    total_attempts: z.number(),
  })
  .nullable();

// Home (simulation progress scaffold rows)
export const HomeRowSchema = z.object({
  simulation_id: z.string().uuid(),
  simulation_title: z.string(),
  total_members: z.number(),
  archived_count: z.number(),
  passed_count: z.number(),
  in_progress_count: z.number(),
  not_started_count: z.number(),
});
export const HomeResponseSchema = z.array(HomeRowSchema);

// Practice
export const PracticeRowSchema = z.object({
  simulation_id: z.string().uuid(),
  simulation_title: z.string(),
  highest_score: z.number(),
  has_passed: z.boolean(),
});
export const PracticeResponseSchema = z.array(PracticeRowSchema);

// Base analytics payload (from /api/v1/analytics)
const AttemptSchema = z.object({
  id: z.string().uuid(),
  profile_id: z.string().uuid().nullable().optional(),
  simulation_id: z.string().uuid(),
  created_at: z.string(),
  archived: z.boolean().optional(),
});
const ChatSchema = z.object({
  id: z.string().uuid(),
  attempt_id: z.string().uuid(),
  scenario_id: z.string().uuid().nullable().optional(),
  created_at: z.string(),
  completed_at: z.string().nullable().optional(),
});
const GradeSchema = z.object({
  id: z.string().uuid(),
  simulation_chat_id: z.string().uuid(),
  rubric_id: z.string().uuid(),
  score: z.number(),
  passed: z.boolean(),
  time_taken: z.number(),
  created_at: z.string().optional(),
});
const MessageSchema = z.object({
  id: z.string().uuid(),
  chat_id: z.string().uuid(),
  created_at: z.string().optional(),
});
const SimulationSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  rubric_id: z.string().uuid(),
  practice_simulation: z.boolean(),
});
const RubricSchema = z.object({
  id: z.string().uuid(),
  points: z.number(),
  pass_points: z.number(),
});
const ProfileSchema = z.object({
  id: z.string().uuid(),
  first_name: z.string(),
  last_name: z.string(),
});

export const AnalyticsBaseSchema = z.object({
  attempts: z.array(AttemptSchema),
  chats: z.array(ChatSchema),
  grades: z.array(GradeSchema),
  feedbacks: z.array(z.any()),
  messages: z.array(MessageSchema),
  simulations: z.array(SimulationSchema),
  scenarios: z.array(z.any()),
  profiles: z.array(ProfileSchema),
  cohorts: z.array(z.any()),
  rubrics: z.array(RubricSchema),
  standardGroups: z.array(z.any()),
  standards: z.array(z.any()),
});

export function useAnalyticsBaseData(
  filters: AnalyticsFilters,
  enabled = true
) {
  return useQuery({
    queryKey: analyticsKeys.list({ view: "base", ...filters }),
    enabled,
    queryFn: async () => {
      const res = await api<unknown>("/api/analytics", {
        method: "POST",
        body: JSON.stringify(filters),
      });
      return AnalyticsBaseSchema.parse(res);
    },
  });
}

// Hooks per view with schema validation

export function useAnalyticsLeaderboard(
  filters: AnalyticsFilters,
  enabled = true
) {
  return useQuery({
    queryKey: analyticsLeaderboardKeys.list(filters),
    enabled,
    queryFn: async () => {
      const res = await api<unknown[]>("/api/analytics/leaderboard", {
        method: "POST",
        body: JSON.stringify(filters),
      });
      return LeaderboardResponseSchema.parse(res);
    },
  });
}

export function useAnalyticsReports(filters: AnalyticsFilters, enabled = true) {
  return useQuery({
    queryKey: analyticsReportsKeys.list(filters),
    enabled,
    queryFn: async () => {
      const res = await api<unknown[]>("/api/v1/analytics/reports", {
        method: "POST",
        body: JSON.stringify(filters),
      });
      return ReportsResponseSchema.parse(res);
    },
  });
}

export function useAnalyticsDashboard(
  filters: AnalyticsFilters,
  enabled = true
) {
  return useQuery({
    queryKey: analyticsDashboardKeys.list(filters),
    enabled,
    queryFn: async () => {
      const res = await api<unknown | null>("/api/v1/analytics/dashboard", {
        method: "POST",
        body: JSON.stringify(filters),
      });
      return DashboardResponseSchema.parse(res);
    },
  });
}

export function useAnalyticsHome(filters: AnalyticsFilters, enabled = true) {
  return useQuery({
    queryKey: analyticsHomeKeys.list(filters),
    enabled,
    queryFn: async () => {
      const res = await api<unknown[]>("/api/v1/analytics/home", {
        method: "POST",
        body: JSON.stringify(filters),
      });
      return HomeResponseSchema.parse(res);
    },
  });
}

export function useAnalyticsPractice(
  filters: AnalyticsFilters,
  enabled = true
) {
  return useQuery({
    queryKey: analyticsPracticeKeys.list(filters),
    enabled,
    queryFn: async () => {
      const res = await api<unknown[]>("/api/analytics/practice", {
        method: "POST",
        body: JSON.stringify(filters),
      });
      return PracticeResponseSchema.parse(res);
    },
  });
}
