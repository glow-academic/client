import { z } from "zod";

// Analytics Filter Schema
export const AnalyticsFiltersSchema = z.object({
  startDate: z.string(),
  endDate: z.string(),
  cohortIds: z.array(z.string()).optional(),
  roles: z.array(z.string()).optional(),
  simulationFilters: z
    .array(z.enum(["general", "practice", "archived"]))
    .optional(),
  profileId: z.string().optional(),
});

// Method types for analytics computation
export const MethodSchema = z.enum([
  "avg",
  "max",
  "sum",
  "rate",
  "countDistinct",
  "min",
  "slope",
]);

// Trend data schema
export const TrendDataSchema = z.object({
  date: z.string(),
  value: z.number(),
  count: z.number(),
});

// Data point schema
export const DataPointSchema = z.object({
  profileId: z.string(),
  date: z.string().optional(),
  value: z.number().optional(),
  attemptId: z.string().optional(),
  simulationId: z.string().optional(),
  scenarioId: z.string().optional(),
  count: z.number().optional(),
});

// Main metric response schema
export const MetricResponseSchema = z.object({
  hasData: z.boolean(),
  method: MethodSchema,
  valueField: z.string().optional(),
  keyField: z.string().optional(),
  trendData: z.array(TrendDataSchema),
  dataPoints: z.array(DataPointSchema),
});

export type AnalyticsFilters = z.infer<typeof AnalyticsFiltersSchema>;
export type Method = z.infer<typeof MethodSchema>;

export type DataPoint = z.infer<typeof DataPointSchema>;

export type TrendData = z.infer<typeof TrendDataSchema>;

export type MetricResponse = z.infer<typeof MetricResponseSchema>;

// Primary Analytics Types

// Rubric Heatmap Types
export const RubricHeatmapCellSchema = z.object({
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

export const RubricSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  points: z.number(),
  active: z.boolean(),
});

// Per-rubric matrix package
export const RubricMatrixPackageSchema = z.object({
  rubricId: z.string(),
  standardGroups: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      shortName: z.string().nullable(),
      rubricId: z.string(),
    })
  ),
  matrix: z.array(
    z.array(
      z.object({
        rubricId: z.string(),
        correlation: z.number(),
        pValue: z.number().nullable(),
        color: z.string(),
        strength: z.string(),
        dataPoints: z.number(),
      })
    )
  ),
  insights: z.string().nullable(),
  hasData: z.boolean(),
});

// Multi-rubric response
export const RubricHeatmapResponseSchema = z.object({
  matrices: z.array(RubricMatrixPackageSchema),
  validRubricIds: z.array(z.string()),
});

// Growth Data Types
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
  formatterId: z.enum(["percent", "int", "sec", "min"]),
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

// Persona Performance Types
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

export const SimulationSchema = z.object({
  id: z.string(),
  name: z.string(),
  timeLimit: z.number().nullable(),
  practice: z.boolean().optional(),
});

export const PersonaPerformanceResponseSchema = z.object({
  chartData: z.array(PersonaPerformanceDataSchema),
  validSimulationIds: z.array(z.string()),
  personaColors: z.record(z.string(), z.string()),
});

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

// Narrow what can be used as "valueField" and "keyField" so indexing is safe
type ValueField = "value" | "count";
export type KeyField = "attemptId" | "simulationId" | "profileId" | "date";

// Utility function to compute current value from data points
export function computeCurrent(
  method: Method,
  rows: DataPoint[],
  valueField: ValueField = "value",
  keyField?: KeyField
): number {
  if (!rows.length) return 0;

  switch (method) {
    case "avg":
    case "rate": {
      const sum = rows.reduce((s, r) => s + Number(r[valueField] ?? 0), 0);
      const mean = sum / rows.length;
      return method === "rate" ? Math.round(mean * 100) : Math.round(mean);
    }
    case "max":
      return Math.round(
        Math.max(...rows.map((r) => Number(r[valueField] ?? 0)))
      );
    case "sum":
      return Math.round(
        rows.reduce((s, r) => s + Number(r[valueField] ?? 0), 0)
      );
    case "countDistinct": {
      if (!keyField) return 0;
      const keys = new Set(rows.map((r) => String(r[keyField] ?? "")));
      return keys.size;
    }
    case "min": {
      const values = rows.map((r) => Number(r[valueField] ?? Infinity));
      return values.length > 0 ? Math.round(Math.min(...values)) : 0;
    }
    case "slope": {
      // Simple slope: (last - first) / days
      const sorted = rows
        .filter(
          (r): r is DataPoint & { date: string } => typeof r.date === "string"
        )
        .sort((a, b) => a.date.localeCompare(b.date));
      if (sorted.length < 2) return 0;

      const first = Number(sorted[0]?.[valueField] ?? 0);
      const last = Number(sorted[sorted.length - 1]?.[valueField] ?? 0);
      const firstDate = sorted[0]?.date;
      const lastDate = sorted[sorted.length - 1]?.date;
      if (!firstDate || !lastDate) return 0;

      const days = Math.max(
        1,
        (new Date(lastDate).getTime() - new Date(firstDate).getTime()) /
          (1000 * 60 * 60 * 24)
      );
      return Math.round(((last - first) / days) * 100) / 100;
    }
    default:
      return 0;
  }
}

