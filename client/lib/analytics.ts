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

export const RubricHeatmapResponseSchema = z.object({
  matrix: z.array(z.array(RubricHeatmapCellSchema)),
  standardGroups: z.array(StandardGroupSchema),
  availableRubrics: z.array(RubricSchema),
  insights: z.string().nullable(),
  correlationStatus: z.enum(["success", "warning", "danger", "neutral"]),
  hasData: z.boolean(),
});

// Growth Data Types
export const GrowthDataPointSchema = z.object({
  date: z.string(),
  averageScore: z.number(),
  passRate: z.number(),
  completionRate: z.number(),
  firstAttemptPassRate: z.number(),
  messagesPerSession: z.number(),
  personaResponseTimes: z.number(),
  sessionEfficiency: z.number(),
  stagnationRate: z.number(),
  timeSpent: z.number(),
  totalAttempts: z.number(),
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
  score: z.number(),
  timestamp: z.number(),
  simulationId: z.string().uuid().optional(),
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

// Extended Analytics Filters for Primary Functions
export const RubricHeatmapFiltersSchema = AnalyticsFiltersSchema.extend({
  rubricId: z
    .string()
    .regex(
      /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/
    ),
});

export type RubricHeatmapCell = z.infer<typeof RubricHeatmapCellSchema>;
export type StandardGroup = z.infer<typeof StandardGroupSchema>;
export type Rubric = z.infer<typeof RubricSchema>;
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

export type RubricHeatmapFilters = z.infer<typeof RubricHeatmapFiltersSchema>;

// Narrow what can be used as "valueField" and "keyField" so indexing is safe
type ValueField = "value" | "count";
type KeyField = "attemptId" | "simulationId" | "profileId" | "date";

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
  availableSimulations: z.array(SimulationSchema),
  improvementStatus: z.enum(["success", "warning", "danger", "neutral"]),
  actionableInsight: z.string().nullable(),
  facts: z.array(AttemptImprovementFactSchema),
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
  availableSimulations: z.number(),
  color: z.string(),
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
  availableSimulations: z.array(SimulationSchema),
  insights: z.string().nullable(),
  performanceStatus: z.enum(["success", "warning", "danger", "neutral"]),
  hasData: z.boolean(),
  cohortFacts: z.array(CohortFactSchema),
  dailyFacts: z.array(CohortDailyFactSchema).optional(),
});

// Skill Performance Types
export const SkillRadarDataSchema = z.object({
  metric: z.string(),
  value: z.number(),
  fullMark: z.number(),
  score: z.number(),
  points: z.number(),
});

export const SkillGroupFactSchema = z.object({
  groupId: z.string(),
  groupName: z.string(),
  simulationId: z.string(),
  score: z.number(),
  points: z.number(),
});

export const SkillPerformanceResponseSchema = z.object({
  radarData: z.array(SkillRadarDataSchema),
  availableRubrics: z.array(RubricSchema),
  skillStatus: z.enum(["success", "warning", "danger", "neutral"]),
  hasData: z.boolean(),
  groupFacts: z.array(SkillGroupFactSchema),
});

// Extended Analytics Filters for Secondary Functions
export const AttemptImprovementFiltersSchema = AnalyticsFiltersSchema.extend({
  simulationIds: z.array(z.string().uuid()).optional(),
});

export const SkillPerformanceFiltersSchema = AnalyticsFiltersSchema.extend({
  rubricId: z.string().uuid().optional(),
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
export type SkillGroupFact = z.infer<typeof SkillGroupFactSchema>;
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
  avgScore: z.number(),
  attempts: z.number(),
  passedAttempts: z.number(),
});

export const ScenarioAttributeScenarioFactSchema = z.object({
  parameterId: z.string(),
  parameterItemId: z.string(),
  scenarioId: z.string(),
});

