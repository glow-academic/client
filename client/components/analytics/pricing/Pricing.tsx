"use client";

/**
 * Pricing.tsx
 * Interactive pricing analytics for model runs.
 * - Filters by date range and models
 * - Computes spend from input/output tokens using model ppm
 * - Displays summary cards and a stacked area chart (per model) + total line
 */

import { format } from "date-fns";
import { useMemo, useState } from "react";
import type { DateRange } from "react-day-picker";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

import { Area, AreaChart, CartesianGrid, Line, XAxis, YAxis } from "recharts";

import { useDepartments } from "@/contexts/departments-context";
import { useProfile } from "@/contexts/profile-context";
import { usePricingAnalytics } from "@/lib/api/v2/hooks/analytics";
import type { AnalyticsFilters } from "@/lib/api/v2/schemas/analytics";
import { Loader2 } from "lucide-react";
import { RunsDataTable } from "./RunsDataTable";

const currency = (value: number) =>
  new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);

const COLOR_PALETTE = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
  "#84cc16",
  "#ec4899",
  "#14b8a6",
  "#f97316",
];

export default function Pricing() {
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const now = new Date();
    const start = new Date(now);
    // Default: last 30 days
    start.setDate(start.getDate() - 30);
    start.setHours(0, 0, 0, 0);
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    return { from: start, to: end };
  });

  const { effectiveDepartmentIds } = useDepartments();
  const { effectiveProfile } = useProfile();

  const [selectedModelIds, setSelectedModelIds] = useState<string[]>([]);
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([]);
  const [selectedPersonaIds, setSelectedPersonaIds] = useState<string[]>([]);
  const [selectedProfileIds, setSelectedProfileIds] = useState<string[]>([]);

  // Build filters for V2 API
  const filters = useMemo<AnalyticsFilters>(
    () => ({
      departmentIds: effectiveDepartmentIds,
      profileId: effectiveProfile?.id || "",
      startDate: dateRange?.from?.toISOString() || "",
      endDate: dateRange?.to?.toISOString() || "",
      cohortIds: undefined,
      simulationFilters: undefined,
    }),
    [effectiveDepartmentIds, effectiveProfile?.id, dateRange]
  );

  const { data: pricingData, isLoading } = usePricingAnalytics(filters);

  // Extract data from V2 API response
  const modelRuns = useMemo(() => pricingData?.model_runs || [], [pricingData]);
  const modelMapping = useMemo(
    () => pricingData?.model_mapping || {},
    [pricingData]
  );
  const profileMapping = useMemo(
    () => pricingData?.profile_mapping || {},
    [pricingData]
  );
  const agentMapping = useMemo(
    () => pricingData?.agent_mapping || {},
    [pricingData]
  );
  const personaMapping = useMemo(
    () => pricingData?.persona_mapping || {},
    [pricingData]
  );

  // Compute spend per run and aggregate by day, filtered by agents/personas/profiles; series per model
  const { chartData, totals, chartConfig, filteredRuns } = useMemo(() => {
    if (!modelRuns?.length || Object.keys(modelMapping).length === 0) {
      return {
        chartData: [] as Array<Record<string, number | string>>,
        totals: { totalSpend: 0, runCount: 0, avgCost: 0 },
        chartConfig: {} as Record<string, { label: string; color: string }>,
        filteredRuns: [] as typeof modelRuns,
      };
    }

    // Build include sets (empty selection means All)
    const includeModels = new Set(
      selectedModelIds.length ? selectedModelIds : Object.keys(modelMapping)
    );
    const includeAgents = new Set(selectedAgentIds);
    const includePersonas = new Set(selectedPersonaIds);
    const includeProfiles = new Set(selectedProfileIds);

    const byDay = new Map<
      string,
      { dateLabel: string; values: Record<string, number> }
    >();

    let totalSpend = 0;
    let runCount = 0;

    const matchedRuns: typeof modelRuns = [];
    for (const run of modelRuns) {
      const modelId = run.model_id;
      const runProfileId = run.profile_id;
      const runAgentId = run.agent_id;
      const runPersonaId = run.persona_id;

      if (!modelId || !includeModels.has(modelId)) continue;
      if (
        includeAgents.size > 0 &&
        (!runAgentId || !includeAgents.has(runAgentId))
      )
        continue;
      if (
        includePersonas.size > 0 &&
        (!runPersonaId || !includePersonas.has(runPersonaId))
      )
        continue;
      if (
        includeProfiles.size > 0 &&
        (!runProfileId || !includeProfiles.has(runProfileId))
      )
        continue;

      matchedRuns.push(run);

      // Pricing comes from model mapping
      const modelInfo = modelMapping[modelId];
      if (!modelInfo) continue;

      const spend =
        (run.input_tokens / 1_000_000) * (modelInfo.input_ppm || 0) +
        (run.output_tokens / 1_000_000) * (modelInfo.output_ppm || 0);

      const dateKey = format(new Date(run.created_at), "yyyy-MM-dd");
      const dateLabel = format(new Date(run.created_at), "MMM dd");

      if (!byDay.has(dateKey)) {
        byDay.set(dateKey, { dateLabel, values: {} });
      }

      const bucket = byDay.get(dateKey)!;
      const seriesKey = modelId;
      bucket.values[seriesKey] = (bucket.values[seriesKey] || 0) + spend;

      totalSpend += spend;
      runCount += 1;
    }

    const data = Array.from(byDay.entries())
      .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
      .map(([_, { dateLabel, values }]) => {
        const row: Record<string, number | string> = { date: dateLabel };
        for (const id of includeModels) {
          row[id] = Number((values[id] || 0).toFixed(2));
        }
        row["total"] = Number(
          Object.values(values)
            .reduce((s, v) => s + (v || 0), 0)
            .toFixed(2)
        );
        return row;
      });

    const modelIdToColor: Record<string, string> = {};
    let colorIdx = 0;
    for (const id of includeModels) {
      modelIdToColor[id] =
        COLOR_PALETTE[colorIdx % COLOR_PALETTE.length] ?? "#999999";
      colorIdx += 1;
    }

    const config: Record<string, { label: string; color: string }> = {};
    for (const id of includeModels) {
      const label = modelMapping[id]?.name;
      config[id] = {
        label: label ?? id,
        color: modelIdToColor[id] ?? "#999999",
      };
    }
    config["total"] = { label: "Total", color: "#334155" };

    return {
      chartData: data,
      totals: {
        totalSpend: Number(totalSpend.toFixed(2)),
        runCount,
        avgCost: runCount ? Number((totalSpend / runCount).toFixed(2)) : 0,
      },
      chartConfig: config,
      filteredRuns: matchedRuns,
    };
  }, [
    modelRuns,
    modelMapping,
    selectedModelIds,
    selectedAgentIds,
    selectedPersonaIds,
    selectedProfileIds,
  ]);

  // Build rows for runs table
  const runRows = useMemo(() => {
    return (filteredRuns || []).map((run) => {
      const modelId = run.model_id;
      const agentId = run.agent_id;
      const personaId = run.persona_id;
      const profileId = run.profile_id;

      const modelInfo = modelId ? modelMapping[modelId] : undefined;
      const inputCost =
        (run.input_tokens / 1_000_000) * (modelInfo?.input_ppm || 0);
      const outputCost =
        (run.output_tokens / 1_000_000) * (modelInfo?.output_ppm || 0);
      const cost = Number((inputCost + outputCost).toFixed(6));

      return {
        id: run.model_run_id,
        createdAt: run.created_at,
        modelId,
        modelName: (modelId && modelMapping[modelId]?.name) || modelId || "",
        agentId,
        agentName: (agentId && agentMapping[agentId]) || agentId || "",
        personaId,
        personaName:
          (personaId && personaMapping[personaId]) || personaId || "",
        profileId,
        profileName:
          (profileId && profileMapping[profileId]) || profileId || "",
        inputTokens: run.input_tokens,
        outputTokens: run.output_tokens,
        debugInfo: run.debug_info,
        cost,
      };
    });
  }, [
    filteredRuns,
    modelMapping,
    agentMapping,
    personaMapping,
    profileMapping,
  ]);

  return (
    <div className="flex flex-col gap-4">
      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-medium">Total spend</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-semibold">
              {currency(totals.totalSpend)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-medium">
              Number of runs
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-semibold">{totals.runCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-medium">
              Avg cost / run
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-semibold">
              {currency(totals.avgCost)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      <Card className="w-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Spend over time</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex h-64 items-center justify-center text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading pricing
              data…
            </div>
          ) : chartData.length === 0 ? (
            <div className="flex h-64 items-center justify-center text-muted-foreground">
              No data for the selected range/models
            </div>
          ) : (
            <ChartContainer
              config={Object.fromEntries(
                Object.entries(chartConfig).map(([k, v]) => [
                  k,
                  { label: v.label, color: v.color },
                ])
              )}
              className="aspect-[16/7]"
            >
              <AreaChart
                data={chartData}
                margin={{ left: 8, right: 8, bottom: 12 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tickLine={false} axisLine={false} />
                <YAxis
                  tickFormatter={(v) => `$${v}`}
                  width={64}
                  tickLine={false}
                  axisLine={false}
                />
                <ChartTooltip
                  content={<ChartTooltipContent />}
                  formatter={(value: number, name: string) => [
                    currency(value),
                    (
                      chartConfig as Record<
                        string,
                        { label: string; color: string }
                      >
                    )[name]?.label || name,
                  ]}
                />
                <ChartLegend content={<ChartLegendContent />} />

                {/* Stacked areas per selected models */}
                {(selectedModelIds.length
                  ? selectedModelIds
                  : Object.keys(modelMapping)
                ).map((id) => (
                  <Area
                    key={id}
                    type="monotone"
                    dataKey={id}
                    stackId="1"
                    stroke={
                      (
                        chartConfig as Record<
                          string,
                          { label: string; color: string }
                        >
                      )[id]?.color
                    }
                    fill={
                      (
                        chartConfig as Record<
                          string,
                          { label: string; color: string }
                        >
                      )[id]?.color
                    }
                    fillOpacity={0.2}
                    strokeWidth={2}
                    dot={false}
                  />
                ))}

                {/* Total spend line */}
                <Line
                  type="monotone"
                  dataKey="total"
                  stroke={
                    (
                      chartConfig as Record<
                        string,
                        { label: string; color: string }
                      >
                    )["total"]?.color
                  }
                  strokeWidth={2}
                  dot={false}
                  name="Total"
                />
              </AreaChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      {/* Runs table */}
      <Card className="w-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Model runs</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex h-40 items-center justify-center text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading runs…
            </div>
          ) : (
            <RunsDataTable
              rows={runRows}
              modelMapping={modelMapping}
              profileMapping={profileMapping}
              agentMapping={agentMapping}
              personaMapping={personaMapping}
              selectedModelIds={selectedModelIds}
              selectedAgentIds={selectedAgentIds}
              selectedPersonaIds={selectedPersonaIds}
              selectedProfileIds={selectedProfileIds}
              setSelectedModelIds={setSelectedModelIds}
              setSelectedAgentIds={setSelectedAgentIds}
              setSelectedPersonaIds={setSelectedPersonaIds}
              setSelectedProfileIds={setSelectedProfileIds}
              dateRange={dateRange}
              setDateRange={setDateRange}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
