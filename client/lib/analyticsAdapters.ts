// Analytics Adapters
// This file provides TypeScript adapters for analytics data that includes formatter functions
// Since SQL can't emit JS functions, we return formatterId strings and map them on the client

import type { GrowthMetric } from "@/lib/analytics";

type ServerMetric = Omit<GrowthMetric, "formatter"> & {
  formatterId: "percent" | "int" | "sec" | "min";
};

export function attachFormatters(
  payload: { availableMetrics: ServerMetric[] } & Record<string, unknown>
): Record<string, unknown> {
  const fmt = {
    percent: (v: number) => `${Math.round(v)}%`,
    int: (v: number) => `${Math.round(v)}`,
    sec: (v: number) => `${Math.round(v)} sec`,
    min: (v: number) => `${Math.round(v)} min`,
  };

  const { availableMetrics, ...rest } = payload;

  return {
    ...rest,
    availableMetrics: availableMetrics.map(({ formatterId, ...rest }) => ({
      ...rest,
      formatter: fmt[formatterId],
    })),
  };
}

// Example usage:
// const res = await drizzleDb.execute(sql`SELECT analytics_growth_data_fn(...params) AS j`);
// const raw = res[0].j as { chartData: GrowthData["chartData"]; availableMetrics: ServerMetric[]; growthStatus: any; actionableInsight?: string; };
// const growthData = attachFormatters(raw);
// const finalData: GrowthData = { ...growthData, availableMetrics };
