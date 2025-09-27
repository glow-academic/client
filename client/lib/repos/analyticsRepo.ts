import { db as drizzleDb } from "@/utils/drizzle/db";
import { analytics } from "@/utils/drizzle/schema";
import type { SQL } from "drizzle-orm";
import { sql } from "drizzle-orm";
import {
  AnalyticsFilters,
  MetricResponse,
  MetricResponseSchema,
} from "../analytics";

// Types from Drizzle materialized view
export type AnalyticsRecord = typeof analytics.$inferSelect;

// Helpers to build typed Postgres array literals.
// Returns `null` when the input is empty/undefined.
function toUuidArray(arr?: string[]): SQL | null {
  if (!arr || arr.length === 0) return null;
  const items = arr.map((v) => `'${v}'::uuid`).join(", ");
  return sql.raw(`ARRAY[${items}]`);
}

function toTextArray(arr?: string[]): SQL | null {
  if (!arr || arr.length === 0) return null;
  const items = arr.map((v) => `'${v.replace(/'/g, "''")}'`).join(", ");
  return sql.raw(`ARRAY[${items}]::text[]`);
}

function toProfileRoleArray(arr?: string[]): SQL | null {
  // profile_role is a Postgres enum in your schema
  if (!arr || arr.length === 0) return null;
  const items = arr.map((v) => `'${v}'::profile_role`).join(", ");
  return sql.raw(`ARRAY[${items}]`);
}

async function getDb() {
  return drizzleDb;
}

// Type the execute result to avoid indexing unknown
type MetricRow = { result: unknown };

// Make "method" always present in the fallback
const MetricResponseFallback: MetricResponse = {
  hasData: false,
  method: "avg",
  trendData: [],
  dataPoints: [],
};

// Helper to execute metric functions
async function executeMetricFunction(
  fnName: string,
  filters: AnalyticsFilters
): Promise<MetricResponse> {
  const db = await getDb();

  // Normalize params so the SQL sees NULL or valid arrays (never `()` or scalars)
  const cohortIdsParam = toUuidArray(filters.cohortIds);
  const rolesParam = toProfileRoleArray(filters.roles);
  const simFiltersParam = toTextArray(filters.simulationFilters);
  const profileIdParam = filters.profileId ?? null; // uuid or null

  // Call the SQL function directly
  const rows = await db.execute<MetricRow>(
    sql`SELECT ${sql.raw(fnName)}(
          ${filters.startDate}::timestamptz,
          ${filters.endDate}::timestamptz,
          ${cohortIdsParam},            -- uuid[] | NULL
          ${rolesParam},                -- profile_role[] | NULL
          ${simFiltersParam},           -- text[] | NULL
          ${profileIdParam}::uuid
        ) AS result`
  );

  // Coerce unknown -> safe parse
  const raw = rows?.[0]?.result ?? MetricResponseFallback;

  return MetricResponseSchema.parse(raw);
}

export const analyticsRepo = {
  // Header Analytics (10 metrics)
  async getAverageScore(filters: AnalyticsFilters): Promise<MetricResponse> {
    return executeMetricFunction("analytics_average_score_fn", filters);
  },

  async getCompletionPercentage(
    filters: AnalyticsFilters
  ): Promise<MetricResponse> {
    return executeMetricFunction("analytics_completion_percentage_fn", filters);
  },

  async getFirstAttemptPassRate(
    filters: AnalyticsFilters
  ): Promise<MetricResponse> {
    return executeMetricFunction(
      "analytics_first_attempt_pass_rate_fn",
      filters
    );
  },

  async getHighestScore(filters: AnalyticsFilters): Promise<MetricResponse> {
    return executeMetricFunction("analytics_highest_score_fn", filters);
  },

  async getMessagesPerSession(
    filters: AnalyticsFilters
  ): Promise<MetricResponse> {
    return executeMetricFunction("analytics_messages_per_session_fn", filters);
  },

  async getPersonaResponseTimes(
    filters: AnalyticsFilters
  ): Promise<MetricResponse> {
    return executeMetricFunction(
      "analytics_persona_response_times_fn",
      filters
    );
  },

  async getSessionEfficiency(
    filters: AnalyticsFilters
  ): Promise<MetricResponse> {
    return executeMetricFunction("analytics_session_efficiency_fn", filters);
  },

  async getStagnationRate(filters: AnalyticsFilters): Promise<MetricResponse> {
    return executeMetricFunction("analytics_stagnation_rate_fn", filters);
  },

  async getTimeSpent(filters: AnalyticsFilters): Promise<MetricResponse> {
    return executeMetricFunction("analytics_time_spent_fn", filters);
  },

  async getTotalAttempts(filters: AnalyticsFilters): Promise<MetricResponse> {
    return executeMetricFunction("analytics_total_attempts_fn", filters);
  },

  // Leaderboard Analytics (3 metrics)
  async getImprovementPerDay(
    filters: AnalyticsFilters
  ): Promise<MetricResponse> {
    return executeMetricFunction("analytics_improvement_per_day_fn", filters);
  },

  async getPerfectScores(filters: AnalyticsFilters): Promise<MetricResponse> {
    return executeMetricFunction("analytics_perfect_scores_fn", filters);
  },

  async getQuickestPass(filters: AnalyticsFilters): Promise<MetricResponse> {
    return executeMetricFunction("analytics_quickest_pass_fn", filters);
  },
};
