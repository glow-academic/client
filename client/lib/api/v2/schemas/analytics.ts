/**
 * Analytics V2 API Schemas
 * Explicit schema definitions for server analytics endpoints
 * Note: These mirror the schemas from @/lib/analytics.ts but are defined
 * here explicitly to keep v2 API types independent and extensible
 */

import { z } from "zod";
import {
  ParameterItemMappingSchema,
  ParameterMappingSchema,
  PersonaMappingSchema,
  RubricMappingSchema,
  ScenarioMappingSchema,
  SimulationMappingSchema,
  StandardGroupsMappingSchema,
  StandardsMappingSchema,
} from "./base";

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
  profileId: z.string().nullable().optional(),
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
  date: z.string().nullish(),
  value: z.number().nullish(),
  attemptId: z.string().nullish(),
  simulationId: z.string().nullish(),
  scenarioId: z.string().nullish(),
  count: z.number().nullish(),
});

export const MetricResponseSchema = z.object({
  hasData: z.boolean(),
  method: MethodSchema,
  currentValue: z.number(),
  trendAnalysis: z.string().nullable().optional(),
  valueField: z.string().nullish(),
  keyField: z.string().nullish(),
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

export type RubricHeatmapCell = z.infer<typeof RubricHeatmapCellSchema>;
export type StandardGroup = z.infer<typeof StandardGroupSchema>;
export type RubricMatrixPackage = z.infer<typeof RubricMatrixPackageSchema>;
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

export type GrowthDataPoint = z.infer<typeof GrowthDataPointSchema>;
export type GrowthMetric = z.infer<typeof GrowthMetricSchema>;
export type GrowthWindowAverage = z.infer<typeof GrowthWindowAverageSchema>;
export type GrowthWindowAverages = z.infer<typeof GrowthWindowAveragesSchema>;
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

export type PersonaTrendData = z.infer<typeof PersonaTrendDataSchema>;
export type PersonaPerformanceData = z.infer<
  typeof PersonaPerformanceDataSchema
>;
export type PersonaPerformanceResponse = z.infer<
  typeof PersonaPerformanceResponseSchema
>;

// ============================================================================
// SECONDARY ANALYTICS SCHEMAS
// ============================================================================

// Attempt Improvement
export const AttemptImprovementDataSchema = z.object({
  attempt: z.string(),
  average_score: z.number(),
  average_time: z.number(),
  pass_rate: z.number(),
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

export type AttemptImprovementData = z.infer<
  typeof AttemptImprovementDataSchema
>;
export type AttemptImprovementFact = z.infer<
  typeof AttemptImprovementFactSchema
>;
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

export type CohortData = z.infer<typeof CohortDataSchema>;
export type DailyData = z.infer<typeof DailyDataSchema>;
export type CohortFact = z.infer<typeof CohortFactSchema>;
export type CohortDailyFact = z.infer<typeof CohortDailyFactSchema>;
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

export type SkillRadarData = z.infer<typeof SkillRadarDataSchema>;
export type SkillStandardFact = z.infer<typeof SkillStandardFactSchema>;
export type SkillPackage = z.infer<typeof SkillPackageSchema>;
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

export type ScenarioAttributeAttemptFact = z.infer<
  typeof ScenarioAttributeAttemptFactSchema
>;
export type ScenarioAttributeScenarioFact = z.infer<
  typeof ScenarioAttributeScenarioFactSchema
>;
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

export type NumericAttemptFact = z.infer<typeof NumericAttemptFactSchema>;
export type NumericScenarioFact = z.infer<typeof NumericScenarioFactSchema>;
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
    SimulationParameterFactCategoricalSchema
  ),
  simulationParameterFactsNumeric: z.array(
    SimulationParameterFactNumericSchema
  ),
  hasData: z.boolean(),
});

export type SimulationFact = z.infer<typeof SimulationFactSchema>;
export type SimulationParameterFactCategorical = z.infer<
  typeof SimulationParameterFactCategoricalSchema
>;
export type SimulationParameterFactNumeric = z.infer<
  typeof SimulationParameterFactNumericSchema
>;
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

export type ScenarioFact = z.infer<typeof ScenarioFactSchema>;
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
  standard_groups: z.record(z.string(), z.array(z.string())),
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
  scenario_titles: z.array(z.string()),
  isArchived: z.boolean(),
  showView: z.boolean(),
  showContinue: z.boolean(),
  practiceSimulation: z.boolean(),
  passPct: z.number().nullable(),
});

