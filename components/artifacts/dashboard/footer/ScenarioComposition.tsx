/**
 * ScenarioComposition.tsx
 * Pick a scenario, see its chats split into high/low performing groups
 * with parameter breakdown per group.
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { useChartColors } from "@/lib/utils/chartColors";
import { BarChart3, TrendingDown, TrendingUp } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { TruncatedInsight } from "../TruncatedInsight";

type ScenarioSummary = {
  scenarioId: string;
  name: string;
  totalChats: number;
  highCount: number;
  lowCount: number;
  highAvgScore: number;
  lowAvgScore: number;
};

type ChatParameterFact = {
  scenarioId: string;
  group: "high" | "low";
  parameterId: string;
  parameterItemId: string;
  chatCount: number;
};

type Parameter = {
  parameter_id: string;
  name: string;
  description: string;
};

type Field = {
  field_id: string;
  name: string;
  description: string;
  parameter_id: string;
  parameter_name: string;
};

type Scenario = {
  scenario_id: string;
  name: string;
  description: string;
};

type ParameterRow = {
  name: string;
  value: number;
  color: string;
};

export interface ScenarioCompositionProps {
  scenarioSummaries: ScenarioSummary[];
  chatParameterFacts: ChatParameterFact[];
  scenarios: Scenario[];
  parameters: Parameter[];
  fields: Field[];
  validScenarioIds: string[];
  actionableInsight?: string | null;
  status: "success" | "warning" | "danger" | "neutral";
  initialSelectedScenarios?: string[] | undefined;
  onScenarioSelect?: ((ids: string[]) => void) | undefined;
  scenarioSearchValue?: string | undefined;
  onScenarioSearchChange?: ((term: string) => void) | undefined;
}

export default function ScenarioComposition({
  scenarioSummaries,
  chatParameterFacts,
  scenarios,
  parameters,
  fields,
  validScenarioIds,
  actionableInsight,
  status,
  initialSelectedScenarios,
  onScenarioSelect,
  scenarioSearchValue,
  onScenarioSearchChange,
}: ScenarioCompositionProps) {
  const scenarioMapping = useMemo(() => {
    return scenarios.reduce(
      (acc, s) => {
        acc[s.scenario_id] = { name: s.name, description: s.description };
        return acc;
      },
      {} as Record<string, { name: string; description: string }>,
    );
  }, [scenarios]);

  const [selectedScenarioIdInternal, setSelectedScenarioIdInternal] =
    useState<string>(initialSelectedScenarios?.[0] ?? "");
  const selectedScenarioId =
    initialSelectedScenarios?.[0] ?? selectedScenarioIdInternal;
  const setSelectedScenarioId = (id: string) => {
    if (onScenarioSelect) {
      onScenarioSelect(id ? [id] : []);
    } else {
      setSelectedScenarioIdInternal(id);
    }
  };

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

  useEffect(() => {
    if (!selectedScenarioId && validScenarioIds[0]) {
      setSelectedScenarioId(validScenarioIds[0]);
    } else if (
      selectedScenarioId &&
      !validScenarioIds.includes(selectedScenarioId)
    ) {
      setSelectedScenarioId(validScenarioIds[0] || "");
    }
  }, [validScenarioIds, selectedScenarioId]);

  // Get the summary for the selected scenario
  const selectedSummary = useMemo(
    () => scenarioSummaries.find((s) => s.scenarioId === selectedScenarioId),
    [scenarioSummaries, selectedScenarioId],
  );

  // Build parameter lookup maps
  const parameterMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const p of parameters) map[p.parameter_id] = p.name;
    return map;
  }, [parameters]);

  const fieldMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const f of fields) map[f.field_id] = f.name;
    return map;
  }, [fields]);

  // Build high/low parameter rows for the selected scenario
  const { highRows, lowRows } = useMemo(() => {
    const facts = chatParameterFacts.filter(
      (f) => f.scenarioId === selectedScenarioId,
    );

    // Assign colors to unique parameter items
    const colorMap = new Map<string, string>();
    let colorIdx = 0;
    for (const f of facts) {
      const key = `${f.parameterId}:${f.parameterItemId}`;
      if (!colorMap.has(key)) {
        colorMap.set(key, chartColors[colorIdx % chartColors.length] || "#6b7280");
        colorIdx++;
      }
    }

    const buildRows = (group: "high" | "low"): ParameterRow[] => {
      return facts
        .filter((f) => f.group === group)
        .map((f) => ({
          name: fieldMap[f.parameterItemId] || parameterMap[f.parameterId] || f.parameterId,
          value: f.chatCount,
          color: colorMap.get(`${f.parameterId}:${f.parameterItemId}`) || "#6b7280",
        }))
        .sort((a, b) => b.value - a.value);
    };

    return { highRows: buildRows("high"), lowRows: buildRows("low") };
  }, [chatParameterFacts, selectedScenarioId, chartColors, parameterMap, fieldMap]);

  return (
    <Card className="w-full h-full flex flex-col relative">
      <div
        data-testid="status-indicator"
        className={`absolute top-2 right-2 w-2 h-2 rounded-full ${
          status === "success"
            ? "bg-success"
            : status === "warning"
              ? "bg-warning"
              : status === "danger"
                ? "bg-destructive"
                : "bg-muted-foreground"
        }`}
      />
      <CardHeader className={cn("pb-3", isMobile && "pb-2")}>
        <div
          className={cn(
            "flex",
            isMobile ? "flex-col gap-2" : "items-start justify-between",
          )}
        >
          <div className="flex flex-col items-start">
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Scenario Composition
            </CardTitle>
            <CardDescription className="text-sm line-clamp-2">
              {isMobile
                ? "High vs low chats"
                : "High vs low performing chats within a scenario"}
            </CardDescription>
          </div>

          <GenericPicker
            items={scenarioMapping}
            itemIds={validScenarioIds}
            selectedIds={selectedScenarioId ? [selectedScenarioId] : []}
            onSelect={(ids) => setSelectedScenarioId(ids[0] || "")}
            getId={(s) => (s as unknown as { id: string }).id}
            getLabel={(s) => s.name || ""}
            getSearchText={(s) => `${s.name} ${s.description || ""}`}
            renderPreview={(s) => (
              <div className="grid gap-2">
                <h4 className="font-medium leading-none">{s.name}</h4>
                <div className="text-sm text-muted-foreground">
                  {s.description || "No description available"}
                </div>
              </div>
            )}
            multiSelect={false}
            placeholder="Select scenario..."
            hideSelectedChips={true}
            showLabel={false}
            buttonClassName={cn(isMobile ? "w-full" : "w-64")}
            groupHeading="Scenarios"
            {...(scenarioSearchValue !== undefined && {
              initialSearchTerm: scenarioSearchValue,
            })}
            {...(onScenarioSearchChange !== undefined && {
              onSearchChange: onScenarioSearchChange,
            })}
          />
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col gap-4 min-h-0">
        {/* Summary stats */}
        {selectedSummary && (
          <div className="flex justify-center gap-6 text-xs text-muted-foreground">
            <span>{selectedSummary.totalChats} total chats</span>
            <span className="text-green-600">
              {selectedSummary.highCount} high ({selectedSummary.highAvgScore}% avg)
            </span>
            <span className="text-red-600">
              {selectedSummary.lowCount} low ({selectedSummary.lowAvgScore}% avg)
            </span>
          </div>
        )}

        {highRows.length === 0 && lowRows.length === 0 && selectedScenarioId && (
          <div
            className={cn(
              "text-center bg-muted/50 rounded-lg flex-shrink-0",
              isMobile ? "p-2" : "p-4",
            )}
          >
            <p className={cn("text-muted-foreground", isMobile ? "text-xs" : "text-sm")}>
              No parameter data available for this scenario.
            </p>
          </div>
        )}

        <div
          className={cn(
            "flex-1 min-h-0 overflow-auto",
            isMobile ? "min-h-[180px]" : "min-h-[260px]",
          )}
        >
          <div
            className={cn(
              "grid items-start",
              isMobile
                ? "grid-cols-1 gap-2"
                : "grid-cols-1 lg:grid-cols-2 gap-4",
            )}
          >
            {/* High Performing Side */}
            <div className={cn("rounded-lg", isMobile ? "p-2" : "p-3")}>
              <div className={cn("text-center", isMobile ? "mb-2" : "mb-3")}>
                <h3
                  className={cn(
                    "font-semibold text-green-600 flex items-center justify-center gap-1",
                    isMobile ? "text-xs" : "text-sm",
                  )}
                >
                  <TrendingUp
                    className={cn(isMobile ? "h-2.5 w-2.5" : "h-3 w-3")}
                  />
                  High Performing
                </h3>
                <p
                  className={cn(
                    "text-muted-foreground",
                    isMobile ? "text-[10px]" : "text-xs",
                  )}
                >
                  {selectedSummary?.highCount ?? 0} chats
                </p>
              </div>
              <ParameterTable rows={highRows} isMobile={isMobile} variant="high" />
            </div>

            {/* Low Performing Side */}
            <div className={cn("rounded-lg", isMobile ? "p-1.5" : "p-3")}>
              <div className={cn("text-center", isMobile ? "mb-1.5" : "mb-3")}>
                <h3
                  className={cn(
                    "font-semibold text-red-600 flex items-center justify-center gap-0.5",
                    isMobile ? "text-[10px]" : "text-sm",
                  )}
                >
                  <TrendingDown
                    className={cn(isMobile ? "h-2 w-2" : "h-3 w-3")}
                  />
                  Low Performing
                </h3>
                <p
                  className={cn(
                    "text-muted-foreground",
                    isMobile ? "text-[9px] mt-0.5" : "text-xs",
                  )}
                >
                  {selectedSummary?.lowCount ?? 0} chats
                </p>
              </div>
              <ParameterTable rows={lowRows} isMobile={isMobile} variant="low" />
            </div>
          </div>
        </div>

        {actionableInsight && (
          <div className="flex-shrink-0 w-full">
            <TruncatedInsight text={actionableInsight} isMobile={isMobile} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ParameterTable({
  rows,
  isMobile,
  variant,
}: {
  rows: ParameterRow[];
  isMobile: boolean;
  variant: "high" | "low";
}) {
  const maxRows = variant === "high" ? (isMobile ? 4 : 5) : isMobile ? 3 : 5;

  return (
    <div
      className={cn(
        "overflow-auto rounded-md",
        isMobile ? "max-h-48" : "max-h-64",
      )}
    >
      <Table className="w-full table-fixed">
        <colgroup>
          <col className={cn(isMobile && variant === "low" ? "w-[70%]" : "w-[75%]")} />
          <col className={cn(isMobile && variant === "low" ? "w-[30%]" : "w-[25%]")} />
        </colgroup>
        <TableHeader>
          <TableRow>
            <TableHead
              className={cn(
                "leading-snug",
                variant === "low" && isMobile
                  ? "p-0.5 text-[9px]"
                  : isMobile
                    ? "p-1 text-[10px]"
                    : "p-2 text-xs",
              )}
            >
              {isMobile && variant === "low" ? "Param" : "Parameter"}
            </TableHead>
            <TableHead
              className={cn(
                "leading-snug text-right shrink-0",
                variant === "low" && isMobile
                  ? "p-0.5 text-[9px] w-8"
                  : isMobile
                    ? "p-1 text-[10px] w-12"
                    : "p-2 text-xs w-16",
              )}
            >
              {variant === "low" && isMobile ? "#" : "Count"}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.slice(0, maxRows).map((item, index) => (
            <TableRow
              key={`${variant}-${index}`}
              className="hover:bg-muted/50"
            >
              <TableCell
                className={cn(
                  variant === "low" && isMobile
                    ? "leading-tight p-0.5"
                    : isMobile
                      ? "leading-snug p-1"
                      : "leading-snug p-2",
                )}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className={cn(
                      "rounded-full shrink-0",
                      variant === "low" && isMobile
                        ? "w-1 h-1"
                        : isMobile
                          ? "w-1.5 h-1.5"
                          : "w-2 h-2",
                    )}
                    style={{ backgroundColor: item.color }}
                  />
                  <span
                    className={cn(
                      "truncate",
                      variant === "low" && isMobile
                        ? "text-[9px]"
                        : isMobile
                          ? "text-[10px]"
                          : "text-xs",
                    )}
                    title={item.name}
                  >
                    {item.name}
                  </span>
                </div>
              </TableCell>
              <TableCell
                className={cn(
                  "font-mono tabular-nums text-right shrink-0",
                  variant === "low" && isMobile
                    ? "p-0.5 text-[9px] w-8"
                    : isMobile
                      ? "p-1 text-[10px] w-12"
                      : "p-2 text-xs w-16",
                )}
              >
                {item.value}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