// Utility function to compute trend analysis
export function computeTrendAnalysis(
  trendData: TrendData[],
  metricName: string
): string | null {
  if (!trendData || trendData.length < 2) return null;

  const recentData = trendData.slice(-3);
  const earlierData = trendData.slice(0, 3);

  if (!recentData.length || !earlierData.length) return null;

  const recentAvg =
    recentData.reduce((sum: number, d: TrendData) => sum + (d.value ?? 0), 0) /
    recentData.length;
  const earlierAvg =
    earlierData.reduce((sum: number, d: TrendData) => sum + (d.value ?? 0), 0) /
    earlierData.length;

  const change = recentAvg - earlierAvg;
  const changePercent =
    earlierAvg > 0 ? Math.round((change / earlierAvg) * 100) : 0;

  if (Math.abs(changePercent) < 1) return null;

  const period =
    trendData.length <= 7
      ? "3 days"
      : trendData.length <= 14
        ? "1 week"
        : "1 month";
  const direction = changePercent > 0 ? "increased" : "decreased";

  return `${metricName} ${direction} ${Math.abs(changePercent)}% over the past ${period}`;
}

// Secondary Analytics Types

// Attempt Improvement Types
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

// Cohort Performance Types
export const CohortDataSchema = z.object({
  id: z.string(),
  name: z.string(),
  passRate: z.number(),
  avgPercentageScore: z.number(),
  totalStudents: z.number(),
  passedStudents: z.number(),
  totalAttempts: z.number(),
  passedAttempts: z.number(),
  rubricPoints: z.number(),
  rubricPassPoints: z.number(),
});