export const ScenarioPerformanceDataSchema = z.object({
  attributeElements: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      displayName: z.string(),
      icon: z.string(),
      color: z.string(),
      count: z.number(),
      percentage: z.number(),
      avgScore: z.number(),
      completionRate: z.number(),
      totalAttempts: z.number(),
      trendData: z.array(
        z.object({
          date: z.string(),
          score: z.number(),
          timestamp: z.number(),
        })
      ),
      insight: z.string(),
    })
  ),
  availableParameters: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      description: z.string(),
      numerical: z.boolean().refine((v) => v === false),
      active: z.boolean(),
    })
  ),
  performanceStatus: z.enum(["success", "warning", "danger", "neutral"]),
  hasData: z.boolean(),
  attributeAttemptFacts: z.array(ScenarioAttributeAttemptFactSchema),
  attributeScenarioFacts: z.array(ScenarioAttributeScenarioFactSchema),
});

// Scenario Stats (Numerical Parameters) Types
export const NumericAttemptFactSchema = z.object({
  parameterId: z.string(),
  level: z.string(), // "1","2","2.5",...
  score: z.number(),
  attempts: z.number(),
});

export const ScenarioStatsDataSchema = z.object({
  numericalParameters: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      numerical: z.literal(true),
      active: z.boolean(),
    })
  ),
  performanceData: z.array(
    z.object({
      metricLevel: z.string(),
      avgScore: z.number(),
      scenarioCount: z.number(),
      totalAttempts: z.number(),
      rubricPoints: z.number(),
    })
  ),
  correlationData: z.object({ correlation: z.number(), pValue: z.number() }),
  numericAttemptFacts: z.array(NumericAttemptFactSchema),
});

// Simulation Composition Types
export const SimulationFactSchema = z.object({
  simulationId: z.string(),
  title: z.string(),
  avgScore: z.number(),
  completionRate: z.number(),
  totalAttempts: z.number(),
  scenarioCount: z.number(),
});

export const SimulationParamFactSchema = z.object({
  simulationId: z.string(),
  parameterName: z.string(),
  parameterValue: z.string(),
  isNumerical: z.boolean(),
  count: z.number(),
});

export const SimulationCompositionDataSchema = z.object({
  config: z.object({
    method: z.enum(["percentile", "quartile", "standard_deviation"]),
    topPercentage: z.number(),
    bottomPercentage: z.number(),
  }),
  highPerforming: z.array(
    z.object({
      name: z.string(),
      value: z.number(),
      icon: z.string(),
      color: z.string(),
      description: z.string(),
      significance: z.enum(["high", "medium", "low", "none"]),
    })
  ),
  lowPerforming: z.array(
    z.object({
      name: z.string(),
      value: z.number(),
      icon: z.string(),
      color: z.string(),
      description: z.string(),
      significance: z.enum(["high", "medium", "low", "none"]),
    })
  ),
  highPerformingCount: z.number(),
  lowPerformingCount: z.number(),
  highPerformingDetails: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      avgScore: z.number(),
      completionRate: z.number(),
      totalAttempts: z.number(),
      scenarioCount: z.number(),
      parameterBreakdown: z.array(
        z.object({
          parameterName: z.string(),
          parameterValue: z.string(),
          isNumerical: z.boolean(),
        })
      ),
    })
  ),
  lowPerformingDetails: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      avgScore: z.number(),
      completionRate: z.number(),
      totalAttempts: z.number(),
      scenarioCount: z.number(),
      parameterBreakdown: z.array(
        z.object({
          parameterName: z.string(),
          parameterValue: z.string(),
          isNumerical: z.boolean(),
        })
      ),
    })
  ),
  simulationFacts: z.array(SimulationFactSchema),
  simulationParameterFacts: z.array(SimulationParamFactSchema),
  performanceStatus: z.enum(["success", "warning", "danger", "neutral"]),
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

