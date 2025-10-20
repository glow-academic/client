/**
 * Dashboard Bundle Schemas
 */

import { z } from "zod";
import {
  MetricResponseSchema,
  ParameterItemMappingSchema,
  ParameterMappingSchema,
  RubricMappingSchema,
  SimulationMappingSchema,
} from "./base";
import { AttemptHistoryResponseSchema } from "./home";

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

// ============================================================================
// DASHBOARD BUNDLE MAIN SCHEMAS
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

// Export types
export type RubricHeatmapCell = z.infer<typeof RubricHeatmapCellSchema>;
export type StandardGroup = z.infer<typeof StandardGroupSchema>;
export type RubricMatrixPackage = z.infer<typeof RubricMatrixPackageSchema>;
export type RubricHeatmapResponse = z.infer<typeof RubricHeatmapResponseSchema>;

export type GrowthDataPoint = z.infer<typeof GrowthDataPointSchema>;
export type GrowthMetric = z.infer<typeof GrowthMetricSchema>;
export type GrowthWindowAverage = z.infer<typeof GrowthWindowAverageSchema>;
export type GrowthWindowAverages = z.infer<typeof GrowthWindowAveragesSchema>;
export type GrowthDataResponse = z.infer<typeof GrowthDataResponseSchema>;

export type PersonaTrendData = z.infer<typeof PersonaTrendDataSchema>;
export type PersonaPerformanceData = z.infer<
  typeof PersonaPerformanceDataSchema
>;
export type PersonaPerformanceResponse = z.infer<
  typeof PersonaPerformanceResponseSchema
>;

export type AttemptImprovementData = z.infer<
  typeof AttemptImprovementDataSchema
>;
export type AttemptImprovementFact = z.infer<
  typeof AttemptImprovementFactSchema
>;
export type AttemptImprovementResponse = z.infer<
  typeof AttemptImprovementResponseSchema
>;

export type CohortData = z.infer<typeof CohortDataSchema>;
export type DailyData = z.infer<typeof DailyDataSchema>;
export type CohortFact = z.infer<typeof CohortFactSchema>;
export type CohortDailyFact = z.infer<typeof CohortDailyFactSchema>;
export type CohortPerformanceResponse = z.infer<
  typeof CohortPerformanceResponseSchema
>;

export type SkillRadarData = z.infer<typeof SkillRadarDataSchema>;
export type SkillStandardFact = z.infer<typeof SkillStandardFactSchema>;
export type SkillPackage = z.infer<typeof SkillPackageSchema>;
export type SkillPerformanceResponse = z.infer<
  typeof SkillPerformanceResponseSchema
>;

export type ScenarioAttributeAttemptFact = z.infer<
  typeof ScenarioAttributeAttemptFactSchema
>;
export type ScenarioAttributeScenarioFact = z.infer<
  typeof ScenarioAttributeScenarioFactSchema
>;
export type ScenarioPerformanceResponse = z.infer<
  typeof ScenarioPerformanceResponseSchema
>;

export type NumericAttemptFact = z.infer<typeof NumericAttemptFactSchema>;
export type NumericScenarioFact = z.infer<typeof NumericScenarioFactSchema>;
export type ScenarioStatsResponse = z.infer<typeof ScenarioStatsResponseSchema>;

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

export type ScenarioFact = z.infer<typeof ScenarioFactSchema>;
export type SimulationPerformanceResponse = z.infer<
  typeof SimulationPerformanceResponseSchema
>;

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
