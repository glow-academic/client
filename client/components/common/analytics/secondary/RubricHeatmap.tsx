/**
 * RubricHeatmap.tsx
 * This component displays the rubric heatmap for the personas.
 * @AshokSaravanan222 & @siladiea
 * 07/23/2025
 */
"use client";

import {
  RubricPicker,
  type Rubric,
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
import { calculateRubricHeatmap } from "@/utils/analytics/secondary";
import { profileRole } from "@/utils/drizzle/schema";
import { getAllCohorts } from "@/utils/queries/cohorts/get-all-cohorts";
import { getAllProfiles } from "@/utils/queries/profiles/get-all-profiles";
import { getAllRubrics } from "@/utils/queries/rubrics/get-all-rubrics";
import { getSimulationAttemptsByProfiles } from "@/utils/queries/simulation_attempts/get-simulation-attempts-by-profiles";
import { getSimulationChatFeedbacksBySimulationChatGrades } from "@/utils/queries/simulation_chat_feedbacks/get-simulation-chat-feedbacks-by-simulationchatgrades";
import { getSimulationChatGradesByRubrics } from "@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-rubrics";
import { getSimulationChatsByAttempts } from "@/utils/queries/simulation_chats/get-simulation-chats-by-attempts";
import { getStandardGroupsByRubrics } from "@/utils/queries/standard_groups/get-standard-groups-by-rubrics";
import { getStandardsByStandardGroups } from "@/utils/queries/standards/get-standards-by-standardgroups";
import { useQuery } from "@tanstack/react-query";
import { Info, Loader2, TrendingUp } from "lucide-react";
import {
  useCallback,
  useDeferredValue,
  useMemo,
  useRef,
  useState,
} from "react";

export interface RubricHeatmapProps {
  dateStart: Date;
  dateEnd: Date;
  thresholds: {
    danger: number;
    warning: number;
    success: number;
  };
  profileId: string | undefined;
  cohortIds: string[];
  selectedRoles: (typeof profileRole.enumValues)[number][];
  showPractice: boolean;
  showGeneral: boolean;
}

export default function RubricHeatmap({
  dateStart,
  dateEnd,
  thresholds,
  profileId,
  cohortIds,
}: RubricHeatmapProps) {
  const [selectedRubrics, setSelectedRubrics] = useState<Rubric[]>([]);

  // State to track hovered cell for highlighting
  const [hoveredCell, setHoveredCell] = useState<{
    row: number | null;
    col: number | null;
  }>({ row: null, col: null });

  // Fetch data
  const { data: rubrics, isLoading: rubricsLoading } = useQuery({
    queryKey: ["rubrics"],
    queryFn: () => getAllRubrics(),
  });

  // Set default selection to first rubric when rubrics are loaded
  const defaultRubrics = useMemo(() => {
    if (rubrics && rubrics.length > 0 && selectedRubrics.length === 0) {
      return [rubrics[0]!];
    }
    return selectedRubrics;
  }, [rubrics, selectedRubrics]);

  // Filter rubrics based on selection
  const filteredRubrics = useMemo(() => {
    if (!rubrics) return [];
    if (defaultRubrics.length === 0) return rubrics;
    return rubrics.filter((r) => defaultRubrics.some((sr) => sr.id === r.id));
  }, [rubrics, defaultRubrics]);

  const { data: standardGroups, isLoading: standardGroupsLoading } = useQuery({
    queryKey: ["standardGroups", filteredRubrics?.map((r) => r.id) || []],
    queryFn: () =>
      getStandardGroupsByRubrics(filteredRubrics?.map((r) => r.id) || []),
    enabled: !!filteredRubrics && filteredRubrics.length > 0,
  });

  const { data: standards, isLoading: standardsLoading } = useQuery({
    queryKey: ["standards", standardGroups?.map((sg) => sg.id) || []],
    queryFn: () =>
      getStandardsByStandardGroups(standardGroups?.map((sg) => sg.id) || []),
    enabled: !!standardGroups && standardGroups.length > 0,
  });

  const { data: grades, isLoading: gradesLoading } = useQuery({
    queryKey: ["grades", filteredRubrics?.map((r) => r.id) || []],
    queryFn: () =>
      getSimulationChatGradesByRubrics(filteredRubrics?.map((r) => r.id) || []),
    enabled: !!filteredRubrics && filteredRubrics.length > 0,
  });

  const { data: feedbacks, isLoading: feedbacksLoading } = useQuery({
    queryKey: ["feedbacks", grades?.map((g) => g.id) || []],
    queryFn: () =>
      getSimulationChatFeedbacksBySimulationChatGrades(
        grades?.map((g) => g.id) || []
      ),
    enabled: !!grades && grades.length > 0,
  });

  // Fetch cohorts for filtering
  const { data: allCohorts } = useQuery({
    queryKey: ["cohorts"],
    queryFn: () => getAllCohorts(),
  });

  // Fetch chats and attempts for profile filtering
  const { data: profiles } = useQuery({
    queryKey: ["profiles"],
    queryFn: () => getAllProfiles(),
  });

  const { data: attempts } = useQuery({
    queryKey: ["simulationAttempts", profiles?.map((profile) => profile.id)],
    queryFn: () =>
      getSimulationAttemptsByProfiles(profiles!.map((profile) => profile.id)),
    enabled: !!profiles && profiles.length > 0,
  });

  const { data: chats } = useQuery({
    queryKey: ["simulationChats", attempts?.map((attempt) => attempt.id)],
    queryFn: () =>
      getSimulationChatsByAttempts(attempts!.map((attempt) => attempt.id)),
    enabled: !!attempts && attempts.length > 0,
  });

  // Use the utility function to calculate rubric heatmap
  const rubricHeatmapResult = useMemo(() => {
    if (
      !grades ||
      !feedbacks ||
      !standards ||
      !standardGroups ||
      !filteredRubrics ||
      !allCohorts ||
      !profiles ||
      !attempts ||
      !chats
    ) {
      return null;
    }

    return calculateRubricHeatmap(
      grades,
      feedbacks,
      standards,
      standardGroups,
      filteredRubrics,
      chats,
      attempts,
      profiles,
      allCohorts,
      dateStart,
      dateEnd,
      profileId,
      cohortIds,
      defaultRubrics.map((r) => r.id)
    );
  }, [
    grades,
    feedbacks,
    standards,
    standardGroups,
    filteredRubrics,
    allCohorts,
    profiles,
    attempts,
    chats,
    dateStart,
    dateEnd,
    profileId,
    cohortIds,
    defaultRubrics,
  ]);

  // Defer heavy result propagation to avoid blocking interactions/scroll
  const deferredResult = useDeferredValue(rubricHeatmapResult);

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
    if (!deferredResult || !deferredResult.hasData) return "neutral";

    // Calculate average correlation strength across all non-diagonal cells
    let totalCorrelation = 0;
    let correlationCount = 0;

    for (let i = 0; i < deferredResult.matrix.length; i++) {
      for (let j = 0; j < deferredResult.matrix[i]!.length; j++) {
        if (i !== j) {
          // Skip diagonal cells (self-correlation)
          const cell = deferredResult.matrix[i]![j];
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

  // Check if any critical data is still loading
  const isLoading =
    rubricsLoading ||
    standardGroupsLoading ||
    standardsLoading ||
    gradesLoading ||
    feedbacksLoading;

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

  // Show no access message if user doesn't have access to any cohorts
  if (!deferredResult?.hasData) {
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
          <div className="text-center text-muted-foreground text-sm">
            <p>No correlation data available for the selected time period</p>
            <p className="text-xs mt-1">
              Need more training sessions with multiple skill areas to calculate
              correlations
            </p>
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
          {rubrics && rubrics.length > 0 && (
            <RubricPicker
              rubrics={rubrics.map((r) => ({
                id: r.id,
                name: r.name,
                description: r.description,
                points: r.points,
                active: r.active,
              }))}
              placeholder="Filter by rubric..."
              onSelect={setSelectedRubrics}
              selectedRubrics={defaultRubrics}
            />
          )}
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
                    {(deferredResult?.standardGroups || []).map(
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
                  {(deferredResult?.standardGroups || []).map(
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
                        {(deferredResult?.standardGroups || []).map(
                          (colGroup, colIndex) => {
                            const cell =
                              deferredResult?.matrix?.[rowIndex]?.[colIndex];
                            if (!cell) {
                              return (
                                <TableCell key={colIndex} className="p-1" />
                              );
                            }

                            // Disable tooltips for very large matrices to reduce DOM weight
                            const totalCells =
                              (deferredResult?.standardGroups?.length || 0) *
                              (deferredResult?.standardGroups?.length || 0);
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
                                        className="w-20 h-7 rounded-sm flex items-center justify-center text-xs font-mono"
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
                                      <p>p-value: {cell.pValue.toFixed(3)}</p>
                                      <p>Data points: {cell.dataPoints}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                ) : (
                                  <div
                                    className="w-20 h-7 rounded-sm flex items-center justify-center text-xs font-mono"
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
          {deferredResult?.insights && (
            <div className="p-3 bg-muted rounded-lg text-left flex-shrink-0 w-full">
              <p className="text-xs text-muted-foreground">
                {deferredResult.insights}
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
