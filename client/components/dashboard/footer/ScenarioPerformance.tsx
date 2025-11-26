/**
 * ScenarioPerformance.tsx
 * This component displays scenario attribute breakdown with performance metrics.
 * Shows what percentage of scenarios use each specific attribute and their performance.
 * @AshokSaravanan222 & @siladiea
 * 07/23/2025
 */
"use client";

import { GenericPicker } from "@/components/common/forms/GenericPicker";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { TruncatedInsight } from "../TruncatedInsight";

type ScenarioAttributeAttemptFact = {
  parameterId: string;
  parameterItemId: string;
  date: string;
  timestamp: number;
  avgScore: number;
  attempts: number;
  passedAttempts: number;
};

type ScenarioAttributeScenarioFact = {
  parameterId: string;
  parameterItemId: string;
  scenarioId: string;
};

import { useChartColors } from "@/lib/utils/chartColors";
import { BarChart3 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { TooltipProps } from "recharts";
import {
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

function iconFor(paramName: string, itemName: string) {
  const p = paramName.toLowerCase();
  if (p.includes("difficulty")) return "🎚️";
  if (p.includes("topic")) return "🧩";
  if (p.includes("persona")) return "🧑‍🏫";
  if (p.includes("region")) return "🌍";
  // per-item easter eggs:
  if (/pass/i.test(itemName)) return "✅";
  return ""; // was "•"
}

function CustomPieTooltip({
  active,
  payload,
  getElement,
}: {
  active?: boolean;
  payload?: TooltipProps<number, string>["payload"];
  getElement: (name: string) => AttributeElement | undefined;
}) {
  if (!active || !payload || !payload.length) return null;

  // For Pie, the first payload item corresponds to the hovered slice
  const item = payload[0];
  const name = String(item?.name ?? "");
  const el = getElement(name);
  if (!el) return null;

  return (
    <div className="rounded-md border border-border bg-muted/70 backdrop-blur px-3 py-2 shadow-sm">
      <div className="font-medium">
        {el.icon ? <span className="mr-1">{el.icon}</span> : null}
        {el.displayName}
      </div>
      <div className="mt-1 text-xs space-y-1">
        <div>Usage: {el.percentage}%</div>
        <div>Scenarios: {el.count}</div>
        <div>Avg Score: {el.avgScore}%</div>
        <div>Completion: {el.completionRate}%</div>
        <div>Attempts: {el.totalAttempts}</div>
      </div>
    </div>
  );
}

type AttributeElement = {
  id: string;
  name: string;
  displayName: string;
  icon: string;
  color: string;
  count: number;
  percentage: number;
  avgScore: number;
  completionRate: number;
  totalAttempts: number;
  trendData: { date: string; score: number; timestamp: number }[];
};

export interface ScenarioPerformanceProps {
  attributeAttemptFacts: ScenarioAttributeAttemptFact[];
  attributeScenarioFacts: ScenarioAttributeScenarioFact[];
  /** Parameter mapping object */
  parameterMapping: Record<string, { name: string; description: string }>;
  /** Parameter item mapping object */
  parameterItemMapping: Record<
    string,
    {
      name: string;
      description: string;
      parameter_id: string;
      parameter_name: string;
    }
  >;
  /** Valid parameter IDs */
  validParameterIds: string[];
  actionableInsight?: string | null;
  status: "success" | "warning" | "danger" | "neutral";
}

export default function ScenarioPerformance({
  attributeAttemptFacts,
  attributeScenarioFacts,
  parameterMapping,
  parameterItemMapping,
  validParameterIds,
  actionableInsight,
  status,
}: ScenarioPerformanceProps) {
  const [selectedParameterId, setSelectedParameterId] = useState<string>("");
  const [isMobile, setIsMobile] = useState(false);

  // Get chart colors 1-5 from CSS variables
  const chartColors = useChartColors();

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024); // lg breakpoint
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Build parameters from mapping
  const allParameters = useMemo(
    () =>
      validParameterIds.map((id) => ({
        id,
        name: parameterMapping[id]?.name || "Unknown",
        description: parameterMapping[id]?.description || "",
        numerical: false,
        active: true,
        departmentId: "",
      })),
    [parameterMapping, validParameterIds]
  );

  // Build parameter items from mapping
  const allParameterItems = useMemo(
    () =>
      Object.entries(parameterItemMapping)
        .filter(([, item]) => validParameterIds.includes(item.parameter_id))
        .map(([id, item]) => ({
          id,
          name: item.name,
          description: item.description || "",
          parameterId: item.parameter_id,
        })),
    [parameterItemMapping, validParameterIds]
  );

  // Build parameter mapping for GenericPicker
  const parameterMappingForPicker = useMemo(() => {
    const mapping: Record<string, { name: string; description: string }> = {};
    allParameters
      .filter((p) => !p.numerical && p.active)
      .forEach((p) => {
        mapping[p.id] = {
          name: p.name,
          description: `Performance by ${p.name.toLowerCase()} value`,
        };
      });
    return mapping;
  }, [allParameters]);

  const validParameterIdsForPicker = useMemo(() => {
    return allParameters
      .filter((p) => !p.numerical && p.active)
      .map((p) => p.id);
  }, [allParameters]);

  // pick default
  const activeParameterId = useMemo(() => {
    return selectedParameterId || validParameterIdsForPicker[0] || "";
  }, [selectedParameterId, validParameterIdsForPicker]);

  const itemsForParameter = useMemo(
    () =>
      allParameterItems.filter(
        (it) =>
          it.parameterId === activeParameterId &&
          attributeScenarioFacts.some((f) => f.parameterItemId === it.id)
      ),
    [allParameterItems, attributeScenarioFacts, activeParameterId]
  );

  const totalScenariosForParam = useMemo(() => {
    const set = new Set(
      attributeScenarioFacts
        .filter((f) => f.parameterId === activeParameterId)
        .map((f) => f.scenarioId)
    );
    return set.size || 1; // avoid /0
  }, [attributeScenarioFacts, activeParameterId]);

  const elements: AttributeElement[] = useMemo(() => {
    const mapped = itemsForParameter.map((it, idx) => {
      const scen = attributeScenarioFacts.filter(
        (f) => f.parameterItemId === it.id
      );
      const scenCount = new Set(scen.map((s) => s.scenarioId)).size;

      const attempts = attributeAttemptFacts.filter(
        (f) => f.parameterItemId === it.id
      );
      const totalAttempts = attempts.reduce((s, a) => s + a.attempts, 0);
      const passed = attempts.reduce((s, a) => s + a.passedAttempts, 0);
      const avgScoreWeighted =
        totalAttempts > 0
          ? Math.round(
              attempts.reduce((s, a) => s + a.avgScore * a.attempts, 0) /
                totalAttempts
            )
          : 0;
      const completionRate =
        totalAttempts > 0 ? Math.round((100 * passed) / totalAttempts) : 0;

      const trendData = attempts
        .slice()
        .sort((a, b) => a.timestamp - b.timestamp)
        .map((a) => ({
          date: a.date,
          score: a.avgScore,
          timestamp: a.timestamp,
        }));

      const paramName =
        allParameters.find((p) => p.id === activeParameterId)?.name ?? "";

      return {
        id: `param-item-${it.id}`,
        name: it.name,
        displayName: it.name,
        icon: iconFor(paramName, it.name),
        color: "", // Will be set after sorting/limiting
        count: scenCount,
        percentage:
          Math.round((1000 * scenCount) / totalScenariosForParam) / 10, // 1 decimal
        avgScore: avgScoreWeighted,
        completionRate,
        totalAttempts,
        trendData,
      };
    });

    // Sort by usage (percentage) descending, then limit to top 5
    const sorted = mapped
      .sort((a, b) => b.percentage - a.percentage)
      .slice(0, 5);

    // Assign colors after limiting
    return sorted.map((el, idx) => ({
      ...el,
      color: chartColors[idx % chartColors.length],
    }));
  }, [
    itemsForParameter,
    attributeAttemptFacts,
    attributeScenarioFacts,
    totalScenariosForParam,
    activeParameterId,
    allParameters,
    chartColors,
  ]);

  // Use status from server
  const thresholdStatus = status;

  // Create lookup for custom tooltip
  const elementsByName = useMemo(
    () => Object.fromEntries(elements.map((e) => [e.name, e] as const)),
    [elements]
  );

  // Compact legend renderer for single-line layout
  function LegendCompact({
    payload,
    elements,
  }: {
    payload?: Array<{ value: string; color?: string }>;
    elements: AttributeElement[];
  }) {
    const count = payload?.length ?? 0;

    // Density presets based on legend size
    const fontSize = count <= 8 ? 12 : count <= 14 ? 11 : count <= 20 ? 10 : 9;
    const dot = count <= 8 ? 8 : count <= 14 ? 7 : 6;
    const padX = count <= 8 ? "px-2" : count <= 14 ? "px-1.5" : "px-1";
    const padY = count <= 8 ? "py-1" : count <= 14 ? "py-0.5" : "py-0.5";
    const gap = count <= 8 ? "gap-2" : count <= 14 ? "gap-1.5" : "gap-1";
    // Constrain each pill's width so everything fits on one line; truncate long text
    const maxLabelPx = count <= 8 ? 140 : count <= 14 ? 110 : 90;

    return (
      <div
        className={`w-full ${gap} flex items-center justify-center flex-nowrap overflow-x-auto no-scrollbar min-h-7`}
        style={{ lineHeight: 1 }} // keep it one line high
      >
        {payload?.map((entry) => {
          const element = elements.find((e) => e.name === entry.value);
          if (!element) return null;
          return (
            <Dialog key={entry.value}>
              <DialogTrigger asChild>
                <span
                  className={`cursor-pointer hover:text-primary transition-colors inline-flex items-center ${padX} ${padY} rounded border border-border hover:border-primary/50 hover:bg-muted/50 whitespace-nowrap`}
                  style={{ fontSize }}
                  title={element.name} // full name on hover
                >
                  <span
                    className="inline-block rounded-sm mr-1"
                    style={{
                      backgroundColor: element.color,
                      width: dot,
                      height: dot,
                      minWidth: dot,
                    }}
                  />
                  <span className="truncate" style={{ maxWidth: maxLabelPx }}>
                    {element.name}
                  </span>
                </span>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <span className="text-lg">{element.icon}</span>
                    {element.displayName} Performance
                  </DialogTitle>
                  <DialogDescription hidden>Daily trend</DialogDescription>
                </DialogHeader>

                {element.trendData.length > 0 && (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={element.trendData}>
                        <XAxis
                          dataKey="date"
                          className="text-xs"
                          angle={-45}
                          textAnchor="end"
                          height={60}
                        />
                        <YAxis className="text-xs" />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "white",
                            border: "1px solid #e5e7eb",
                            borderRadius: "6px",
                          }}
                          formatter={(v: number) => [`${v}%`, "Score"]}
                        />
                        <Line
                          type="monotone"
                          dataKey="score"
                          stroke={element.color}
                          strokeWidth={2}
                          dot={{ r: 4 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </DialogContent>
            </Dialog>
          );
        })}
      </div>
    );
  }

  return (
    <Card className="w-full h-full flex flex-col relative">
      <div
        data-testid="status-indicator"
        className={`absolute top-2 right-2 w-2 h-2 rounded-full ${
          thresholdStatus === "success"
            ? "bg-success"
            : thresholdStatus === "warning"
              ? "bg-warning"
              : thresholdStatus === "danger"
                ? "bg-destructive"
                : "bg-muted-foreground"
        }`}
      />
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex flex-col items-start">
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Scenario Attribute Breakdown
            </CardTitle>
            <CardDescription className="text-sm line-clamp-2">
              Performance analysis by scenario attributes
            </CardDescription>
          </div>

          {/* Parameter Picker */}
          <GenericPicker
            mapping={parameterMappingForPicker}
            validIds={validParameterIdsForPicker}
            selectedId={activeParameterId}
            onSelect={setSelectedParameterId}
            placeholder="Select Parameter"
            searchPlaceholder="Search parameters..."
            emptyMessage="No parameter found."
            groupHeading="Parameters"
          />
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col gap-2 -mt-2">
        {/* Pie Chart */}
        <div className="flex-1 h-56">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart margin={{ top: -20, right: 8, bottom: 22, left: 8 }}>
              <Pie
                data={elements}
                dataKey="percentage"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={120}
                innerRadius={60}
                paddingAngle={2}
              >
                {elements.map((e, i) => (
                  <Cell key={i} fill={e.color} />
                ))}
              </Pie>
              <Tooltip
                content={
                  <CustomPieTooltip
                    getElement={(name: string) => elementsByName[name]}
                  />
                }
              />
              <Legend
                verticalAlign="bottom"
                height={28}
                wrapperStyle={{ width: "100%" }}
                content={({ payload }) => (
                  <LegendCompact
                    payload={
                      payload as Array<{ value: string; color?: string }>
                    }
                    elements={elements}
                  />
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Actionable Insights */}
        {actionableInsight && (
          <TruncatedInsight text={actionableInsight} isMobile={isMobile} />
        )}
      </CardContent>
    </Card>
  );
}
