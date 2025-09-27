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
