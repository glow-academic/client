/**
 * Analytics V2 API Schemas
 * Explicit schema definitions for server analytics endpoints
 * Note: These mirror the schemas from @/lib/analytics.ts but are defined
 * here explicitly to keep v2 API types independent and extensible
 */

import { z } from "zod";

// ============================================================================
// REQUEST SCHEMAS
// ============================================================================

export const AnalyticsFiltersSchema = z.object({
  startDate: z.string(),
  endDate: z.string(),
  cohortIds: z.array(z.string()).optional(),
  roles: z.array(z.string()).optional(),
  simulationFilters: z
    .array(z.enum(["general", "practice", "archived"]))
    .optional(),
  profileId: z.string().optional(),
  departmentIds: z.array(z.string()).optional(),
});

export type AnalyticsFilters = z.infer<typeof AnalyticsFiltersSchema>;

// ============================================================================
// BASIC RESPONSE SCHEMAS
// ============================================================================

export const MethodSchema = z.enum([
  "avg",
  "max",
  "sum",
  "rate",
  "countDistinct",
  "min",
  "slope",
]);

export const TrendDataSchema = z.object({
  date: z.string(),
  value: z.number(),
  count: z.number(),
});

export const DataPointSchema = z.object({
  profileId: z.string(),
  date: z.string().optional(),
  value: z.number().optional(),
  attemptId: z.string().optional(),
  simulationId: z.string().optional(),
  scenarioId: z.string().optional(),
  count: z.number().optional(),
});

export const MetricResponseSchema = z.object({
  hasData: z.boolean(),
  method: MethodSchema,
  valueField: z.string().optional(),
  keyField: z.string().optional(),
  trendData: z.array(TrendDataSchema),
  dataPoints: z.array(DataPointSchema),
});

export type Method = z.infer<typeof MethodSchema>;
export type TrendData = z.infer<typeof TrendDataSchema>;
export type DataPoint = z.infer<typeof DataPointSchema>;
export type MetricResponse = z.infer<typeof MetricResponseSchema>;

// ============================================================================
// PRIMARY ANALYTICS SCHEMAS
// ============================================================================

// Rubric Heatmap
export const RubricHeatmapCellSchema = z.object({
  rubricId: z.string(),
  correlation: z.number(),
  pValue: z.number().nullable(),
  color: z.string(),
  strength: z.string(),
  dataPoints: z.number(),
});

export const StandardGroupSchema = z.object({
  id: z.string(),
  name: z.string(),
  shortName: z.string().nullable(),
  rubricId: z.string(),
});

export const RubricMatrixPackageSchema = z.object({
  rubricId: z.string(),
  standardGroups: z.array(StandardGroupSchema),
  matrix: z.array(z.array(RubricHeatmapCellSchema)),
  insights: z.string().nullable(),
  hasData: z.boolean(),
});

export const RubricHeatmapResponseSchema = z.object({
  matrices: z.array(RubricMatrixPackageSchema),
  validRubricIds: z.array(z.string()),
});

export type RubricHeatmapResponse = z.infer<typeof RubricHeatmapResponseSchema>;

// Growth Data
export const GrowthDataPointSchema = z.object({
  date: z.string(),
  averageScore: z.number().nullable(),
  passRate: z.number().nullable(),
  completionRate: z.number().nullable(),
  firstAttemptPassRate: z.number().nullable(),
  messagesPerSession: z.number().nullable(),
  personaResponseTimes: z.number().nullable(),
  sessionEfficiency: z.number().nullable(),
  stagnationRate: z.number().nullable(),
  timeSpent: z.number().nullable(),
  totalAttempts: z.number().nullable(),
});

export const GrowthMetricSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string(),
  unit: z.string(),
  description: z.string(),
  formatterId: z.enum(["percent", "int", "sec", "min", "hours", "minutes"]),
});

export const GrowthWindowAverageSchema = z.object({
  n: z.number(),
  last: z.number().nullable(),
  prev: z.number().nullable(),
});

export const GrowthWindowAveragesSchema = z.object({
  averageScore: GrowthWindowAverageSchema,
});

export const GrowthDataResponseSchema = z.object({
  chartData: z.array(GrowthDataPointSchema),
  availableMetrics: z.array(GrowthMetricSchema),
  windowAverages: GrowthWindowAveragesSchema,
});

export type GrowthDataResponse = z.infer<typeof GrowthDataResponseSchema>;