export const DailyDataSchema = z.object({
  date: z.string(),
  avgScore: z.number(),
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

// Skill Performance Types
export const SkillRadarDataSchema = z.object({
  metric: z.string(),
  description: z.string().optional(),
  value: z.number(),
  fullMark: z.number(),
});

export const SkillStandardFactSchema = z.object({
  standardId: z.string(),
  standardName: z.string(),
  standardDescription: z.string().optional(),
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

// Extended Analytics Filters for Secondary Functions
export const AttemptImprovementFiltersSchema = AnalyticsFiltersSchema.extend({
  simulationIds: z.array(z.string()).optional(),
});

export const SkillPerformanceFiltersSchema = AnalyticsFiltersSchema.extend({
  rubricId: z.string().optional(),
});

// Type exports
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

export type AttemptImprovementFilters = z.infer<
  typeof AttemptImprovementFiltersSchema
>;
export type SkillPerformanceFilters = z.infer<
  typeof SkillPerformanceFiltersSchema
>;

// Footer Analytics Types

// Scenario Performance (Categorical Parameters) Types
export const ScenarioAttributeAttemptFactSchema = z.object({
  parameterId: z.string(),
  parameterItemId: z.string(),
  date: z.string(), // "MM/DD"
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

// Scenario Stats (Numerical Parameters) Types
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

// Simulation Composition Types (Raw Data)
export const SimulationFactSchema = z.object({
  simulationId: z.string(),
  title: z.string(),
  avgScore: z.number(), // int %
  completionRate: z.number(), // int %
  totalAttempts: z.number(),
  scenarioCount: z.number(), // scenarios *seen* in window for this sim
});

export const SimulationParameterFactCategoricalSchema = z.object({
  simulationId: z.string(),
  parameterId: z.string(),
  parameterItemId: z.string(),
  scenarioCount: z.number(), // how many scenarios in this sim have this item
});

export const SimulationParameterFactNumericSchema = z.object({
  simulationId: z.string(),
  parameterId: z.string(),
  avgLevel: z.number(), // numeric mean over scenarios in this sim
  levelLabel: z.string(), // "3" or "3.5" (rounded to 1)
  scenarioCount: z.number(), // scenarios contributing to avg
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

// Simulation Performance Types
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

// Type exports for footer analytics
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

// Home Analytics Types

// Home Simulation Item Schema (matches SQL function output)
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

// Home Overview Response Schema (matches SQL function output)
export const HomeOverviewResponseSchema = z.object({
  mode: z.enum(["ta", "instructional", "empty"]),
  hasData: z.boolean(),
  items: z.array(HomeSimulationItemSchema),
});

// Type exports for home analytics
export type HomeSimulationItem = z.infer<typeof HomeSimulationItemSchema>;
export type HomeOverviewResponse = z.infer<typeof HomeOverviewResponseSchema>;

// Practice Analytics Types

// Practice Simulation Item Schema (matches SQL function output)
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
  // Fields that are null for practice (cohort-specific)
  passedCount: z.number().nullable().optional(),
  inProgressCount: z.number().nullable().optional(),
  notStartedCount: z.number().nullable().optional(),
  passPct: z.number().nullable().optional(),
  cohortName: z.string().nullable().optional(),
  updatedAt: z.string().nullable().optional(),
  lastActivityTs: z.string().nullable().optional(),
  hasActivity: z.boolean().nullable().optional(),
});

// Practice Overview Response Schema (matches SQL function output)
export const PracticeOverviewResponseSchema = z.object({
  mode: z.enum(["practice"]),
  hasData: z.boolean(),
  items: z.array(PracticeSimulationItemSchema),
});

// Type exports for practice analytics
export type PracticeSimulationItem = z.infer<
  typeof PracticeSimulationItemSchema
>;
export type PracticeOverviewResponse = z.infer<
  typeof PracticeOverviewResponseSchema
>;

// New UI-Ready Attempt History Types
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
  scenario_ids: z.array(z.string()),
  scenario_titles: z.array(z.string()).optional(), // <-- ADD THIS FIELD
  isArchived: z.boolean(),
  showView: z.boolean(),
  showContinue: z.boolean(),
  practiceSimulation: z.boolean(),
  passPct: z.number().nullable(),
});

// Attempt History Response Schema - now expects array directly
export const AttemptHistoryResponseSchema = z.array(AttemptHistoryRowSchema);

// Type exports for history analytics
export type AttemptHistoryRow = z.infer<typeof AttemptHistoryRowSchema>;
export type AttemptHistoryResponse = z.infer<
  typeof AttemptHistoryResponseSchema
>;

// Reports Bundle Analytics Types

// Hover data schemas for each metric
export const AverageScoreHoverSchema = z.object({
  mean: z.number(),
  median: z.number(),
  mode: z.number(),
});

export const CompletionPercentageHoverSchema = z.object({
  completed: z.number(),
  total: z.number(),
  percent: z.number(),
});

export const FirstAttemptPassRateHoverSchema = z.object({
  passed: z.number(),
  total: z.number(),
  percent: z.number(),
});

export const HighestScoreHoverSchema = z.object({
  top: z.array(z.number()),
});

export const MessagesPerSessionHoverSchema = z.object({
  mean: z.number(),
  median: z.number(),
  count: z.number(),
});

export const PersonaResponseTimesHoverSchema = z.object({
  meanSeconds: z.number(),
  medianSeconds: z.number(),
  samples: z.number(),
});

export const SessionEfficiencyHoverSchema = z.object({
  avgScorePercent: z.number(),
  avgMinutes: z.number(),
  efficiency: z.number(),
});

export const StagnationRateHoverSchema = z.object({
  tracked: z.number(),
  stagnant: z.number(),
  ratePercent: z.number(),
});

export const TimeSpentHoverSchema = z.object({
  avgSessionMinutes: z.number(),
  avgChatMinutes: z.number(),
  avgOverallMinutes: z.number(),
});

export const TotalAttemptsHoverSchema = z.object({
  attempts: z.number(),
  uniqueSimulations: z.number(),
  perSimulationMean: z.number(),
});

// Individual metric response schemas with specific hover types
export const AverageScoreMetricResponseSchema = z.object({
  hasData: z.boolean(),
  method: MethodSchema,
  trendData: z.array(TrendDataSchema),
  dataPoints: z.array(DataPointSchema),
  hover: AverageScoreHoverSchema,
});

export const CompletionPercentageMetricResponseSchema = z.object({
  hasData: z.boolean(),
  method: MethodSchema,
  trendData: z.array(TrendDataSchema),
  dataPoints: z.array(DataPointSchema),
  hover: CompletionPercentageHoverSchema,
});

export const FirstAttemptPassRateMetricResponseSchema = z.object({
  hasData: z.boolean(),
  method: MethodSchema,
  trendData: z.array(TrendDataSchema),
  dataPoints: z.array(DataPointSchema),
  hover: FirstAttemptPassRateHoverSchema,
});

export const HighestScoreMetricResponseSchema = z.object({
  hasData: z.boolean(),
  method: MethodSchema,
  trendData: z.array(TrendDataSchema),
  dataPoints: z.array(DataPointSchema),
  hover: HighestScoreHoverSchema,
});

export const MessagesPerSessionMetricResponseSchema = z.object({
  hasData: z.boolean(),
  method: MethodSchema,
  trendData: z.array(TrendDataSchema),
  dataPoints: z.array(DataPointSchema),
  hover: MessagesPerSessionHoverSchema,
});

export const PersonaResponseTimesMetricResponseSchema = z.object({
  hasData: z.boolean(),
  method: MethodSchema,
  trendData: z.array(TrendDataSchema),
  dataPoints: z.array(DataPointSchema),
  hover: PersonaResponseTimesHoverSchema,
});

export const SessionEfficiencyMetricResponseSchema = z.object({
  hasData: z.boolean(),
  method: MethodSchema,
  trendData: z.array(TrendDataSchema),
  dataPoints: z.array(DataPointSchema),
  hover: SessionEfficiencyHoverSchema,
});

export const StagnationRateMetricResponseSchema = z.object({
  hasData: z.boolean(),
  method: MethodSchema,
  trendData: z.array(TrendDataSchema),
  dataPoints: z.array(DataPointSchema),
  hover: StagnationRateHoverSchema,
});

export const TimeSpentMetricResponseSchema = z.object({
  hasData: z.boolean(),
  method: MethodSchema,
  trendData: z.array(TrendDataSchema),
  dataPoints: z.array(DataPointSchema),
  hover: TimeSpentHoverSchema,
});

export const TotalAttemptsMetricResponseSchema = z.object({
  hasData: z.boolean(),
  method: MethodSchema,
  keyField: z.string().optional(),
  trendData: z.array(TrendDataSchema),
  dataPoints: z.array(DataPointSchema),
  hover: TotalAttemptsHoverSchema,
});

// Profile metrics bundle schema with explicit types
export const ProfileMetricsSchema = z.object({
  averageScore: AverageScoreMetricResponseSchema,
  completionPercentage: CompletionPercentageMetricResponseSchema,
  firstAttemptPassRate: FirstAttemptPassRateMetricResponseSchema,
  highestScore: HighestScoreMetricResponseSchema,
  messagesPerSession: MessagesPerSessionMetricResponseSchema,
  personaResponseTimes: PersonaResponseTimesMetricResponseSchema,
  sessionEfficiency: SessionEfficiencyMetricResponseSchema,
  stagnationRate: StagnationRateMetricResponseSchema,
  timeSpent: TimeSpentMetricResponseSchema,
  totalAttempts: TotalAttemptsMetricResponseSchema,
});

// Profile data schema
export const ProfileDataSchema = z.object({
  profileId: z.string(),
  metrics: ProfileMetricsSchema,
});

// Reports bundle response schema
export const ReportsBundleResponseSchema = z.object({
  data: z.array(ProfileDataSchema),
});

// Type exports for reports analytics
export type AverageScoreHover = z.infer<typeof AverageScoreHoverSchema>;
export type CompletionPercentageHover = z.infer<
  typeof CompletionPercentageHoverSchema
>;
export type FirstAttemptPassRateHover = z.infer<
  typeof FirstAttemptPassRateHoverSchema
>;
export type HighestScoreHover = z.infer<typeof HighestScoreHoverSchema>;
export type MessagesPerSessionHover = z.infer<
  typeof MessagesPerSessionHoverSchema
>;
export type PersonaResponseTimesHover = z.infer<
  typeof PersonaResponseTimesHoverSchema
>;
export type SessionEfficiencyHover = z.infer<
  typeof SessionEfficiencyHoverSchema
>;
export type StagnationRateHover = z.infer<typeof StagnationRateHoverSchema>;
export type TimeSpentHover = z.infer<typeof TimeSpentHoverSchema>;
export type TotalAttemptsHover = z.infer<typeof TotalAttemptsHoverSchema>;

// Individual metric response types
export type AverageScoreMetricResponse = z.infer<
  typeof AverageScoreMetricResponseSchema
>;
export type CompletionPercentageMetricResponse = z.infer<
  typeof CompletionPercentageMetricResponseSchema
>;
export type FirstAttemptPassRateMetricResponse = z.infer<
  typeof FirstAttemptPassRateMetricResponseSchema
>;
export type HighestScoreMetricResponse = z.infer<
  typeof HighestScoreMetricResponseSchema
>;
export type MessagesPerSessionMetricResponse = z.infer<
  typeof MessagesPerSessionMetricResponseSchema
>;
export type PersonaResponseTimesMetricResponse = z.infer<
  typeof PersonaResponseTimesMetricResponseSchema
>;
export type SessionEfficiencyMetricResponse = z.infer<
  typeof SessionEfficiencyMetricResponseSchema
>;
export type StagnationRateMetricResponse = z.infer<
  typeof StagnationRateMetricResponseSchema
>;
export type TimeSpentMetricResponse = z.infer<
  typeof TimeSpentMetricResponseSchema
>;
export type TotalAttemptsMetricResponse = z.infer<
  typeof TotalAttemptsMetricResponseSchema
>;

// Leaderboard-specific metric response schemas (reusing existing ones where possible)
// Reused from reports: MessagesPerSessionMetricResponse, PersonaResponseTimesMetricResponse, TimeSpentMetricResponse, TotalAttemptsMetricResponse

export const HighestScoreAvgMetricResponseSchema = z.object({
  hasData: z.boolean(),
  method: MethodSchema,
  trendData: z.array(TrendDataSchema),
  dataPoints: z.array(DataPointSchema),
  hover: z.record(z.string(), z.any()),
});

export const PerfectScoreCountMetricResponseSchema = z.object({
  hasData: z.boolean(),
  method: MethodSchema,
  trendData: z.array(TrendDataSchema),
  dataPoints: z.array(DataPointSchema),
  hover: z.record(z.string(), z.any()),
});

export const ImprovementRatePerDayMetricResponseSchema = z.object({
  hasData: z.boolean(),
  method: MethodSchema,
  trendData: z.array(TrendDataSchema),
  dataPoints: z.array(DataPointSchema),
  hover: z.record(z.string(), z.any()),
});

export const QuickestPassMinutesMetricResponseSchema = z.object({
  hasData: z.boolean(),
  method: MethodSchema,
  trendData: z.array(TrendDataSchema),
  dataPoints: z.array(DataPointSchema),
  hover: z.record(z.string(), z.any()),
});

export type HighestScoreAvgMetricResponse = z.infer<
  typeof HighestScoreAvgMetricResponseSchema
>;
export type PerfectScoreCountMetricResponse = z.infer<
  typeof PerfectScoreCountMetricResponseSchema
>;
export type ImprovementRatePerDayMetricResponse = z.infer<
  typeof ImprovementRatePerDayMetricResponseSchema
>;
export type QuickestPassMinutesMetricResponse = z.infer<
  typeof QuickestPassMinutesMetricResponseSchema
>;

// Aliases for leaderboard metrics that reuse reports metrics
export type PersonaResponseSecondsMetricResponse =
  PersonaResponseTimesMetricResponse;
export type TimeSpentMinutesMetricResponse = TimeSpentMetricResponse;

export type ProfileMetrics = z.infer<typeof ProfileMetricsSchema>;
export type ProfileData = z.infer<typeof ProfileDataSchema>;
export type ReportsBundleResponse = z.infer<typeof ReportsBundleResponseSchema>;

// Leaderboard Bundle Response Schema - matches reports structure
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

export type LeaderboardMetric = z.infer<typeof LeaderboardMetricSchema>;
export type LeaderboardRow = z.infer<typeof LeaderboardRowSchema>;
export type LeaderboardBundleResponse = z.infer<
  typeof LeaderboardBundleResponseSchema
>;

// Growth Analytics Utilities
export function computeGrowthActionableInsight(
  windowAverages: GrowthWindowAverages
): string | null {
  if (
    !windowAverages?.averageScore?.last ||
    !windowAverages?.averageScore?.prev
  ) {
    return null;
  }

  const improvement =
    windowAverages.averageScore.last - windowAverages.averageScore.prev;

  if (improvement < -5) {
    return `Average score has declined by ${Math.abs(improvement).toFixed(1)}% in the last ${windowAverages.averageScore.n} days. Consider additional training support.`;
  }

  if (improvement > 5) {
    return `Average score has improved by ${improvement.toFixed(1)}% in the last ${windowAverages.averageScore.n} days. Great progress!`;
  }

  return null;
}

// Persona Performance Analytics Utilities
export function computePersonaPerformanceStatus(
  chartData: PersonaPerformanceData[],
  thresholds: { danger: number; warning: number; success: number }
): "success" | "warning" | "danger" | "neutral" {
  if (chartData.length === 0) return "neutral";

  // Calculate average score across all personas
  const avgScore =
    chartData.reduce((sum, persona) => sum + persona.score, 0) /
    chartData.length;

  if (avgScore >= thresholds.success) return "success";
  if (avgScore >= thresholds.warning) return "warning";
  return "danger";
}

export function computePersonaActionableInsight(
  trendData: PersonaTrendData[]
): string | null {
  if (trendData.length < 2) return null;

  const recentScores = trendData.slice(-3);
  const earlierScores = trendData.slice(0, 3);

  if (recentScores.length === 0 || earlierScores.length === 0) return null;

  const recentAvg =
    recentScores.reduce((sum, item) => sum + (item.score ?? 0), 0) /
    recentScores.length;
  const earlierAvg =
    earlierScores.reduce((sum, item) => sum + (item.score ?? 0), 0) /
    earlierScores.length;
  const improvement = recentAvg - earlierAvg;

  if (improvement > 5) {
    return "Performance has improved significantly. Consider advancing to more challenging scenarios.";
  } else if (improvement < -5) {
    return "Performance has declined. Review training approach for this persona type.";
  }

  return null;
}

export function computePersonaMultipleActionableInsights(
  trendData: PersonaTrendData[],
  _personaName: string,
  currentScore: number
): Record<string, string | null> {
  const insights: Record<string, string | null> = {};

  if (trendData.length < 2) return insights;

  const recentScores = trendData.slice(-3);
  const earlierScores = trendData.slice(0, 3);

  if (recentScores.length === 0 || earlierScores.length === 0) return insights;

  const recentAvg =
    recentScores.reduce((sum, item) => sum + (item.score ?? 0), 0) /
    recentScores.length;
  const earlierAvg =
    earlierScores.reduce((sum, item) => sum + (item.score ?? 0), 0) /
    earlierScores.length;
  const improvement = recentAvg - earlierAvg;

  // Return the most impactful single insight
  if (improvement > 5) {
    insights["insight"] =
      `Performance improved ${Math.round(improvement)}% recently - consider advancing to more challenging scenarios.`;
  } else if (improvement < -5) {
    insights["insight"] =
      `Performance declined ${Math.round(Math.abs(improvement))}% recently - review training approach.`;
  } else if (currentScore >= 90) {
    insights["insight"] =
      `Excellent performance at ${Math.round(currentScore)}% - consider advanced challenges.`;
  } else if (currentScore < 60) {
    insights["insight"] =
      `Below average performance at ${Math.round(currentScore)}% - additional support needed.`;
  } else {
    insights["insight"] =
      `Steady performance at ${Math.round(currentScore)}% - focus on incremental improvements.`;
  }

  return insights;
}

// Attempt Improvement Analytics Utilities
export function computeAttemptImprovementStatus(
  chartData: AttemptImprovementData[],
  thresholds: { danger: number; warning: number; success: number }
): "success" | "warning" | "danger" | "neutral" {
  if (chartData.length < 2) return "neutral";

  const firstAttempt = chartData[0];
  const lastAttempt = chartData[chartData.length - 1];

  if (!firstAttempt || !lastAttempt) return "neutral";

  const firstScore = firstAttempt["Average Score"];
  const lastScore = lastAttempt["Average Score"];

  if (typeof firstScore !== "number" || typeof lastScore !== "number")
    return "neutral";

  const scoreImprovement = lastScore - firstScore;

  if (scoreImprovement >= thresholds.success) return "success";
  if (scoreImprovement >= thresholds.warning) return "warning";
  return "danger";
}

export function computeAttemptImprovementActionableInsight(
  chartData: AttemptImprovementData[]
): string | null {
  if (chartData.length < 2) return null;

  const firstAttempt = chartData[0];
  const lastAttempt = chartData[chartData.length - 1];

  if (!firstAttempt || !lastAttempt) return null;

  const firstScore = firstAttempt["Average Score"];
  const lastScore = lastAttempt["Average Score"];

  if (typeof firstScore !== "number" || typeof lastScore !== "number")
    return null;

  const scoreImprovement = lastScore - firstScore;

  if (scoreImprovement > 5) {
    return `Users improve by ${scoreImprovement}% on average between attempts. Consider advancing to more challenging scenarios.`;
  } else if (scoreImprovement < -5) {
    return `Performance declined by ${Math.abs(scoreImprovement)}% between attempts. Review training approach.`;
  }

  return null;
}

// Cohort Performance Analytics Utilities
export function computeCohortPerformanceStatus(
  cohortData: CohortData[],
  thresholds: { danger: number; warning: number; success: number }
): "success" | "warning" | "danger" | "neutral" {
  if (cohortData.length === 0) return "neutral";

  // Calculate average pass rate across all cohorts
  const avgPassRate =
    cohortData.reduce((sum, cohort) => sum + cohort.passRate, 0) /
    cohortData.length;

  if (avgPassRate >= thresholds.success) return "success";
  if (avgPassRate >= thresholds.warning) return "warning";
  return "danger";
}

export function computeCohortPerformanceActionableInsight(
  cohortData: CohortData[]
): string | null {
  if (cohortData.length === 0) return null;

  // Find the best performing cohort
  const bestCohort = cohortData.reduce((best, current) =>
    current.passRate > best.passRate ? current : best
  );

  if (bestCohort.passRate > 0) {
    return `Top cohort: ${bestCohort.name} • Avg pass rate ${Math.round(bestCohort.passRate)}%.`;
  }

  return null;
}

export function computeCohortMultipleActionableInsights(
  cohortData: CohortData[]
): Record<string, Record<string, string | null>> {
  const insights: Record<string, Record<string, string | null>> = {};

  if (cohortData.length === 0) return insights;

  // Sort cohorts by performance
  const sortedCohorts = [...cohortData].sort((a, b) => b.passRate - a.passRate);
  const avgPassRate =
    cohortData.reduce((sum, cohort) => sum + cohort.passRate, 0) /
    cohortData.length;

  // Generate single focused insight for each cohort
  cohortData.forEach((cohort) => {
    const cohortInsights: Record<string, string | null> = {};
    const rank = sortedCohorts.findIndex((c) => c.id === cohort.id) + 1;
    const totalCohorts = cohortData.length;

    // Return the most impactful single insight
    if (cohort.passRate >= 90) {
      cohortInsights["insight"] =
        `Exceptional performance at ${Math.round(cohort.passRate)}% - share best practices with other cohorts.`;
    } else if (cohort.passRate < 60) {
      cohortInsights["insight"] =
        `Critical attention needed - ${Math.round(cohort.passRate)}% pass rate requires immediate intervention.`;
    } else if (cohort.passRate > avgPassRate + 15) {
      cohortInsights["insight"] =
        `Outperforming average by ${Math.round(cohort.passRate - avgPassRate)}% - consider leadership opportunities.`;
    } else if (cohort.passRate < avgPassRate - 15) {
      cohortInsights["insight"] =
        `Underperforming average by ${Math.round(avgPassRate - cohort.passRate)}% - additional support needed.`;
    } else if (rank === 1) {
      cohortInsights["insight"] =
        `Top performer with ${Math.round(cohort.passRate)}% pass rate - maintain current approach.`;
    } else {
      cohortInsights["insight"] =
        `Ranked ${rank}/${totalCohorts} with ${Math.round(cohort.passRate)}% pass rate - focus on incremental improvements.`;
    }

    insights[cohort.id] = cohortInsights;
  });

  return insights;
}

// Skill Performance Analytics Utilities
export function computeSkillPerformanceStatus(
  radarData: SkillRadarData[],
  thresholds: { danger: number; warning: number; success: number }
): "success" | "warning" | "danger" | "neutral" {
  if (radarData.length === 0) return "neutral";

  // Calculate average skill performance across all skills
  const avgSkillPerformance =
    radarData.reduce((sum, skill) => sum + skill.value, 0) / radarData.length;

  if (avgSkillPerformance >= thresholds.success) return "success";
  if (avgSkillPerformance >= thresholds.warning) return "warning";
  return "danger";
}

export function computeSkillPerformanceActionableInsight(
  radarData: SkillRadarData[]
): string | null {
  if (radarData.length === 0) return null;

  // Find the weakest skill
  const weakestSkill = radarData.reduce((weakest, current) =>
    current.value < weakest.value ? current : weakest
  );

  if (weakestSkill.value < 0.5) {
    return `Focus on improving ${weakestSkill.metric} - currently at ${Math.round(weakestSkill.value * 100)}% proficiency.`;
  }

  return null;
}

/**
 * Compute actionable insights for rubric heatmap data
 */
export function computeRubricHeatmapActionableInsight(
  matrices: RubricMatrixPackage[]
): string | null {
  if (matrices.length === 0) return null;

  // Use the first matrix for insight calculation
  const matrix = matrices[0];
  if (!matrix || !matrix.hasData) return null;

  // Find the strongest positive and negative correlations
  let strongestPositive = { correlation: 0, pair: "" };
  let strongestNegative = { correlation: 0, pair: "" };

  for (let i = 0; i < matrix.matrix.length; i++) {
    for (let j = 0; j < matrix.matrix[i]!.length; j++) {
      if (i !== j) {
        const cell = matrix.matrix[i]![j];
        if (cell && cell.dataPoints > 0) {
          const correlation = cell.correlation;
          const rowGroup = matrix.standardGroups?.[i];
          const colGroup = matrix.standardGroups?.[j];

          if (rowGroup && colGroup) {
            const pair = `${rowGroup.shortName} ↔ ${colGroup.shortName}`;

            if (correlation > strongestPositive.correlation) {
              strongestPositive = { correlation, pair };
            }
            if (correlation < strongestNegative.correlation) {
              strongestNegative = { correlation, pair };
            }
          }
        }
      }
    }
  }

  // Generate insights based on correlation patterns
  if (strongestPositive.correlation > 0.7) {
    return `Strong positive correlation (${strongestPositive.correlation.toFixed(2)}) between ${strongestPositive.pair}. These skills develop together.`;
  } else if (strongestNegative.correlation < -0.7) {
    return `Strong negative correlation (${strongestNegative.correlation.toFixed(2)}) between ${strongestNegative.pair}. These skills may compete for attention.`;
  } else if (strongestPositive.correlation > 0.5) {
    return `Moderate positive correlation (${strongestPositive.correlation.toFixed(2)}) between ${strongestPositive.pair}. Consider integrated learning approaches.`;
  }

  return null;
}

/**
 * Compute actionable insights for scenario performance data
 */
export function computeScenarioPerformanceActionableInsight(
  attributeAttemptFacts: ScenarioAttributeAttemptFact[]
): string | null {
  if (attributeAttemptFacts.length === 0) return null;

  // Find the parameter item with the highest average score
  const byParameterItem = new Map<
    string,
    { totalScore: number; totalAttempts: number }
  >();

  for (const fact of attributeAttemptFacts) {
    const key = fact.parameterItemId;
    const current = byParameterItem.get(key) || {
      totalScore: 0,
      totalAttempts: 0,
    };
    current.totalScore += fact.avgScore * fact.attempts;
    current.totalAttempts += fact.attempts;
    byParameterItem.set(key, current);
  }

  let bestItem = { id: "", score: 0 };
  for (const [id, data] of byParameterItem.entries()) {
    const avgScore =
      data.totalAttempts > 0 ? data.totalScore / data.totalAttempts : 0;
    if (avgScore > bestItem.score) {
      bestItem = { id, score: avgScore };
    }
  }

  if (bestItem.score > 0) {
    return `Top performing attribute achieves ${Math.round(bestItem.score)}% average score. Consider expanding similar scenarios.`;
  }

  return null;
}

/**
 * Compute actionable insights for scenario stats data
 */
export function computeScenarioStatsActionableInsight(
  numericAttemptFacts: NumericAttemptFact[]
): string | null {
  if (numericAttemptFacts.length === 0) return null;

  // Calculate correlation between level value and score
  let totalCorrelation = 0;
  let correlationCount = 0;

  // Group by parameter to calculate correlation for each
  const byParameter = new Map<string, NumericAttemptFact[]>();
  for (const fact of numericAttemptFacts) {
    const existing = byParameter.get(fact.parameterId) || [];
    existing.push(fact);
    byParameter.set(fact.parameterId, existing);
  }

  for (const facts of byParameter.values()) {
    if (facts.length < 2) continue;

    // Simple correlation calculation
    const n = facts.length;
    const sumX = facts.reduce((s, f) => s + f.levelValue, 0);
    const sumY = facts.reduce((s, f) => s + f.score, 0);
    const sumXY = facts.reduce((s, f) => s + f.levelValue * f.score, 0);
    const sumXX = facts.reduce((s, f) => s + f.levelValue * f.levelValue, 0);
    const sumYY = facts.reduce((s, f) => s + f.score * f.score, 0);

    const correlation =
      (n * sumXY - sumX * sumY) /
      Math.sqrt((n * sumXX - sumX * sumX) * (n * sumYY - sumY * sumY));

    if (!isNaN(correlation)) {
      totalCorrelation += Math.abs(correlation);
      correlationCount++;
    }
  }

  if (correlationCount > 0) {
    const avgCorrelation = totalCorrelation / correlationCount;
    if (avgCorrelation > 0.7) {
      return `Strong correlation (${avgCorrelation.toFixed(2)}) between parameter levels and performance. Consider adjusting difficulty curves.`;
    } else if (avgCorrelation > 0.5) {
      return `Moderate correlation (${avgCorrelation.toFixed(2)}) between parameter levels and performance. Review level progression.`;
    }
  }

  return null;
}

/**
 * Compute actionable insights for simulation performance data
 */
export function computeSimulationPerformanceActionableInsight(
  scenarioFacts: ScenarioFact[]
): string | null {
  if (scenarioFacts.length === 0) return null;

  // Find the best and worst performing scenarios
  const sortedByScore = scenarioFacts.sort((a, b) => b.avgScore - a.avgScore);
  const best = sortedByScore[0];
  const worst = sortedByScore[sortedByScore.length - 1];

  if (best && worst && best.avgScore > worst.avgScore) {
    const scoreDiff = best.avgScore - worst.avgScore;
    if (scoreDiff > 20) {
      return `Performance gap of ${Math.round(scoreDiff)}% between best (${best.scenarioName}) and worst (${worst.scenarioName}) scenarios. Consider rebalancing difficulty.`;
    }
  }

  // Check for low success rates
  const lowSuccess = scenarioFacts.filter((s) => s.successRate < 50);
  if (lowSuccess.length > 0) {
    return `${lowSuccess.length} scenario(s) have success rates below 50%. Review these scenarios for potential improvements.`;
  }

  return null;
}

// Simulation Composition Utility Functions
export function computeSimulationCompositionActionableInsight(
  simulationFacts: SimulationFact[]
): string | null {
  if (!simulationFacts || simulationFacts.length === 0) {
    return null;
  }

  // Calculate performance statistics
  const avgScore =
    simulationFacts.reduce((sum, sim) => sum + sim.avgScore, 0) /
    simulationFacts.length;
  const avgCompletion =
    simulationFacts.reduce((sum, sim) => sum + sim.completionRate, 0) /
    simulationFacts.length;

  // Find top and bottom performers
  const sortedByScore = [...simulationFacts].sort(
    (a, b) => b.avgScore - a.avgScore
  );
  const topPerformer = sortedByScore[0];
  const bottomPerformer = sortedByScore[sortedByScore.length - 1];

  // Performance gap analysis
  if (topPerformer && bottomPerformer) {
    const performanceGap = topPerformer.avgScore - bottomPerformer.avgScore;

    if (performanceGap > 30) {
      return `Significant performance gap (${performanceGap.toFixed(0)}%) between top performer "${topPerformer.title}" (${topPerformer.avgScore}%) and bottom performer "${bottomPerformer.title}" (${bottomPerformer.avgScore}%). Consider analyzing composition differences.`;
    }
  }

  if (avgScore < 60) {
    return `Overall performance is below 60% (${avgScore.toFixed(0)}%). Focus on improving simulation composition and scenario design.`;
  }

  if (avgCompletion < 70) {
    return `Completion rate is low (${avgCompletion.toFixed(0)}%). Consider adjusting simulation difficulty or providing better guidance.`;
  }

  if (avgScore >= 80 && avgCompletion >= 80) {
    return `Strong performance across simulations (${avgScore.toFixed(0)}% avg score, ${avgCompletion.toFixed(0)}% completion). Current composition appears effective.`;
  }

  return `Moderate performance (${avgScore.toFixed(0)}% avg score, ${avgCompletion.toFixed(0)}% completion). Consider analyzing top performers for optimization opportunities.`;
}