export const AttemptHistoryResponseSchema = z.array(AttemptHistoryRowSchema);

export type AttemptHistoryRow = z.infer<typeof AttemptHistoryRowSchema>;
export type AttemptHistoryResponse = z.infer<
  typeof AttemptHistoryResponseSchema
>;

// Home Overview
export const HomeOverviewResponseSchema = z.object({
  mode: z.enum(["ta", "instructional", "empty"]),
  hasData: z.boolean(),
  items: z.array(HomeSimulationItemSchema),
  history: AttemptHistoryResponseSchema,
  standard_groups_mapping: StandardGroupsMappingSchema,
  standards_mapping: StandardsMappingSchema,
  simulation_mapping: SimulationMappingSchema,
});

export type HomeSimulationItem = z.infer<typeof HomeSimulationItemSchema>;
export type HomeOverviewResponse = z.infer<typeof HomeOverviewResponseSchema>;

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
  standard_groups: z.record(z.string(), z.array(z.string())),
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
  history: AttemptHistoryResponseSchema,
  standard_groups_mapping: StandardGroupsMappingSchema,
  standards_mapping: StandardsMappingSchema,
  simulation_mapping: SimulationMappingSchema,
  persona_mapping: PersonaMappingSchema,
  scenario_mapping: ScenarioMappingSchema,
  parameter_mapping: ParameterMappingSchema,
  parameter_item_mapping: ParameterItemMappingSchema,
});

export type PracticeSimulationItem = z.infer<
  typeof PracticeSimulationItemSchema
>;
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

export const ProfileDataEnhancedSchema = z.object({
  profileId: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  alias: z.string(),
  role: z.string(),
  metrics: ProfileMetricsSchema,
});

export const ReportsBundleResponseSchema = z.object({
  data: z.array(ProfileDataEnhancedSchema),
  scenario_mapping: ScenarioMappingSchema,
  simulation_mapping: SimulationMappingSchema,
});

export type ProfileDataEnhanced = z.infer<typeof ProfileDataEnhancedSchema>;
export type ProfileMetrics = z.infer<typeof ProfileMetricsSchema>;
export type ProfileData = z.infer<typeof ProfileDataSchema>;
export type ReportsBundleResponse = z.infer<typeof ReportsBundleResponseSchema>;

// Leaderboard Bundle
export const LeaderboardMetricSchema = z.object({
  hasData: z.boolean(),
  method: z.string(),
  currentValue: z.number(),
  keyField: z.string().nullish(),
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

export type LeaderboardMetric = z.infer<typeof LeaderboardMetricSchema>;
export type LeaderboardRow = z.infer<typeof LeaderboardRowSchema>;
export type LeaderboardBundleResponse = z.infer<
  typeof LeaderboardBundleResponseSchema
>;

// Leaderboard-specific metric response type aliases
// These reuse generic LeaderboardMetricSchema but are aliased for clarity
export type HighestScoreAvgMetricResponse = LeaderboardMetric;
export type PerfectScoreCountMetricResponse = LeaderboardMetric;
export type ImprovementRatePerDayMetricResponse = LeaderboardMetric;
export type QuickestPassMinutesMetricResponse = LeaderboardMetric;
export type TotalAttemptsMetricResponse = LeaderboardMetric;
export type PersonaResponseSecondsMetricResponse = LeaderboardMetric;
export type TimeSpentMinutesMetricResponse = LeaderboardMetric;

// ============================================================================
// UTILITY SCHEMAS
// ============================================================================

export const RefreshResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  status: z.string(),
});

export type RefreshResponse = z.infer<typeof RefreshResponseSchema>;

// ============================================================================
// PRICING ANALYTICS SCHEMAS
// ============================================================================

export const DebugInfoItemSchema = z.object({
  id: z.string(),
  created_at: z.string(),
  content: z.string(),
});

export type DebugInfoItem = z.infer<typeof DebugInfoItemSchema>;

export const ModelRunItemSchema = z.object({
  model_run_id: z.string(),
  created_at: z.string(),
  input_tokens: z.number(),
  output_tokens: z.number(),
  model_id: z.string().nullable(),
  profile_id: z.string().nullable(),
  agent_id: z.string().nullable(),
  persona_id: z.string().nullable(),
  debug_info: z.array(DebugInfoItemSchema),
});