// Persona Performance
export const PersonaTrendDataSchema = z.object({
  date: z.string(),
  score: z.number().nullable(),
  timestamp: z.number(),
  simulationId: z.string().optional(),
});

export const PersonaPerformanceDataSchema = z.object({
  name: z.string(),
  score: z.number(),
  sessions: z.number(),
  color: z.string(),
  simulationIds: z.array(z.string()).optional(),
  trendData: z.array(PersonaTrendDataSchema),
});

export const PersonaPerformanceResponseSchema = z.object({
  chartData: z.array(PersonaPerformanceDataSchema),
  validSimulationIds: z.array(z.string()),
  personaColors: z.record(z.string(), z.string()),
});

export type PersonaPerformanceResponse = z.infer<
  typeof PersonaPerformanceResponseSchema
>;

// ============================================================================
// SECONDARY ANALYTICS SCHEMAS
// ============================================================================

// Attempt Improvement
export const AttemptImprovementDataSchema = z.object({
  attempt: z.string(),
  "Average Score": z.number(),
  "Average Time": z.number(),
  "Pass Rate": z.number(),
});

export const AttemptImprovementFactSchema = z.object({
  simulationId: z.string(),
  attemptNo: z.number(),
  avgGrade: z.number(),
  avgMinutes: z.number(),
  passRate: z.number(),
});

export const AttemptImprovementResponseSchema = z.object({
  chartData: z.array(AttemptImprovementDataSchema),
  facts: z.array(AttemptImprovementFactSchema),
  validSimulationIds: z.array(z.string()),
});

export type AttemptImprovementResponse = z.infer<
  typeof AttemptImprovementResponseSchema
>;

// Cohort Performance
export const CohortDataSchema = z.object({
  id: z.string(),
  name: z.string(),
  passRate: z.number(),
  avgPercentageScore: z.number(),
  totalStudents: z.number(),
  passedStudents: z.number(),
  totalAttempts: z.number(),
  passedAttempts: z.number(),
  simulationCount: z.number(),
  requiredSimulations: z.number(),
});

export const DailyDataSchema = z.object({
  date: z.string(),
  avgScore: z.number(),
  cohortId: z.string().optional(),
});

export const CohortFactSchema = z.object({
  cohortId: z.string(),
  simulationId: z.string(),
  passRate: z.number(),
  avgScore: z.number(),
  attempts: z.number(),
});

export const CohortDailyFactSchema = z.object({
  date: z.string(),
  simulationId: z.string(),
  avgScore: z.number(),
});

export const CohortPerformanceResponseSchema = z.object({
  cohortData: z.array(CohortDataSchema),
  dailyData: z.array(DailyDataSchema),
  cohortFacts: z.array(CohortFactSchema),
  dailyFacts: z.array(CohortDailyFactSchema),
  validSimulationIds: z.array(z.string()),
});

export type CohortPerformanceResponse = z.infer<
  typeof CohortPerformanceResponseSchema
>;

// Skill Performance
export const SkillRadarDataSchema = z.object({
  metric: z.string(),
  description: z.string().optional(),
  value: z.number(),
  fullMark: z.number(),
});

export const SkillStandardFactSchema = z.object({
  groupId: z.string(),
  groupName: z.string(),
  groupDescription: z.string().optional(),
  simulationId: z.string(),
  score: z.number(),
  points: z.number(),
  avgPct: z.number(),
});

export const SkillPackageSchema = z.object({
  rubricId: z.string(),
  radarData: z.array(SkillRadarDataSchema),
  groupFacts: z.array(SkillStandardFactSchema),
});

export const SkillPerformanceResponseSchema = z.object({
  packages: z.array(SkillPackageSchema),
  validRubricIds: z.array(z.string()),
});

export type SkillPerformanceResponse = z.infer<
  typeof SkillPerformanceResponseSchema
>;

// ============================================================================
// FOOTER ANALYTICS SCHEMAS
// ============================================================================

// Scenario Performance
export const ScenarioAttributeAttemptFactSchema = z.object({
  parameterId: z.string(),
  parameterItemId: z.string(),
  date: z.string(),
  timestamp: z.number(),
  avgScore: z.number(),
  attempts: z.number(),
  passedAttempts: z.number(),
});

export const ScenarioAttributeScenarioFactSchema = z.object({
  parameterId: z.string(),
  parameterItemId: z.string(),
  scenarioId: z.string(),
});

