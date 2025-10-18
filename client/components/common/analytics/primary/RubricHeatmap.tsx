/**
 * RubricHeatmap.tsx
 * Multi-rubric heatmap component that displays correlation matrices for selected rubrics.
 * @AshokSaravanan222 & @siladiea
 * 07/23/2025
 */
"use client";

import {
  RubricPicker,
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
import type { RubricMatrixPackage } from "@/lib/api/v2/schemas/analytics";
import { type RubricMapping } from "@/lib/api/v2/schemas/base";
import { cn } from "@/lib/utils";
import { Info, Loader2, TrendingUp } from "lucide-react";
import {
  useCallback,
  useDeferredValue,
  useMemo,
  useRef,
  useState,
} from "react";

export interface RubricHeatmapProps {
  matrices: RubricMatrixPackage[];
  rubricMapping: RubricMapping;
  validRubricIds: string[];
  hasDataAvailable: boolean;
  isLoading: boolean;
  isError: boolean;
  actionableInsight?: string | null | undefined;
  thresholds: {
    danger: number;
    warning: number;
    success: number;
  };
}

export default function RubricHeatmap({
  matrices,
  rubricMapping,
  validRubricIds,
  hasDataAvailable,
  isLoading,
  isError,
  actionableInsight,
  thresholds,
}: RubricHeatmapProps) {
  const [selectedRubrics, setSelectedRubrics] = useState<string[]>(
    []
  );

  // State to track hovered cell for highlighting
  const [hoveredCell, setHoveredCell] = useState<{
    row: number | null;
    col: number | null;
  }>({ row: null, col: null });

  // Filter matrices by selected rubrics
  const filteredMatrices = useMemo(() => {
    if (selectedRubrics.length === 0) return matrices;
    const selectedIds = new Set(selectedRubrics);
    return matrices.filter((matrix) => selectedIds.has(matrix.rubricId));
  }, [matrices, selectedRubrics]);

  // Use the first matrix for display (or show all if none selected)
  const displayMatrix = filteredMatrices[0] || null;

  // Defer heavy result propagation to avoid blocking interactions/scroll
  const deferredMatrix = useDeferredValue(displayMatrix);

  // Throttle hover updates to once per animation frame to reduce rerenders
  const hoverRAF = useRef<number | null>(null);
  const setHoveredThrottled = useCallback((row: number, col: number) => {
    if (hoverRAF.current !== null) {
      cancelAnimationFrame(hoverRAF.current);
    }
    hoverRAF.current = requestAnimationFrame(() => {
      setHoveredCell({ row, col });
      hoverRAF.current = null;
    });
  }, []);

  // Calculate threshold status based on correlation matrix data
  const getThresholdStatus = () => {
    if (!deferredMatrix) return "neutral";
    if (!deferredMatrix.hasData) return "neutral";
    if (!deferredMatrix.matrix || deferredMatrix.matrix.length === 0)
      return "neutral";

    // Calculate average correlation strength across all non-diagonal cells
    let totalCorrelation = 0;
    let correlationCount = 0;

    for (let i = 0; i < deferredMatrix.matrix.length; i++) {
      const row = deferredMatrix.matrix[i];
      if (!row) continue;

      for (let j = 0; j < row.length; j++) {
        if (i !== j) {
          // Skip diagonal cells (self-correlation)
          const cell = row[j];
          if (cell && cell.dataPoints > 0) {
            totalCorrelation += Math.abs(cell.correlation);
            correlationCount++;
          }
        }
      }
    }

    if (correlationCount === 0) return "neutral";

    const avgCorrelationStrength = totalCorrelation / correlationCount;

    // Convert correlation strength to a 0-100 scale for threshold comparison
    const correlationScore = avgCorrelationStrength * 100;

    if (correlationScore >= thresholds.success) return "success";
    if (correlationScore >= thresholds.warning) return "warning";
    return "danger";
  };

  const thresholdStatus = getThresholdStatus();

  // Show loading state
  if (isLoading) {
    return (
      <Card className="w-full h-full flex flex-col relative">
        <div
          className={`absolute top-2 right-2 w-2 h-2 rounded-full ${
            thresholdStatus === "success"
              ? "bg-green-500"
              : thresholdStatus === "warning"
                ? "bg-yellow-500"
                : thresholdStatus === "danger"
                  ? "bg-red-500"
                  : "bg-gray-400"
          }`}
        />
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4" />
            Skill Area Correlation Matrix
          </CardTitle>
          <CardDescription className="text-xs">
            Statistical correlation between skill areas (standard groups)
          </CardDescription>
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

  // Show error state
  if (isError) {
    return (
      <Card className="w-full h-full flex flex-col">
        <CardHeader>
          <CardTitle>Skill Area Correlation Matrix</CardTitle>
          <CardDescription>Error loading correlation data</CardDescription>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center">
          <div className="text-destructive">
            Failed to load correlation data
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show no data state
  if (!hasDataAvailable || !deferredMatrix) {
    return (
      <Card className="w-full h-full flex flex-col">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Skill Area Correlation Matrix
          </CardTitle>
          <CardDescription>
            Statistical correlation between skill areas (standard groups)
          </CardDescription>
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
    <Card className="w-full h-full flex flex-col relative gap-0">
      <div
        className={`absolute top-2 right-2 w-2 h-2 rounded-full ${
          thresholdStatus === "success"
            ? "bg-green-500"
            : thresholdStatus === "warning"
              ? "bg-yellow-500"
              : thresholdStatus === "danger"
                ? "bg-red-500"
                : "bg-gray-400"
        }`}
      />
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4" />
              Skill Area Correlation Matrix
            </CardTitle>
            <CardDescription className="text-xs">
              Correlation between skill areas (standard groups)
            </CardDescription>
          </div>
          <RubricPicker
            mapping={rubricMapping}
            validIds={validRubricIds}
            selectedIds={selectedRubrics}
            onSelect={setSelectedRubrics}
            placeholder="Filter by rubric..."
            buttonClassName="w-48"
          />
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden">
        <div className="space-y-3 flex flex-col items-center h-full">
          {/* Correlation Matrix Table for a more compact, square layout */}
          <TooltipProvider delayDuration={150}>
            <div className="overflow-x-auto flex-1">
              <Table className="w-auto border-collapse h-full">
                <TableHeader>
                  <TableRow>
                    {/* The first empty cell for alignment */}
                    <TableHead className="p-1 w-12"></TableHead>
                    {(deferredMatrix.standardGroups || []).map(
                      (group, colIndex) => (
                        <TableHead
                          key={group.id}
                          className={cn(
                            "p-1 h-30 w-24 relative", // Increased width from w-16 to w-24
                            hoveredCell.col === colIndex && "bg-muted" // Highlight on hover
                          )}
                        >
                          {/* Rotated Label */}
                          <div
                            className="absolute bottom-2 left-1/2 -translate-x-1/2"
                            style={{ writingMode: "vertical-rl" }}
                          >
                            <span className="text-xs font-normal text-muted-foreground whitespace-nowrap">
                              {group.shortName}
                            </span>
                          </div>
                        </TableHead>
                      )
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(deferredMatrix.standardGroups || []).map(
                    (group, rowIndex) => (
                      <TableRow
                        key={group.id}
                        onMouseLeave={() =>
                          setHoveredCell({ row: null, col: null })
                        }
                      >
                        {/* This is now the row header, not part of the grid */}
                        <TableCell
                          className={cn(
                            "font-medium text-xs p-1 text-right text-muted-foreground",
                            hoveredCell.row === rowIndex && "bg-muted" // Highlight on hover
                          )}
                        >
                          {group.shortName}
                        </TableCell>
                        {(deferredMatrix.standardGroups || []).map(
                          (colGroup, colIndex) => {
                            const cell =
                              deferredMatrix.matrix?.[rowIndex]?.[colIndex];
                            if (!cell) {
                              return (
                                <TableCell key={colIndex} className="p-1" />
                              );
                            }

                            // Disable tooltips for very large matrices to reduce DOM weight
                            const totalCells =
                              (deferredMatrix.standardGroups?.length || 0) *
                              (deferredMatrix.standardGroups?.length || 0);
                            const enableTooltips = totalCells <= 1200; // 35x35

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
                                    <TooltipTrigger asChild>
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
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>{`${group.shortName} ↔ ${colGroup.shortName}`}</p>
                                      <p>
                                        Pearson r:{" "}
                                        {cell.correlation > 0 ? "+" : ""}
                                        {cell.correlation.toFixed(2)}
                                      </p>
                                      {cell.pValue && (
                                        <p>p-value: {cell.pValue.toFixed(3)}</p>
                                      )}
                                      <p>Data points: {cell.dataPoints}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                ) : (
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
                                )}
                              </TableCell>
                            );
                          }
                        )}
                      </TableRow>
                    )
                  )}
                </TableBody>
              </Table>
            </div>
          </TooltipProvider>

          {/* Legend and Correlation Info */}
          <div className="flex items-center justify-between text-xs text-muted-foreground flex-shrink-0 w-full">
            {/* Legend */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span>Strong Positive</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-red-500" />
                <span>Strong Negative</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-gray-300" />
                <span>Weak/No Correlation</span>
              </div>
            </div>

            {/* Correlation Info */}
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
                  Pearson correlation coefficient matrix showing relationships
                  between skill areas.
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Values range from -1 (perfect negative) to +1 (perfect
                  positive). P-values indicate statistical significance.
                </p>
              </TooltipContent>
            </Tooltip>
          </div>

          {/* Actionable Insights */}
          {actionableInsight && (
            <div className="p-3 bg-muted rounded-lg text-left flex-shrink-0 w-full">
              <p className="text-xs text-muted-foreground">
                {actionableInsight}
              </p>
            </div>
          )}

          {/* No Data Message */}
          {deferredMatrix && !deferredMatrix.hasData && (
            <div className="p-3 bg-muted/50 rounded-lg text-left flex-shrink-0 w-full">
              <p className="text-xs text-muted-foreground">
                No correlation data available. The matrix shows the structure of
                skill areas, but correlations will appear once students complete
                simulations with feedback across multiple skill areas.
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