export type ModelRunItem = z.infer<typeof ModelRunItemSchema>;

export const ModelMappingWithPricingSchema = z.object({
  name: z.string(),
  description: z.string(),
  input_ppm: z.number(),
  output_ppm: z.number(),
});

export type ModelMappingWithPricing = z.infer<
  typeof ModelMappingWithPricingSchema
>;

export const PricingAnalyticsResponseSchema = z.object({
  model_runs: z.array(ModelRunItemSchema),
  model_mapping: z.record(z.string(), ModelMappingWithPricingSchema),
  profile_mapping: z.record(z.string(), z.string()),
  agent_mapping: z.record(z.string(), z.string()),
  persona_mapping: z.record(z.string(), z.string()),
});

export type PricingAnalyticsResponse = z.infer<
  typeof PricingAnalyticsResponseSchema
>;

// ============================================================================
// DASHBOARD BUNDLE SCHEMAS
// ============================================================================

export const DashboardHeaderMetricsSchema = z.object({
  average_score: MetricResponseSchema,
  completion_percentage: MetricResponseSchema,
  first_attempt_pass_rate: MetricResponseSchema,
  highest_score: MetricResponseSchema,
  messages_per_session: MetricResponseSchema,
  persona_response_times: MetricResponseSchema,
  session_efficiency: MetricResponseSchema,
  stagnation_rate: MetricResponseSchema,
  time_spent: MetricResponseSchema,
  total_attempts: MetricResponseSchema,
});

export const DashboardPrimaryMetricsSchema = z.object({
  growth_data: GrowthDataResponseSchema,
  persona_performance: PersonaPerformanceResponseSchema,
  rubric_heatmap: RubricHeatmapResponseSchema,
});

export const DashboardSecondaryMetricsSchema = z.object({
  attempt_improvement: AttemptImprovementResponseSchema,
  cohort_performance: CohortPerformanceResponseSchema,
  skill_performance: SkillPerformanceResponseSchema,
});

export const DashboardFooterMetricsSchema = z.object({
  scenario_performance: ScenarioPerformanceResponseSchema,
  scenario_stats: ScenarioStatsResponseSchema,
  simulation_performance: SimulationPerformanceResponseSchema,
  simulation_composition: SimulationCompositionResponseSchema,
});

export const DashboardInsightsSchema = z.object({
  growth: z.string().nullable(),
  persona: z.record(z.string(), z.string().nullable()),
  rubric_heatmap: z.string().nullable(),
  attempt_improvement: z.string().nullable(),
  cohort: z.record(z.string(), z.string().nullable()),
  skill_performance: z.string().nullable(),
  scenario_performance: z.string().nullable(),
  scenario_stats: z.string().nullable(),
  simulation_performance: z.string().nullable(),
  simulation_composition: z.string().nullable(),
});

export const ThresholdsSchema = z.object({
  danger: z.number(),
  warning: z.number(),
  success: z.number(),
});

export const DashboardBundleResponseSchema = z.object({
  header: DashboardHeaderMetricsSchema,
  primary: DashboardPrimaryMetricsSchema,
  secondary: DashboardSecondaryMetricsSchema,
  footer: DashboardFooterMetricsSchema,
  history: AttemptHistoryResponseSchema,
  insights: DashboardInsightsSchema,
  thresholds: ThresholdsSchema,
  simulation_mapping: SimulationMappingSchema,
  rubric_mapping: RubricMappingSchema,
  parameter_mapping: ParameterMappingSchema,
  parameter_item_mapping: ParameterItemMappingSchema,
});

export type DashboardHeaderMetrics = z.infer<
  typeof DashboardHeaderMetricsSchema
>;
export type DashboardPrimaryMetrics = z.infer<
  typeof DashboardPrimaryMetricsSchema
>;
export type DashboardSecondaryMetrics = z.infer<
  typeof DashboardSecondaryMetricsSchema
>;
export type DashboardFooterMetrics = z.infer<
  typeof DashboardFooterMetricsSchema
>;
export type DashboardInsights = z.infer<typeof DashboardInsightsSchema>;
export type Thresholds = z.infer<typeof ThresholdsSchema>;
export type DashboardBundleResponse = z.infer<
  typeof DashboardBundleResponseSchema
>;