export const ScenarioPerformanceResponseSchema = z.object({
  validParameterIds: z.array(z.string()),
  attributeAttemptFacts: z.array(ScenarioAttributeAttemptFactSchema),
  attributeScenarioFacts: z.array(ScenarioAttributeScenarioFactSchema),
});

export type ScenarioPerformanceResponse = z.infer<
  typeof ScenarioPerformanceResponseSchema
>;

// Scenario Stats
export const NumericAttemptFactSchema = z.object({
  parameterId: z.string(),
  levelLabel: z.string(),
  levelValue: z.number(),
  score: z.number(),
  attempts: z.number(),
});

export const NumericScenarioFactSchema = z.object({
  parameterId: z.string(),
  scenarioId: z.string(),
  levelLabel: z.string(),
  levelValue: z.number(),
});

export const ScenarioStatsResponseSchema = z.object({
  validNumericParameterIds: z.array(z.string()),
  numericAttemptFacts: z.array(NumericAttemptFactSchema),
  numericScenarioFacts: z.array(NumericScenarioFactSchema),
});

export type ScenarioStatsResponse = z.infer<typeof ScenarioStatsResponseSchema>;

// Simulation Composition
export const SimulationFactSchema = z.object({
  simulationId: z.string(),
  title: z.string(),
  avgScore: z.number(),
  completionRate: z.number(),
  totalAttempts: z.number(),
  scenarioCount: z.number(),
});

export const SimulationParameterFactCategoricalSchema = z.object({
  simulationId: z.string(),
  parameterId: z.string(),
  parameterItemId: z.string(),
  scenarioCount: z.number(),
});

export const SimulationParameterFactNumericSchema = z.object({
  simulationId: z.string(),
  parameterId: z.string(),
  avgLevel: z.number(),
  levelLabel: z.string(),
  scenarioCount: z.number(),
});

export const SimulationCompositionResponseSchema = z.object({
  validSimulationIds: z.array(z.string()),
  simulationFacts: z.array(SimulationFactSchema),
  simulationParameterFactsCategorical: z.array(
    SimulationParameterFactCategoricalSchema,
  ),
  simulationParameterFactsNumeric: z.array(
    SimulationParameterFactNumericSchema,
  ),
  hasData: z.boolean(),
});

export type SimulationCompositionResponse = z.infer<
  typeof SimulationCompositionResponseSchema
>;

// Simulation Performance
export const ScenarioFactSchema = z.object({
  simulationId: z.string(),
  scenarioId: z.string(),
  scenarioName: z.string(),
  avgScore: z.number(),
  successRate: z.number(),
  totalAttempts: z.number(),
  completedAttempts: z.number(),
});

export const SimulationPerformanceResponseSchema = z.object({
  validSimulationIds: z.array(z.string()),
  scenarioFacts: z.array(ScenarioFactSchema),
});

export type SimulationPerformanceResponse = z.infer<
  typeof SimulationPerformanceResponseSchema
>;

// ============================================================================
// PAGE-SPECIFIC SCHEMAS
// ============================================================================

// Home Overview
export const HomeSimulationItemSchema = z.object({
  viewMode: z.enum(["ta", "instructional"]),
  id: z.string(),
  simulationTitle: z.string(),
  simulationDescription: z.string().nullable(),
  simulationName: z.string(),
  timeLimit: z.number().nullable().optional(),
  numSessions: z.number(),
  highestScore: z.number().nullable().optional(),
  rubric_id: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
  icon: z.string().nullable().optional(),
  hasPassed: z.boolean().nullable().optional(),
  passRate: z.number().nullable().optional(),
  cohortName: z.string().nullable().optional(),
  cohortNames: z.string().nullable().optional(),
  orderIndex: z.number().nullable().optional(),
  status: z.enum(["not-started", "in-progress", "passed"]),
  completionPct: z.number(),
  passedCount: z.number().nullable().optional(),
  inProgressCount: z.number().nullable().optional(),
  notStartedCount: z.number().nullable().optional(),
  passPct: z.number().nullable().optional(),
});

export const HomeOverviewResponseSchema = z.object({
  mode: z.enum(["ta", "instructional", "empty"]),
  hasData: z.boolean(),
  items: z.array(HomeSimulationItemSchema),
});

export type HomeOverviewResponse = z.infer<typeof HomeOverviewResponseSchema>;

