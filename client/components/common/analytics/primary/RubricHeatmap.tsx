/**
 * RubricHeatmap.tsx
 * Server-driven rubric heatmap using analytics endpoint.
 * @AshokSaravanan222 & @siladiea
 * 07/23/2025
 */
"use client";

import {
  RubricPicker,
  type Rubric as RubricPickerType,
} from "@/components/common/rubric/RubricPicker";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Info, Loader2, TrendingUp } from "lucide-react";
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type { AnalyticsFilters, RubricHeatmapFilters } from "@/lib/analytics";
import { useAnalyticsRubricHeatmap } from "@/lib/api/hooks/analytics";

export interface RubricHeatmapProps {
  filters: AnalyticsFilters;
}

export default function RubricHeatmap({ filters }: RubricHeatmapProps) {
  // We keep an array for compatibility with your RubricPicker API,
  // but only the FIRST rubric is sent to the server (schema requires a single rubricId).
  const [selectedRubrics, setSelectedRubrics] = useState<RubricPickerType[]>(
    []
  );

  // Build request filters with a single rubricId
  // We don't know the default rubric until the query returns availableRubrics,
  // so we'll pass a placeholder here and re-run when we have one.
  const [rubricId, setRubricId] = useState<string | null>(null);

  const rubricFilters: RubricHeatmapFilters | null = useMemo(() => {
    if (!rubricId) return null;
    return { ...filters, rubricId };
  }, [filters, rubricId]);

  const enabled = !!rubricFilters;
  const { data, isLoading, error } = useAnalyticsRubricHeatmap(
    rubricFilters!,
    enabled
  );

  // When server returns the list, set a default rubric if we don't have one.
  useEffect(() => {
    if (!rubricId && data?.availableRubrics?.length) {
      const first = data.availableRubrics[0];
      if (first) {
        setRubricId(first.id);
        setSelectedRubrics([
          {
            id: first.id,
            name: first.name,
            ...(first.description && { description: first.description }),
            points: first.points,
            active: first.active,
          },
        ]);
      }
    }
  }, [rubricId, data?.availableRubrics]);

  // Keep rubricId in sync with the first selection
  useEffect(() => {
    const first = selectedRubrics[0];
    if (first && first.id !== rubricId) {
      setRubricId(first.id);
    }
    if (!first && data?.availableRubrics?.[0]) {
      setRubricId(data.availableRubrics[0].id);
    }
  }, [selectedRubrics, rubricId, data?.availableRubrics]);

  // Hover perf: identical to your original
  const [hoveredCell, setHoveredCell] = useState<{
    row: number | null;
    col: number | null;
  }>({
    row: null,
    col: null,
  });
  const hoverRAF = useRef<number | null>(null);
  const setHoveredThrottled = useCallback((row: number, col: number) => {
    if (hoverRAF.current !== null) cancelAnimationFrame(hoverRAF.current);
    hoverRAF.current = requestAnimationFrame(() => {
      setHoveredCell({ row, col });
      hoverRAF.current = null;
    });
  }, []);

  // Defer heavy result
  const deferred = useDeferredValue(data);

  // Traffic light directly from server
  const thresholdStatus = deferred?.correlationStatus ?? "neutral";

  // Picker options from server
  const pickerRubrics: RubricPickerType[] = useMemo(
    () =>
      (deferred?.availableRubrics ?? []).map((r) => ({
        id: r.id,
        name: r.name,
        ...(r.description && { description: r.description }),
        points: r.points,
        active: r.active,
      })),
    [deferred?.availableRubrics]
  );

  // Loading / error states
  if (!rubricId || isLoading) {
    return (
      <Card className="w-full h-full flex flex-col relative">
        <StatusDot status={thresholdStatus} />
        <CardHeader className="pb-3">
          <TitleBlock />
        </CardHeader>
        <CardContent className="flex items-center justify-center flex-1 p-3">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading correlation data...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="w-full h-full flex flex-col relative">
        <StatusDot status="danger" />
        <CardHeader className="pb-3">
          <TitleBlock />
        </CardHeader>
        <CardContent className="flex items-center justify-center flex-1 p-3">
          <div className="text-destructive text-sm">
            Failed to load correlation data
          </div>
        </CardContent>
      </Card>
    );
  }

  const groups = deferred?.standardGroups ?? [];
  const matrix = deferred?.matrix ?? [];
  const hasData = deferred?.hasData ?? false;

  return (
    <Card className="w-full h-full flex flex-col relative gap-0">
      <StatusDot status={thresholdStatus} />
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <TitleBlock />
          </div>
          <RubricPicker
            rubrics={pickerRubrics}
            placeholder="Choose rubric..."
            onSelect={(items) => {
              // treat as single-select: keep only the first chosen item
              setSelectedRubrics(items.slice(0, 1));
            }}
            selectedRubrics={selectedRubrics}
            // If your RubricPicker supports single-select mode, pass a prop here instead.
          />
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden">
        <div className="space-y-3 flex flex-col items-center h-full">
          {/* Matrix */}
          <TooltipProvider delayDuration={150}>
            <div className="overflow-x-auto flex-1">
              <Table className="w-auto border-collapse h-full">
                <TableHeader>
                  <TableRow>
                    <TableHead className="p-1 w-12"></TableHead>
                    {groups.map((g, colIndex) => (
                      <TableHead
                        key={g.id}
                        className={cn(
                          "p-1 h-30 w-24 relative",
                          hoveredCell.col === colIndex && "bg-muted"
                        )}
                      >
                        <div
                          className="absolute bottom-2 left-1/2 -translate-x-1/2"
                          style={{ writingMode: "vertical-rl" }}
                        >
                          <span className="text-xs font-normal text-muted-foreground whitespace-nowrap">
                            {g.shortName ?? g.name}
                          </span>
                        </div>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groups.map((g, rowIndex) => (
                    <TableRow
                      key={g.id}
                      onMouseLeave={() =>
                        setHoveredCell({ row: null, col: null })
                      }
                    >
                      <TableCell
                        className={cn(
                          "font-medium text-xs p-1 text-right text-muted-foreground",
                          hoveredCell.row === rowIndex && "bg-muted"
                        )}
                      >
                        {g.shortName ?? g.name}
                      </TableCell>

                      {groups.map((cg, colIndex) => {
                        const cell = matrix?.[rowIndex]?.[colIndex];
                        if (!cell)
                          return <TableCell key={colIndex} className="p-1" />;

                        const totalCells = groups.length * groups.length;
                        const enableTooltips = totalCells <= 1200;

                        const chip = (
                          <div
                            className="w-20 h-6 rounded-sm flex items-center justify-center text-xs font-mono"
                            style={{ backgroundColor: cell.color }}
                          >
                            <span
                              className={cn(
                                "font-semibold",
                                Math.abs(cell.correlation) >= 0.7
                                  ? "text-white"
                                  : "text-gray-800"
                              )}
                            >
                              {cell.correlation.toFixed(2)}
                            </span>
                          </div>
                        );

                        return (
                          <TableCell
                            key={colIndex}
                            className="text-center p-1 w-20"
                            onMouseEnter={() =>
                              setHoveredThrottled(rowIndex, colIndex)
                            }
                          >
                            {enableTooltips ? (
                              <Tooltip>
                                <TooltipTrigger asChild>{chip}</TooltipTrigger>
                                <TooltipContent>
                                  <p>{`${g.shortName ?? g.name} ↔ ${cg.shortName ?? cg.name}`}</p>
                                  <p>
                                    Pearson r: {cell.correlation > 0 ? "+" : ""}
                                    {cell.correlation.toFixed(2)}
                                  </p>
                                  <p>
                                    p-value:{" "}
                                    {cell.pValue === null
                                      ? "n/a"
                                      : Number.isFinite(cell.pValue)
                                        ? cell.pValue.toFixed(3)
                                        : "n/a"}
                                  </p>
                                  <p>Data points: {cell.dataPoints}</p>
                                  <p>Strength: {cell.strength}</p>
                                </TooltipContent>
                              </Tooltip>
                            ) : (
                              chip
                            )}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TooltipProvider>

          {/* Legend + Info */}
          <div className="flex items-center justify-between text-xs text-muted-foreground flex-shrink-0 w-full">
            <div className="flex items-center gap-3">
              <LegendDot label="Strong Positive" className="bg-green-500" />
              <LegendDot label="Strong Negative" className="bg-red-500" />
              <LegendDot label="Weak/No Correlation" className="bg-gray-300" />
            </div>

            <Tooltip>
              <TooltipTrigger asChild>
                <div className="bg-background/90 backdrop-blur-sm border rounded-md px-2 py-1 shadow-sm">
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-medium">Pearson r:</span>
                    <span className="text-xs font-bold">Matrix</span>
                    <Info className="h-3 w-3 text-muted-foreground" />
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent className="w-64 p-3">
                <p className="text-sm">
                  Pearson correlation matrix of skill areas (standard groups).
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  r ∈ [-1, 1]; p-values indicate statistical significance.
                </p>
              </TooltipContent>
            </Tooltip>
          </div>

          {/* Insights */}
          {deferred?.insights && (
            <div className="p-3 bg-muted rounded-lg text-left flex-shrink-0 w-full">
              <p className="text-xs text-muted-foreground">
                {deferred.insights}
              </p>
            </div>
          )}

          {/* No data */}
          {deferred && !hasData && (
            <div className="p-3 bg-muted/50 rounded-lg text-left flex-shrink-0 w-full">
              <p className="text-xs text-muted-foreground">
                No correlation data available yet. Once sessions generate
                feedback across multiple skill areas, correlations will appear
                here.
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------- tiny UI helpers ---------- */

function StatusDot({
  status,
}: {
  status: "success" | "warning" | "danger" | "neutral";
}) {
  return (
    <div
      className={cn(
        "absolute top-2 right-2 w-2 h-2 rounded-full",
        status === "success" && "bg-green-500",
        status === "warning" && "bg-yellow-500",
        status === "danger" && "bg-red-500",
        status === "neutral" && "bg-gray-400"
      )}
    />
  );
}

function TitleBlock() {
  return (
    <>
      <CardTitle className="flex items-center gap-2 text-base">
        <TrendingUp className="h-4 w-4" />
        Skill Area Correlation Matrix
      </CardTitle>
      <CardDescription className="text-xs">
        Statistical correlation between skill areas (standard groups)
      </CardDescription>
    </>
  );
}

function LegendDot({ label, className }: { label: string; className: string }) {
  return (
    <div className="flex items-center gap-1">
      <div className={cn("w-2 h-2 rounded-full", className)} />
      <span>{label}</span>
    </div>
  );
}
