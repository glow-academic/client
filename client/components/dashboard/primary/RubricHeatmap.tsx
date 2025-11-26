/**
 * RubricHeatmap.tsx
 * Multi-rubric heatmap component that displays correlation matrices for selected rubrics.
 * @AshokSaravanan222 & @siladiea
 * 07/23/2025
 */
"use client";

import { RubricPicker } from "@/components/common/forms/RubricPicker";
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
import { TruncatedInsight } from "../TruncatedInsight";

type RubricHeatmapCell = {
  rubricId: string;
  correlation: number;
  pValue: number | null;
  color: string;
  strength: string;
  dataPoints: number;
};

type StandardGroup = {
  id: string;
  name: string;
  shortName: string | null;
  rubricId: string;
};

type RubricMatrixPackage = {
  rubricId: string;
  standardGroups: StandardGroup[];
  matrix: RubricHeatmapCell[][];
  insights: string | null;
  hasData: boolean;
};

type RubricMapping = Record<string, { name: string; description: string }>;

import { Info, TrendingUp } from "lucide-react";
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export interface RubricHeatmapProps {
  matrices: RubricMatrixPackage[];
  rubricMapping: RubricMapping;
  validRubricIds: string[];
  hasDataAvailable: boolean;
  actionableInsight?: string | null | undefined;
  status: "success" | "warning" | "danger" | "neutral";
}

export default function RubricHeatmap({
  matrices,
  rubricMapping,
  validRubricIds,
  hasDataAvailable,
  actionableInsight,
  status,
}: RubricHeatmapProps) {
  const [selectedRubrics, setSelectedRubrics] = useState<string[]>([]);

  // State to track hovered cell for highlighting
  const [hoveredCell, setHoveredCell] = useState<{
    row: number | null;
    col: number | null;
  }>({ row: null, col: null });

  // Track mobile viewport for responsive design
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024); // lg breakpoint
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

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

  // Use status from server
  const thresholdStatus = status;

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
            ? "bg-success"
            : thresholdStatus === "warning"
              ? "bg-warning"
              : thresholdStatus === "danger"
                ? "bg-destructive"
                : "bg-muted-foreground"
        }`}
      />
      <CardHeader className={cn("pb-3", isMobile && "pb-2")}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <CardTitle
              className={cn(
                "flex items-center gap-2",
                isMobile ? "text-sm" : "text-base"
              )}
            >
              <TrendingUp className={cn(isMobile ? "h-3 w-3" : "h-4 w-4")} />
              {isMobile
                ? "Correlation Matrix"
                : "Skill Area Correlation Matrix"}
            </CardTitle>
            <CardDescription
              className={cn(isMobile ? "text-[10px]" : "text-xs")}
            >
              {isMobile
                ? "Correlation between skill areas"
                : "Correlation between skill areas (standard groups)"}
            </CardDescription>
          </div>
          <RubricPicker
            mapping={rubricMapping}
            validIds={validRubricIds}
            selectedIds={selectedRubrics}
            onSelect={setSelectedRubrics}
            placeholder="Filter by rubric..."
            buttonClassName={cn(isMobile ? "w-full sm:w-48" : "w-48")}
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
                    <TableHead
                      className={cn("p-1", isMobile ? "w-8" : "w-12")}
                    ></TableHead>
                    {(deferredMatrix.standardGroups || []).map(
                      (group, colIndex) => (
                        <TableHead
                          key={group.id}
                          className={cn(
                            "p-1 h-30 relative",
                            isMobile ? "w-16" : "w-24",
                            hoveredCell.col === colIndex && "bg-muted" // Highlight on hover
                          )}
                        >
                          {/* Rotated Label */}
                          <div
                            className={cn(
                              "absolute bottom-2 left-1/2 -translate-x-1/2",
                              isMobile && "bottom-1"
                            )}
                            style={{ writingMode: "vertical-rl" }}
                          >
                            <span
                              className={cn(
                                "font-normal text-muted-foreground whitespace-nowrap",
                                isMobile ? "text-[10px]" : "text-xs"
                              )}
                            >
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
                            "font-medium p-1 text-right text-muted-foreground",
                            isMobile ? "text-[10px]" : "text-xs",
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
                                className={cn(
                                  "text-center p-1",
                                  isMobile ? "w-12" : "w-20"
                                )}
                                onMouseEnter={() =>
                                  setHoveredThrottled(rowIndex, colIndex)
                                }
                              >
                                {enableTooltips ? (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div
                                        className={cn(
                                          "rounded-sm flex items-center justify-center font-mono",
                                          isMobile
                                            ? "w-12 h-5 text-[10px]"
                                            : "w-20 h-6 text-xs"
                                        )}
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
                                    className={cn(
                                      "rounded-sm flex items-center justify-center font-mono",
                                      isMobile
                                        ? "w-12 h-5 text-[10px]"
                                        : "w-20 h-6 text-xs"
                                    )}
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
          <div
            className={cn(
              "flex flex-shrink-0 w-full text-muted-foreground",
              isMobile
                ? "flex-col gap-2 text-[10px]"
                : "items-center justify-between text-xs"
            )}
          >
            {/* Legend */}
            <div
              className={cn(
                "flex items-center",
                isMobile ? "gap-2 flex-wrap" : "gap-3"
              )}
            >
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-success" />
                <span>{isMobile ? "Strong +" : "Strong Positive"}</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-destructive" />
                <span>{isMobile ? "Strong -" : "Strong Negative"}</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-gray-300" />
                <span>{isMobile ? "Weak" : "Weak/No Correlation"}</span>
              </div>
            </div>

            {/* Correlation Info */}
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className={cn(
                    "bg-background/90 backdrop-blur-sm border rounded-md shadow-sm",
                    isMobile ? "px-1.5 py-0.5" : "px-2 py-1"
                  )}
                >
                  <div className="flex items-center gap-1">
                    <span
                      className={cn(
                        "font-medium",
                        isMobile ? "text-[10px]" : "text-xs"
                      )}
                    >
                      Pearson r:
                    </span>
                    <span
                      className={cn(
                        "font-bold",
                        isMobile ? "text-[10px]" : "text-xs"
                      )}
                    >
                      Matrix
                    </span>
                    <Info
                      className={cn(
                        "text-muted-foreground",
                        isMobile ? "h-2.5 w-2.5" : "h-3 w-3"
                      )}
                    />
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
            <div className="flex-shrink-0 w-full">
              <TruncatedInsight text={actionableInsight} isMobile={isMobile} />
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
