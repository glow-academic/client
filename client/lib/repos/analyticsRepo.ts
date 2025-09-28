import { db as drizzleDb } from "@/utils/drizzle/db";
import { analytics } from "@/utils/drizzle/schema";
import type { SQL } from "drizzle-orm";
import { sql } from "drizzle-orm";
import {
  AnalyticsFilters,
  AttemptImprovementFilters,
  AttemptImprovementResponse,
  AttemptImprovementResponseSchema,
  CohortPerformanceResponse,
  CohortPerformanceResponseSchema,
  GrowthDataResponse,
  GrowthDataResponseSchema,
  MetricResponse,
  MetricResponseSchema,
  PersonaPerformanceFilters,
  PersonaPerformanceResponse,
  PersonaPerformanceResponseSchema,
  RubricHeatmapFilters,
  RubricHeatmapResponse,
  RubricHeatmapResponseSchema,
  ScenarioPerformanceData,
  ScenarioPerformanceDataSchema,
  ScenarioStatsData,
  ScenarioStatsDataSchema,
  SimulationCompositionData,
  SimulationCompositionDataSchema,
  SimulationPerformanceData,
  SimulationPerformanceDataSchema,
  SkillPerformanceFilters,
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

// Helper to execute primary analytics functions
async function executePrimaryFunction<T>(
  fnName: string,
  filters: AnalyticsFilters,
  additionalParams: SQL[] = []
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
    sql`SELECT ${sql.raw(fnName)}(${sql.join([...baseParams, ...additionalParams], sql`, `)}) AS result`
  );

  return rows?.[0]?.result as T;
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

  // Primary Analytics (3 complex metrics)
  async getRubricHeatmap(
    filters: RubricHeatmapFilters
  ): Promise<RubricHeatmapResponse> {
    const result = await executePrimaryFunction<unknown>(
      "analytics_rubric_heatmap_fn",
      filters,
      [sql`${filters.rubricId}::uuid`]
    );
    return RubricHeatmapResponseSchema.parse(result);
  },

  async getGrowthData(filters: AnalyticsFilters): Promise<GrowthDataResponse> {
    const result = await executePrimaryFunction<unknown>(
      "analytics_growth_data_fn",
      filters
    );
    return GrowthDataResponseSchema.parse(result);
  },

  async getPersonaPerformance(
    filters: PersonaPerformanceFilters
  ): Promise<PersonaPerformanceResponse> {
    const simulationIdsParam =
      filters.simulationIds && filters.simulationIds.length > 0
        ? toUuidArray(filters.simulationIds) || sql`NULL`
        : sql`NULL`;

    const result = await executePrimaryFunction<unknown>(
      "analytics_persona_performance_fn",
      filters,
      [simulationIdsParam]
    );
    return PersonaPerformanceResponseSchema.parse(result);
  },

  // Secondary Analytics (3 complex metrics)
  async getAttemptImprovement(
    filters: AttemptImprovementFilters
  ): Promise<AttemptImprovementResponse> {
    const simulationIdsParam =
      filters.simulationIds && filters.simulationIds.length > 0
        ? toUuidArray(filters.simulationIds) || sql`NULL`
        : sql`NULL`;

    const result = await executePrimaryFunction<unknown>(
      "analytics_attempt_improvement_fn",
      filters,
      [simulationIdsParam]
    );
    return AttemptImprovementResponseSchema.parse(result);
  },

  async getCohortPerformance(
    filters: AnalyticsFilters
  ): Promise<CohortPerformanceResponse> {
    const result = await executePrimaryFunction<unknown>(
      "analytics_cohort_performance_fn",
      filters
    );
    return CohortPerformanceResponseSchema.parse(result);
  },

  async getSkillPerformance(
    filters: SkillPerformanceFilters
  ): Promise<SkillPerformanceResponse> {
    const rubricIdParam = filters.rubricId
      ? sql`${filters.rubricId}::uuid`
      : sql`NULL`;

    const result = await executePrimaryFunction<unknown>(
      "analytics_skill_performance_fn",
      filters,
      [rubricIdParam]
    );
    return SkillPerformanceResponseSchema.parse(result);
  },

  // Footer Analytics (4 new metrics)
  async getScenarioPerformance(
    filters: AnalyticsFilters,
    parameterId?: string,
    simulationIds?: string[]
  ): Promise<ScenarioPerformanceData> {
    const parameterIdParam = parameterId
      ? sql`${parameterId}::uuid`
      : sql`NULL`;
    const simulationIdsParam =
      simulationIds && simulationIds.length > 0
        ? toUuidArray(simulationIds) || sql`NULL`
        : sql`NULL`;

    const result = await executePrimaryFunction<unknown>(
      "analytics_scenario_performance_fn",
      filters,
      [parameterIdParam, simulationIdsParam]
    );
    return ScenarioPerformanceDataSchema.parse(result);
  },

  async getScenarioStats(
    filters: AnalyticsFilters,
    parameterId?: string,
    simulationIds?: string[]
  ): Promise<ScenarioStatsData> {
    const parameterIdParam = parameterId
      ? sql`${parameterId}::uuid`
      : sql`NULL`;
    const simulationIdsParam =
      simulationIds && simulationIds.length > 0
        ? toUuidArray(simulationIds) || sql`NULL`
        : sql`NULL`;

    const result = await executePrimaryFunction<unknown>(
      "analytics_scenario_stats_fn",
      filters,
      [parameterIdParam, simulationIdsParam]
    );
    return ScenarioStatsDataSchema.parse(result);
  },

  async getSimulationComposition(
    filters: AnalyticsFilters
  ): Promise<SimulationCompositionData> {
    const result = await executePrimaryFunction<unknown>(
      "analytics_simulation_composition_fn",
      filters
    );
    return SimulationCompositionDataSchema.parse(result);
  },

  async getSimulationPerformance(
    filters: AnalyticsFilters
  ): Promise<SimulationPerformanceData> {
    const result = await executePrimaryFunction<unknown>(
      "analytics_simulation_performance_fn",
      filters
    );
    return SimulationPerformanceDataSchema.parse(result);
  },
};