export const SimulationPerformanceDataSchema = z.object({
  validSimulations: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      scenarioIds: z.array(z.string()).optional(),
    })
  ),
  selectedSimulation: z
    .object({
      id: z.string(),
      title: z.string(),
      scenarioIds: z.array(z.string()).optional(),
    })
    .nullable(),
  scenarioPerformanceData: z.array(
    z.object({
      scenarioId: z.string(),
      scenarioName: z.string(),
      avgScore: z.number(),
      successRate: z.number(),
      performanceChange: z.number(),
      totalAttempts: z.number(),
      completedAttempts: z.number(),
      color: z.string(),
    })
  ),
  insights: z.string().nullable(),
  scenarioFacts: z.array(ScenarioFactSchema),
});

// Type exports for footer analytics
export type ScenarioAttributeAttemptFact = z.infer<
  typeof ScenarioAttributeAttemptFactSchema
>;
export type ScenarioAttributeScenarioFact = z.infer<
  typeof ScenarioAttributeScenarioFactSchema
>;
export type ScenarioPerformanceData = z.infer<
  typeof ScenarioPerformanceDataSchema
>;

export type NumericAttemptFact = z.infer<typeof NumericAttemptFactSchema>;
export type ScenarioStatsData = z.infer<typeof ScenarioStatsDataSchema>;

export type SimulationFact = z.infer<typeof SimulationFactSchema>;
export type SimulationParamFact = z.infer<typeof SimulationParamFactSchema>;
export type SimulationCompositionData = z.infer<
  typeof SimulationCompositionDataSchema
>;
export type SimulationCompositionConfig = {
  method: "percentile" | "quartile" | "standard_deviation";
  topPercentage: number;
  bottomPercentage: number;
};

export type ScenarioFact = z.infer<typeof ScenarioFactSchema>;
export type SimulationPerformanceData = z.infer<
  typeof SimulationPerformanceDataSchema
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
  status: z.enum(["not-started", "in-progress", "passed"]),
  completionPct: z.number(),
  // Fields that are null for practice (cohort-specific)
  passedCount: z.number().nullable().optional(),
  inProgressCount: z.number().nullable().optional(),
  notStartedCount: z.number().nullable().optional(),
  passPct: z.number().nullable().optional(),
  cohortName: z.string().nullable().optional(),
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
  simulationId: z.string(),
  scenarioIds: z.array(z.string()),

  profileId: z.string(),
  profileName: z.string(),
  simulationTitle: z.string(),
  attemptDate: z.string(),
  lastActivityAt: z.string(),

  personaIds: z.array(z.string()),
  personaNames: z.array(z.string()),
  personaColors: z.array(z.string()),

  completedCount: z.number(),
  expectedCount: z.number().nullable(),

  scorePercent: z.number().nullable(),

  // Rubric / pass info for UI
  rubricId: z.string().nullable(),
  rubricPoints: z.number().nullable(),
  rubricPassPoints: z.number().nullable(),
  passPct: z.number().nullable(),
  practiceSimulation: z.boolean(),

  showContinue: z.boolean(),
  showView: z.boolean(),

  infiniteMode: z.boolean(),
  infiniteModeTimeLimit: z.number().nullable(),
  archived: z.boolean(),
});

// Attempt History Response Schema (Legacy)
export const AttemptHistoryResponseSchema = z.object({
  hasData: z.boolean(),
  rows: z.array(AttemptHistoryRowSchema),
});

// Type exports for history analytics
export type AttemptHistoryRow = z.infer<typeof AttemptHistoryRowSchema>;
export type AttemptHistoryResponse = z.infer<
  typeof AttemptHistoryResponseSchema
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
    recentScores.reduce((sum, item) => sum + item.score, 0) /
    recentScores.length;
  const earlierAvg =
    earlierScores.reduce((sum, item) => sum + item.score, 0) /
    earlierScores.length;
  const improvement = recentAvg - earlierAvg;

  if (improvement > 5) {
    return "Performance has improved significantly. Consider advancing to more challenging scenarios.";
  } else if (improvement < -5) {
    return "Performance has declined. Review training approach for this persona type.";
  }

  return null;
}