// Attempt History
export const AttemptHistoryRowSchema = z.object({
  attemptId: z.string(),
  date: z.string(),
  profileId: z.string(),
  profileName: z.string(),
  simulationName: z.string(),
  numScenarios: z.number().nullable(),
  numScenariosCompleted: z.number(),
  infiniteMode: z.boolean(),
  infiniteModeTimeLimit: z.number().nullable(),
  personaNames: z.array(z.string()),
  personaColors: z.array(z.string()),
  score: z.number().nullable(),
  simulation_id: z.string(),
  department_id: z.string(),
  scenario_ids: z.array(z.string()),
  scenario_titles: z.array(z.string()).optional(),
  isArchived: z.boolean(),
  showView: z.boolean(),
  showContinue: z.boolean(),
  practiceSimulation: z.boolean(),
  passPct: z.number().nullable(),
});

export const AttemptHistoryResponseSchema = z.array(AttemptHistoryRowSchema);

export type AttemptHistoryResponse = z.infer<
  typeof AttemptHistoryResponseSchema
>;

// Practice Overview
export const PracticeSimulationItemSchema = z.object({
  viewMode: z.enum(["practice"]),
  id: z.string(),
  simulationTitle: z.string(),
  simulationDescription: z.string().nullable(),
  simulationName: z.string(),
  timeLimit: z.number().nullable().optional(),
  numSessions: z.number(),
  highestScore: z.number().nullable().optional(),
  rubric_id: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
  icon: z.string().nullable().optional(),
  hasPassed: z.boolean().nullable().optional(),
  passRate: z.number().nullable().optional(),
  status: z
    .enum(["not-started", "in-progress", "passed"])
    .nullable()
    .optional(),
  completionPct: z.number().nullable().optional(),
  passedCount: z.number().nullable().optional(),
  inProgressCount: z.number().nullable().optional(),
  notStartedCount: z.number().nullable().optional(),
  passPct: z.number().nullable().optional(),
  cohortName: z.string().nullable().optional(),
  updatedAt: z.string().nullable().optional(),
  lastActivityTs: z.string().nullable().optional(),
  hasActivity: z.boolean().nullable().optional(),
});

export const PracticeOverviewResponseSchema = z.object({
  mode: z.enum(["practice"]),
  hasData: z.boolean(),
  items: z.array(PracticeSimulationItemSchema),
});

export type PracticeOverviewResponse = z.infer<
  typeof PracticeOverviewResponseSchema
>;

// ============================================================================
// BUNDLE SCHEMAS
// ============================================================================

// Reports Bundle
export const ProfileMetricsSchema = z.object({
  averageScore: z.any(), // Complex nested structure
  completionPercentage: z.any(),
  firstAttemptPassRate: z.any(),
  highestScore: z.any(),
  messagesPerSession: z.any(),
  personaResponseTimes: z.any(),
  sessionEfficiency: z.any(),
  stagnationRate: z.any(),
  timeSpent: z.any(),
  totalAttempts: z.any(),
});

export const ProfileDataSchema = z.object({
  profileId: z.string(),
  metrics: ProfileMetricsSchema,
});

export const ReportsBundleResponseSchema = z.object({
  data: z.array(ProfileDataSchema),
});

export type ReportsBundleResponse = z.infer<
  typeof ReportsBundleResponseSchema
>;

// Leaderboard Bundle
export const LeaderboardMetricSchema = z.object({
  hasData: z.boolean(),
  method: z.string(),
  keyField: z.string().optional(),
  trendData: z.array(z.any()),
  dataPoints: z.array(z.any()),
  hover: z.record(z.string(), z.any()),
});

export const LeaderboardRowSchema = z.object({
  profileId: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  metrics: z.object({
    totalAttempts: LeaderboardMetricSchema,
    highestScoreAvg: LeaderboardMetricSchema,
    messagesPerSession: LeaderboardMetricSchema,
    personaResponseSeconds: LeaderboardMetricSchema,
    timeSpentMinutes: LeaderboardMetricSchema,
    improvementRatePerDay: LeaderboardMetricSchema,
    perfectScoreCount: LeaderboardMetricSchema,
    quickestPassMinutes: LeaderboardMetricSchema,
  }),
});

export const LeaderboardBundleResponseSchema = z.object({
  data: z.array(LeaderboardRowSchema),
});

export type LeaderboardBundleResponse = z.infer<
  typeof LeaderboardBundleResponseSchema
>;

// ============================================================================
// UTILITY SCHEMAS
// ============================================================================

export const RefreshResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  status: z.string(),
});

export type RefreshResponse = z.infer<typeof RefreshResponseSchema>;

