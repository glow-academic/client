"use client";

/**
 * Pricing.tsx
 * Interactive pricing analytics for model runs.
 * - Filters by date range and models
 * - Computes spend from input/output tokens using model ppm
 * - Displays summary cards and a stacked area chart (per model) + total line
 */

import { useQuery } from "@tanstack/react-query";
import { format, isAfter, isBefore } from "date-fns";
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

import { Agent, Model, ModelRun, Persona, Profile } from "@/types";
import { getAllAgents } from "@/utils/queries/agents/get-all-agents";
import { getAllModelRuns } from "@/utils/queries/model_runs/get-all-model-runs";
import { getAllModels } from "@/utils/queries/models/get-all-models";
import { getAllPersonas } from "@/utils/queries/personas/get-all-personas";
import { getAllProfiles } from "@/utils/queries/profiles/get-all-profiles";
import { Loader2 } from "lucide-react";
import { RunsDataTable } from "./RunsDataTable";
import { RunsDataTableToolbar } from "./RunsDataTableToolbar";
import { getDebugInfoByModelRuns } from "@/utils/queries/debug_info/get-debug-info-by-modelruns";
import type { DebugInfo } from "@/types";

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

  const { data: models = [], isLoading: modelsLoading } = useQuery({
    queryKey: ["models"],
    queryFn: () => getAllModels() as Promise<Model[]>,
  });

  const { data: runs = [], isLoading: runsLoading } = useQuery({
    queryKey: ["model_runs"],
    queryFn: () => getAllModelRuns() as Promise<ModelRun[]>,
  });

  const { data: agents = [] } = useQuery({
    queryKey: ["agents"],
    queryFn: () => getAllAgents() as Promise<Agent[]>,
  });

  const { data: personas = [] } = useQuery({
    queryKey: ["personas"],
    queryFn: () => getAllPersonas() as Promise<Persona[]>,
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles"],
    queryFn: () => getAllProfiles() as Promise<Profile[]>,
  });

  const [selectedModelIds, setSelectedModelIds] = useState<string[]>([]);
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([]);
  const [selectedPersonaIds, _setSelectedPersonaIds] = useState<string[]>([]);
  // Grouping removed; always series by model with filters
  const [selectedProfileIds, setSelectedProfileIds] = useState<string[]>([]);

  // Default to All: no pre-selections

  const modelIdToMeta = useMemo(() => {
    const map = new Map<string, Model>();
    models.forEach((m) => map.set(m.id, m));
    return map;
  }, [models]);
  const agentIdToMeta = useMemo(() => {
    const map = new Map<string, Agent>();
    agents.forEach((a) => map.set(a.id, a));
    return map;
  }, [agents]);
  const personaIdToMeta = useMemo(() => {
    const map = new Map<string, Persona>();
    personas.forEach((p) => map.set(p.id, p));
    return map;
  }, [personas]);

  // Compute spend per run and aggregate by day, filtered by agents/personas/profiles; series per model
  const { chartData, totals, chartConfig, filteredRuns } = useMemo(() => {
    if (!runs?.length || !models?.length) {
      return {
        chartData: [] as Array<Record<string, number | string>>,
        totals: { totalSpend: 0, runCount: 0, withProfileRuns: 0, avgCost: 0 },
        chartConfig: {} as Record<string, { label: string; color: string }>,
        filteredRuns: [] as ModelRun[],
      };
    }

    const dateFiltered = runs.filter((r) => {
      if (!dateRange?.from || !dateRange?.to) return true;
      const d = new Date(r.createdAt);
      return isAfter(d, dateRange.from) && isBefore(d, dateRange.to);
    });

    // Build include sets (empty selection means All)
    const includeModels = new Set(
      selectedModelIds.length ? selectedModelIds : models.map((m) => m.id)
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
    let withProfileRuns = 0;

    const matchedRuns: ModelRun[] = [];
    for (const run of dateFiltered) {
      const runProfileId = (run as unknown as { profileId?: string }).profileId;
      const runAgentId = (run as unknown as { agentId?: string }).agentId;
      const runPersonaId = (run as unknown as { personaId?: string }).personaId;
      const modelId = (run as unknown as { modelId?: string | null }).modelId;

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

      // Pricing comes from model
      const meta = modelIdToMeta.get(modelId);
      if (!meta) continue;

      const spend =
        (run.inputTokens / 1_000_000) * (meta.inputPpm || 0) +
        (run.outputTokens / 1_000_000) * (meta.outputPpm || 0);

      const dateKey = format(new Date(run.createdAt), "yyyy-MM-dd");
      const dateLabel = format(new Date(run.createdAt), "MMM dd");

      if (!byDay.has(dateKey)) {
        byDay.set(dateKey, { dateLabel, values: {} });
      }

      const bucket = byDay.get(dateKey)!;
      const seriesKey = modelId;
      bucket.values[seriesKey] = (bucket.values[seriesKey] || 0) + spend;

      totalSpend += spend;
      runCount += 1;
      if (selectedProfileIds.length > 0) {
        // count all included runs (they matched selected profiles)
        withProfileRuns += 1;
      } else if (runProfileId) {
        // when no profiles selected (All), count those that have any profile
        withProfileRuns += 1;
      }
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
      const label = modelIdToMeta.get(id)?.name;
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
        selectedProfileRuns: withProfileRuns,
        avgCost: runCount ? Number((totalSpend / runCount).toFixed(2)) : 0,
      },
      chartConfig: config,
      filteredRuns: matchedRuns,
    };
  }, [
    runs,
    models,
    dateRange,
    selectedModelIds,
    selectedAgentIds,
    selectedPersonaIds,
    selectedProfileIds,
    modelIdToMeta,
  ]);

  const loading = modelsLoading || runsLoading;

  // Debug info by run
  const filteredRunIds = useMemo(
    () => (filteredRuns || []).map((r) => r.id as string),
    [filteredRuns]
  );

  const { data: debugInfoList = [] } = useQuery({
    queryKey: ["debug-info", { runIds: filteredRunIds }],
    queryFn: async () => {
      if (!filteredRunIds.length) return [] as DebugInfo[];
      return (await getDebugInfoByModelRuns(filteredRunIds)) as DebugInfo[];
    },
    enabled: filteredRunIds.length > 0,
  });

  const debugInfoByRunId = useMemo(() => {
    const map = new Map<string, DebugInfo[]>();
    for (const d of debugInfoList) {
      const key = (d.modelRunId as unknown as string) ?? "";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(d);
    }
    return map;
  }, [debugInfoList]);

  // Build options for toolbar
  const modelOptions = useMemo(
    () => models.map((m) => ({ value: m.id, label: m.name })),
    [models]
  );
  const agentOptions = useMemo(
    () => agents.map((a) => ({ value: a.id, label: a.name })),
    [agents]
  );
  const profileOptions = useMemo(() => {
    return profiles.map((p) => {
      const id = p.id as string;
      const label = (
        `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim() || p.alias || id
      );
      return { value: id, label };
    });
  }, [profiles]);

  // Build rows for runs table
  const runRows = useMemo(() => {
    return (filteredRuns || []).map((run) => {
      const modelId = (run as unknown as { modelId?: string | null }).modelId || null;
      const agentId = (run as unknown as { agentId?: string | null }).agentId || null;
      const personaId = (run as unknown as { personaId?: string | null }).personaId || null;
      const profileId = (run as unknown as { profileId?: string | null }).profileId || null;
      return {
        id: run.id as string,
        createdAt: run.createdAt as string,
        modelId,
        modelName: (modelId && modelIdToMeta.get(modelId)?.name) || modelId || "",
        agentId,
        agentName: (agentId && agentIdToMeta.get(agentId)?.name) || agentId || "",
        personaId,
        personaName: (personaId && personaIdToMeta.get(personaId)?.name) || personaId || "",
        profileId,
        profileName:
          (profileId &&
            (() => {
              const p = profiles.find((pp) => pp.id === profileId);
              if (!p) return profileId;
              const lbl = `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim();
              return lbl || p.alias || profileId;
            })()) || "",
        inputTokens: run.inputTokens,
        outputTokens: run.outputTokens,
        debugInfo: debugInfoByRunId.get(run.id as string) || [],
      };
    });
  }, [filteredRuns, modelIdToMeta, agentIdToMeta, personaIdToMeta, profiles, debugInfoByRunId]);

  return (
    <div className="flex flex-col gap-4">
      {/* Faceted filters toolbar */}
      <RunsDataTableToolbar
        modelOptions={modelOptions}
        agentOptions={agentOptions}
        profileOptions={profileOptions}
        selectedModelIds={selectedModelIds}
        selectedAgentIds={selectedAgentIds}
        selectedProfileIds={selectedProfileIds}
        setSelectedModelIds={setSelectedModelIds}
        setSelectedAgentIds={setSelectedAgentIds}
        setSelectedProfileIds={setSelectedProfileIds}
        dateRange={dateRange}
        setDateRange={setDateRange}
      />

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
          {loading ? (
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
                  : models.map((m) => m.id)
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
          {loading ? (
            <div className="flex h-40 items-center justify-center text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading runs…
            </div>
          ) : (
            <RunsDataTable rows={runRows} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
