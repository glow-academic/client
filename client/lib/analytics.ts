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

export const GrowthDataResponseSchema = z.object({
  chartData: z.array(GrowthDataPointSchema),
  availableMetrics: z.array(GrowthMetricSchema),
  growthStatus: z.enum(["success", "warning", "danger", "neutral"]),
  actionableInsight: z.string().nullable(),
});

// Persona Performance Types
export const PersonaTrendDataSchema = z.object({
  date: z.string(),
  score: z.number(),
  timestamp: z.number(),
});

export const PersonaPerformanceDataSchema = z.object({
  name: z.string(),
  score: z.number(),
  sessions: z.number(),
  color: z.string(),
  trendData: z.array(PersonaTrendDataSchema),
});

export const SimulationSchema = z.object({
  id: z.string(),
  name: z.string(),
  timeLimit: z.number().nullable(),
});

export const PersonaPerformanceResponseSchema = z.object({
  chartData: z.array(PersonaPerformanceDataSchema),
  availableSimulations: z.array(SimulationSchema),
  personaColors: z.record(z.string(), z.string()),
  performanceStatus: z.enum(["success", "warning", "danger", "neutral"]),
});

// Extended Analytics Filters for Primary Functions
export const RubricHeatmapFiltersSchema = AnalyticsFiltersSchema.extend({
  rubricId: z.string().uuid(),
});

export const PersonaPerformanceFiltersSchema = AnalyticsFiltersSchema.extend({
  simulationIds: z.array(z.string().uuid()).optional(),
});

export type RubricHeatmapCell = z.infer<typeof RubricHeatmapCellSchema>;
export type StandardGroup = z.infer<typeof StandardGroupSchema>;
export type Rubric = z.infer<typeof RubricSchema>;
export type RubricHeatmapResponse = z.infer<typeof RubricHeatmapResponseSchema>;

export type GrowthDataPoint = z.infer<typeof GrowthDataPointSchema>;
export type GrowthMetric = z.infer<typeof GrowthMetricSchema>;
export type GrowthDataResponse = z.infer<typeof GrowthDataResponseSchema>;

export type PersonaTrendData = z.infer<typeof PersonaTrendDataSchema>;
export type PersonaPerformanceData = z.infer<
  typeof PersonaPerformanceDataSchema
>;
export type Simulation = z.infer<typeof SimulationSchema>;
export type PersonaPerformanceResponse = z.infer<
  typeof PersonaPerformanceResponseSchema
>;

export type RubricHeatmapFilters = z.infer<typeof RubricHeatmapFiltersSchema>;
export type PersonaPerformanceFilters = z.infer<
  typeof PersonaPerformanceFiltersSchema
>;

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
