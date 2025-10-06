import { db as drizzleDb } from "@/utils/drizzle/db";
import { analytics } from "@/utils/drizzle/schema";
import type { SQL } from "drizzle-orm";
import { sql } from "drizzle-orm";
import {
  AnalyticsFilters,
  AttemptHistoryResponse,
  AttemptHistoryResponseSchema,
  AttemptImprovementResponse,
  AttemptImprovementResponseSchema,
  CohortPerformanceResponse,
  CohortPerformanceResponseSchema,
  GrowthDataResponse,
  GrowthDataResponseSchema,
  HomeOverviewResponse,
  HomeOverviewResponseSchema,
  LeaderboardBundleResponse,
  LeaderboardBundleResponseSchema,
  MetricResponse,
  MetricResponseSchema,
  PersonaPerformanceResponse,
  PersonaPerformanceResponseSchema,
  PracticeOverviewResponse,
  PracticeOverviewResponseSchema,
  ReportsBundleResponse,
  ReportsBundleResponseSchema,
  RubricHeatmapResponse,
  RubricHeatmapResponseSchema,
  ScenarioPerformanceResponse,
  ScenarioPerformanceResponseSchema,
  ScenarioStatsResponse,
  ScenarioStatsResponseSchema,
  SimulationCompositionResponse,
  SimulationCompositionResponseSchema,
  SimulationPerformanceResponse,
  SimulationPerformanceResponseSchema,
  SkillPerformanceResponse,
  SkillPerformanceResponseSchema,
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
  filters: AnalyticsFilters,
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
        ) AS result`,
  );

  // Coerce unknown -> safe parse
  const raw = rows?.[0]?.result ?? MetricResponseFallback;

  return MetricResponseSchema.parse(raw);
}

// Helper to execute primary analytics functions
async function executePrimaryFunction<T>(
  fnName: string,
  filters: AnalyticsFilters,
  additionalParams: SQL[] = [],
): Promise<T> {
  const db = await getDb();

  // Normalize params so the SQL sees NULL or valid arrays (never `()` or scalars)
  const cohortIdsParam = toUuidArray(filters.cohortIds);
  const rolesParam = toProfileRoleArray(filters.roles);
  const simFiltersParam = toTextArray(filters.simulationFilters);
  const profileIdParam = filters.profileId ?? null; // uuid or null

  // Build the SQL with additional parameters
  const baseParams = [
    sql`${filters.startDate}::timestamptz`,
    sql`${filters.endDate}::timestamptz`,
    cohortIdsParam || sql`NULL`,
    rolesParam || sql`NULL`,
    simFiltersParam || sql`NULL`,
    sql`${profileIdParam}::uuid`,
  ];

  // Call the SQL function directly
  const rows = await db.execute<MetricRow>(
    sql`SELECT ${sql.raw(fnName)}(${sql.join([...baseParams, ...additionalParams], sql`, `)}) AS result`,
  );

  return rows?.[0]?.result as T;
}

export const analyticsRepo = {
  // Header Analytics (10 metrics)
  async getAverageScore(filters: AnalyticsFilters): Promise<MetricResponse> {
    return executeMetricFunction("analytics_average_score_fn", filters);
  },

  async getCompletionPercentage(
    filters: AnalyticsFilters,
  ): Promise<MetricResponse> {
    return executeMetricFunction("analytics_completion_percentage_fn", filters);
  },

  async getFirstAttemptPassRate(
    filters: AnalyticsFilters,
  ): Promise<MetricResponse> {
    return executeMetricFunction(
      "analytics_first_attempt_pass_rate_fn",
      filters,
    );
  },

  async getHighestScore(filters: AnalyticsFilters): Promise<MetricResponse> {
    return executeMetricFunction("analytics_highest_score_fn", filters);
  },

  async getMessagesPerSession(
    filters: AnalyticsFilters,
  ): Promise<MetricResponse> {
    return executeMetricFunction("analytics_messages_per_session_fn", filters);
  },

  async getPersonaResponseTimes(
    filters: AnalyticsFilters,
  ): Promise<MetricResponse> {
    return executeMetricFunction(
      "analytics_persona_response_times_fn",
      filters,
    );
  },

  async getSessionEfficiency(
    filters: AnalyticsFilters,
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
    filters: AnalyticsFilters,
  ): Promise<MetricResponse> {
    return executeMetricFunction("analytics_improvement_per_day_fn", filters);
  },

  async getPerfectScores(filters: AnalyticsFilters): Promise<MetricResponse> {
    return executeMetricFunction("analytics_perfect_scores_fn", filters);
  },

  async getQuickestPass(filters: AnalyticsFilters): Promise<MetricResponse> {
    return executeMetricFunction("analytics_quickest_pass_fn", filters);
  },

  // Primary Analytics (3 complex metrics)
  async getRubricHeatmap(
    filters: AnalyticsFilters,
  ): Promise<RubricHeatmapResponse> {
    const result = await executePrimaryFunction<unknown>(
      "analytics_rubric_heatmap_fn",
      filters,
    );
    return RubricHeatmapResponseSchema.parse(result);
  },

  async getGrowthData(filters: AnalyticsFilters): Promise<GrowthDataResponse> {
    const result = await executePrimaryFunction<unknown>(
      "analytics_growth_data_fn",
      filters,
    );
    return GrowthDataResponseSchema.parse(result);
  },

  async getPersonaPerformance(
    filters: AnalyticsFilters,
  ): Promise<PersonaPerformanceResponse> {
    const result = await executePrimaryFunction<unknown>(
      "analytics_persona_performance_fn",
      filters,
    );
    return PersonaPerformanceResponseSchema.parse(result);
  },

  // Secondary Analytics (3 complex metrics)
  async getAttemptImprovement(
    filters: AnalyticsFilters,
  ): Promise<AttemptImprovementResponse> {
    const result = await executePrimaryFunction<unknown>(
      "analytics_attempt_improvement_fn",
      filters,
    );
    return AttemptImprovementResponseSchema.parse(result);
  },

  async getCohortPerformance(
    filters: AnalyticsFilters,
  ): Promise<CohortPerformanceResponse> {
    const result = await executePrimaryFunction<unknown>(
      "analytics_cohort_performance_fn",
      filters,
    );
    return CohortPerformanceResponseSchema.parse(result);
  },

  async getSkillPerformance(
    filters: AnalyticsFilters,
  ): Promise<SkillPerformanceResponse> {
    const result = await executePrimaryFunction<unknown>(
      "analytics_skill_performance_fn",
      filters,
    );
    return SkillPerformanceResponseSchema.parse(result);
  },

  // Footer Analytics (4 new metrics)
  async getScenarioPerformance(
    filters: AnalyticsFilters,
  ): Promise<ScenarioPerformanceResponse> {
    const result = await executePrimaryFunction<unknown>(
      "analytics_scenario_performance_fn",
      filters,
    );
    return ScenarioPerformanceResponseSchema.parse(result);
  },

  async getScenarioStats(
    filters: AnalyticsFilters,
  ): Promise<ScenarioStatsResponse> {
    const result = await executePrimaryFunction<unknown>(
      "analytics_scenario_stats_fn",
      filters,
    );
    return ScenarioStatsResponseSchema.parse(result);
  },

  async getSimulationComposition(
    filters: AnalyticsFilters,
  ): Promise<SimulationCompositionResponse> {
    const result = await executePrimaryFunction<unknown>(
      "analytics_simulation_composition_fn",
      filters,
    );
    return SimulationCompositionResponseSchema.parse(result);
  },

  async getSimulationPerformance(
    filters: AnalyticsFilters,
  ): Promise<SimulationPerformanceResponse> {
    const result = await executePrimaryFunction<unknown>(
      "analytics_simulation_performance_fn",
      filters,
    );
    return SimulationPerformanceResponseSchema.parse(result);
  },

  // Home Analytics
  async getHomeOverview(
    filters: AnalyticsFilters,
  ): Promise<HomeOverviewResponse> {
    const result = await executePrimaryFunction<unknown>(
      "analytics_home_overview_fn",
      filters,
    );
    return HomeOverviewResponseSchema.parse(result);
  },

  // History Analytics
  async getAttemptHistory(
    filters: AnalyticsFilters,
  ): Promise<AttemptHistoryResponse> {
    const result = await executePrimaryFunction<unknown>(
      "analytics_attempt_history_fn",
      filters,
    );
    return AttemptHistoryResponseSchema.parse(result);
  },

  // Practice Analytics
  async getPracticeOverview(
    filters: AnalyticsFilters,
  ): Promise<PracticeOverviewResponse> {
    const result = await executePrimaryFunction<unknown>(
      "analytics_practice_overview_fn",
      filters,
    );
    return PracticeOverviewResponseSchema.parse(result);
  },

  // Reports Bundle Analytics
  async getReportsBundle(
    filters: AnalyticsFilters,
  ): Promise<ReportsBundleResponse> {
    const result = await executePrimaryFunction<unknown>(
      "analytics_reports_bundle_fn",
      filters,
    );
    return ReportsBundleResponseSchema.parse(result);
  },

  // Leaderboard Bundle Analytics
  async getLeaderboardBundle(
    filters: AnalyticsFilters,
  ): Promise<LeaderboardBundleResponse> {
    const result = await executePrimaryFunction<unknown>(
      "analytics_leaderboard_bundle_fn",
      filters,
    );
    return LeaderboardBundleResponseSchema.parse(result);
  },

  // Refresh materialized view
  async refreshMaterializedView(): Promise<void> {
    const db = await getDb();

    // Use CONCURRENTLY to avoid blocking reads during refresh
    await db.execute(sql`REFRESH MATERIALIZED VIEW CONCURRENTLY analytics`);
  },
};
