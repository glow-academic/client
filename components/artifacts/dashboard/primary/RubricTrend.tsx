/**
 * RubricTrend.tsx
 * Multi-line chart showing rubric score trends over time by standard group.
 * Each standard group is rendered as a separate line.
 * All data processing is handled externally via props.
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
import { useChartColors } from "@/lib/utils/chartColors";
import { TrendingUp } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { TooltipProps } from "recharts";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { TruncatedInsight } from "../TruncatedInsight";

type RubricTrendPoint = {
  date: string | null;
  standard_group_id: string | null;
  standard_group_name: string | null;
  avg_pct: number | null;
};

function CustomLineTooltip({
  active,
  payload,
  label,
  groupColors,
}: TooltipProps<number, string> & {
  groupColors: Record<string, string>;
}) {
  if (!active || !payload || !payload.length || !label) return null;

  const formatDate = (date: string) => {
    const parts = date.split("-");
    if (parts.length === 3) {
      return `${parts[1]}-${parts[2]}`;
    }
    return date;
  };

  return (
    <div className="rounded-md border border-border bg-muted/70 backdrop-blur px-3 py-2 shadow-sm">
      <div className="font-medium">{formatDate(label)}</div>
      <div className="mt-1 text-xs space-y-1">
        {payload.map((item, index) => {
          const name = String(item.name ?? item.dataKey ?? "");
          const color = groupColors[name] || item.color || "";
          return (
            <div key={index} style={{ color }}>
              {name}: {Math.round(Number(item.value))}%
            </div>
          );
        })}
      </div>
    </div>
  );
}

export interface RubricTrendProps {
  trendData: RubricTrendPoint[];
  rubrics: Array<{
    rubric_id: string;
    name: string;
    description: string;
  }>;
  validRubricIds: string[];
  hasDataAvailable: boolean;
  actionableInsight: string | null;
  status: "success" | "warning" | "danger" | "neutral";
  initialSelectedRubrics?: string[] | undefined;
  onRubricSelect?: ((ids: string[]) => void) | undefined;
  rubricSearchValue?: string | undefined;
  onRubricSearchChange?: ((term: string) => void) | undefined;
}

export default function RubricTrend({
  trendData,
  rubrics,
  validRubricIds,
  hasDataAvailable,
  actionableInsight,
  status,
  initialSelectedRubrics,
  onRubricSelect,
  rubricSearchValue,
  onRubricSearchChange,
}: RubricTrendProps) {
  const [isMobile, setIsMobile] = useState(false);
  const chartColors = useChartColors();

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Extract unique standard groups and assign colors
  const { groupNames, groupColors } = useMemo(() => {
    const names = Array.from(
      new Set(
        trendData
          .map((p) => p.standard_group_name)
          .filter((n): n is string => !!n),
      ),
    );
    const colors: Record<string, string> = {};
    names.forEach((name, i) => {
      colors[name] = chartColors[i % chartColors.length] ?? "#888";
    });
    return { groupNames: names, groupColors: colors };
  }, [trendData, chartColors]);

  // Pivot trend data: { date, [groupName]: avg_pct }
  const chartData = useMemo(() => {
    const dateMap = new Map<string, Record<string, number>>();
    for (const point of trendData) {
      if (!point.date || !point.standard_group_name || point.avg_pct == null)
        continue;
      if (!dateMap.has(point.date)) {
        dateMap.set(point.date, {});
      }
      dateMap.get(point.date)![point.standard_group_name] = point.avg_pct;
    }
    return Array.from(dateMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, values]) => ({ date, ...values }));
  }, [trendData]);

  // Rubric picker mapping
  const rubricMapping = useMemo(() => {
    const mapping: Record<string, { name: string; description: string }> = {};
    rubrics.forEach((r) => {
      mapping[r.rubric_id] = { name: r.name, description: r.description };
    });
    return mapping;
  }, [rubrics]);

  const thresholdStatus = status;

  const normalizedInsight = useMemo(
    () => (actionableInsight ?? "").trim(),
    [actionableInsight],
  );

  if (!hasDataAvailable) {
    return (
      <Card className="w-full h-full flex flex-col">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex flex-col items-start">
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Rubric Trend
              </CardTitle>
              <CardDescription className="text-sm line-clamp-2">
                Average rubric scores over time by standard group
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center">
          <div className="text-muted-foreground">
            No data available for the selected period
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full h-full flex flex-col relative">
      <div
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
      <CardHeader className="flex-shrink-0">
        <div className="flex items-start justify-between">
          <div className="flex flex-col items-start">
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Rubric Trend
            </CardTitle>
            <CardDescription className="text-sm line-clamp-2">
              Average rubric scores over time by standard group
            </CardDescription>
          </div>
          <GenericPicker
            items={rubricMapping}
            itemIds={validRubricIds}
            selectedIds={initialSelectedRubrics || []}
            onSelect={onRubricSelect || (() => {})}
            getId={(item) => (item as unknown as { id: string }).id}
            getLabel={(item) => item.name || ""}
            getSearchText={(item) =>
              `${item.name} ${item.description || ""}`
            }
            multiSelect={true}
            placeholder="Filter rubrics..."
            hideSelectedChips={true}
            buttonClassName="w-48"
            {...(rubricSearchValue !== undefined && { searchValue: rubricSearchValue })}
            {...(onRubricSearchChange !== undefined && { onSearchChange: onRubricSearchChange })}
          />
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 flex flex-col space-y-4">
          <div
            className="flex-1 min-h-0"
            style={
              process.env.NODE_ENV === "test"
                ? { minWidth: 400, minHeight: 280 }
                : { minHeight: 280 }
            }
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ bottom: 20 }}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  className="stroke-muted"
                />
                <XAxis
                  dataKey="date"
                  className="text-xs"
                  angle={-45}
                  textAnchor="end"
                  height={60}
                  tickFormatter={(value: string) => {
                    const parts = value.split("-");
                    if (parts.length === 3) {
                      return `${parts[1]}-${parts[2]}`;
                    }
                    return value;
                  }}
                />
                <YAxis className="text-xs" domain={[0, 100]} />
                <Tooltip
                  content={(props) => {
                    if (!props) return null;
                    return (
                      <CustomLineTooltip
                        active={props.active}
                        payload={
                          (props.payload || []) as Array<{
                            dataKey?: string;
                            value?: number;
                            name?: string;
                            color?: string;
                          }>
                        }
                        label={props.label}
                        groupColors={groupColors}
                      />
                    );
                  }}
                />
                <Legend />
                {groupNames.map((name) => (
                  <Line
                    key={name}
                    type="monotone"
                    dataKey={name}
                    stroke={groupColors[name]}
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    name={name}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>

          {normalizedInsight && (
            <div
              className="flex-shrink-0 w-full"
              data-testid="rubric-trend-insight"
            >
              <TruncatedInsight text={normalizedInsight} isMobile={isMobile} />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
