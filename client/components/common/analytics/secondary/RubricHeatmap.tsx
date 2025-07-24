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
import { getAllRubrics } from "@/utils/queries/rubrics/get-all-rubrics";
import { getSimulationChatFeedbacksBySimulationChatGrades } from "@/utils/queries/simulation_chat_feedbacks/get-simulation-chat-feedbacks-by-simulationchatgrades";
import { getSimulationChatGradesByRubrics } from "@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-rubrics";
import { getStandardGroupsByRubrics } from "@/utils/queries/standard_groups/get-standard-groups-by-rubrics";
import { getStandardsByStandardGroups } from "@/utils/queries/standards/get-standards-by-standardgroups";
import { useQuery } from "@tanstack/react-query";
import { isAfter, isBefore } from "date-fns";
import { Loader2, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";

export interface RubricHeatmapProps {
  dateStart: Date;
  dateEnd: Date;
}

// Calculate Pearson correlation coefficient
function calculateCorrelation(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length === 0) return 0;

  const n = x.length;
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((sum, xi, i) => sum + xi * (y[i] || 0), 0);
  const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
  const sumY2 = y.reduce((sum, yi) => sum + yi * yi, 0);

  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt(
    (n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY)
  );

  return denominator === 0 ? 0 : numerator / denominator;
}

export default function RubricHeatmap({
  dateStart,
  dateEnd,
}: RubricHeatmapProps) {
  const [selectedRubrics, setSelectedRubrics] = useState<Rubric[]>([]);

  // Fetch data
  const { data: rubrics, isLoading: rubricsLoading } = useQuery({
    queryKey: ["rubrics"],
    queryFn: () => getAllRubrics(),
  });

  // Filter rubrics based on selection
  const filteredRubrics = useMemo(() => {
    if (!rubrics) return [];
    if (selectedRubrics.length === 0) return rubrics;
    return rubrics.filter((r) => selectedRubrics.some((sr) => sr.id === r.id));
  }, [rubrics, selectedRubrics]);

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

  // Calculate correlation matrix for standard groups
  const correlationMatrix = useMemo(() => {
    if (
      !grades ||
      !feedbacks ||
      !standards ||
      !standardGroups ||
      !filteredRubrics
    ) {
      return { matrix: [], insights: null };
    }

    if (grades.length === 0) return { matrix: [], insights: null };

    // Filter grades by date range
    const filteredGrades = grades.filter((grade) => {
      const gradeDate = new Date(grade.createdAt);
      return isAfter(gradeDate, dateStart) && isBefore(gradeDate, dateEnd);
    });

    if (filteredGrades.length === 0) return { matrix: [], insights: null };

    // Filter feedbacks to only include those from filtered grades
    const filteredFeedbacks = feedbacks.filter((feedback) =>
      filteredGrades.some(
        (grade) => grade.id === feedback.simulationChatGradeId
      )
    );

    // Get all standard groups that have feedback data
    const standardGroupsWithData = standardGroups.filter((group) =>
      filteredFeedbacks.some((feedback) => {
        const standard = standards.find((s) => s.id === feedback.standardId);
        return standard && standard.standardGroupId === group.id;
      })
    );

    if (standardGroupsWithData.length < 2)
      return { matrix: [], insights: null };

    // Create n x n correlation matrix
    const matrix: Array<
      Array<{
        correlation: number;
        color: string;
        strength: string;
        dataPoints: number;
      }>
    > = [];

    // Initialize matrix with zeros
    for (let i = 0; i < standardGroupsWithData.length; i++) {
      matrix[i] = [];
      for (let j = 0; j < standardGroupsWithData.length; j++) {
        if (matrix[i]) {
          matrix[i]![j] = {
            correlation: 0,
            color: "#e5e7eb",
            strength: "No Data",
            dataPoints: 0,
          };
        }
      }
    }

    // Calculate correlations between all pairs of standard groups
    for (let i = 0; i < standardGroupsWithData.length; i++) {
      for (let j = 0; j < standardGroupsWithData.length; j++) {
        const group1 = standardGroupsWithData[i];
        const group2 = standardGroupsWithData[j];

        if (!group1 || !group2) continue;

        // Get all grades that have feedback for both standard groups
        const gradesWithBothGroups = filteredGrades.filter((grade) => {
          const gradeFeedbacks = filteredFeedbacks.filter(
            (f) => f.simulationChatGradeId === grade.id
          );

          const hasGroup1 = gradeFeedbacks.some((f) => {
            const standard = standards.find((s) => s.id === f.standardId);
            return standard && standard.standardGroupId === group1.id;
          });

          const hasGroup2 = gradeFeedbacks.some((f) => {
            const standard = standards.find((s) => s.id === f.standardId);
            return standard && standard.standardGroupId === group2.id;
          });

          return hasGroup1 && hasGroup2;
        });

        if (gradesWithBothGroups.length < 3) continue; // Need at least 3 data points

        // Extract scores for both standard groups
        const scores1: number[] = [];
        const scores2: number[] = [];

        gradesWithBothGroups.forEach((grade) => {
          // Get average score for group1
          const group1Feedbacks = filteredFeedbacks.filter((f) => {
            const standard = standards.find((s) => s.id === f.standardId);
            return (
              f.simulationChatGradeId === grade.id &&
              standard &&
              standard.standardGroupId === group1.id
            );
          });

          // Get average score for group2
          const group2Feedbacks = filteredFeedbacks.filter((f) => {
            const standard = standards.find((s) => s.id === f.standardId);
            return (
              f.simulationChatGradeId === grade.id &&
              standard &&
              standard.standardGroupId === group2.id
            );
          });

          if (group1Feedbacks.length > 0 && group2Feedbacks.length > 0) {
            // Calculate average scores for each group
            const rubric = filteredRubrics.find((r) => r.id === grade.rubricId);
            const rubricTotalPoints = rubric?.points || 100;

            const avgScore1 =
              group1Feedbacks.reduce((sum, f) => sum + f.total, 0) /
              group1Feedbacks.length;
            const avgScore2 =
              group2Feedbacks.reduce((sum, f) => sum + f.total, 0) /
              group2Feedbacks.length;

            // Normalize to percentage
            scores1.push((avgScore1 / rubricTotalPoints) * 100);
            scores2.push((avgScore2 / rubricTotalPoints) * 100);
          }
        });

        if (scores1.length >= 3) {
          const correlation = calculateCorrelation(scores1, scores2);
          const absCorrelation = Math.abs(correlation);

          // Determine color and strength based on correlation strength
          let color = "#e5e7eb"; // Light gray for weak correlation
          let strength = "Weak";

          if (absCorrelation >= 0.7) {
            color = correlation > 0 ? "#10b981" : "#ef4444"; // Green for positive, red for negative
            strength = "Strong";
          } else if (absCorrelation >= 0.5) {
            color = correlation > 0 ? "#34d399" : "#f87171"; // Lighter green/red
            strength = "Moderate";
          } else if (absCorrelation >= 0.3) {
            color = correlation > 0 ? "#6ee7b7" : "#fca5a5"; // Even lighter
            strength = "Weak";
          }

          if (matrix[i]) {
            matrix[i]![j] = {
              correlation: Math.round(correlation * 100) / 100,
              color,
              strength,
              dataPoints: scores1.length,
            };
          }
        }
      }
    }

    // Generate insights
    let insights = null;
    if (standardGroupsWithData.length > 0) {
      // Find strongest correlations
      let strongestPositive = { correlation: 0, group1: "", group2: "" };
      let strongestNegative = { correlation: 0, group1: "", group2: "" };

      for (let i = 0; i < standardGroupsWithData.length; i++) {
        for (let j = i + 1; j < standardGroupsWithData.length; j++) {
          const cell = matrix[i]?.[j];
          if (cell && cell.correlation > strongestPositive.correlation) {
            const group1 = standardGroupsWithData[i];
            const group2 = standardGroupsWithData[j];
            if (group1 && group2) {
              strongestPositive = {
                correlation: cell.correlation,
                group1: group1.shortName,
                group2: group2.shortName,
              };
            }
          }
          if (cell && cell.correlation < strongestNegative.correlation) {
            const group1 = standardGroupsWithData[i];
            const group2 = standardGroupsWithData[j];
            if (group1 && group2) {
              strongestNegative = {
                correlation: cell.correlation,
                group1: group1.shortName,
                group2: group2.shortName,
              };
            }
          }
        }
      }

      if (strongestPositive.correlation > 0.5) {
        insights = `Strong positive correlation (${strongestPositive.correlation}) between "${strongestPositive.group1}" and "${strongestPositive.group2}". Students who excel in one skill area tend to excel in the other.`;
      } else if (strongestNegative.correlation < -0.5) {
        insights = `Strong negative correlation (${strongestNegative.correlation}) between "${strongestNegative.group1}" and "${strongestNegative.group2}". Consider if these skill areas are competing for attention.`;
      } else {
        insights =
          "Most skill area correlations are moderate. Skill areas appear to be relatively independent.";
      }
    }

    return { matrix, insights, standardGroups: standardGroupsWithData };
  }, [
    grades,
    feedbacks,
    standards,
    standardGroups,
    filteredRubrics,
    dateStart,
    dateEnd,
  ]);

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
      <Card className="w-full h-full flex flex-col">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Skill Area Correlation Matrix
          </CardTitle>
          <CardDescription>
            Statistical correlation between skill areas (standard groups)
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center flex-1">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading correlation data...
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show empty state if no data
  if (!correlationMatrix.matrix.length || !correlationMatrix.standardGroups) {
    return (
      <Card className="w-full h-full flex flex-col">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Skill Area Correlation Matrix
          </CardTitle>
          <CardDescription>
            Statistical correlation between skill areas (standard groups)
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center flex-1">
          <div className="text-center text-muted-foreground">
            <p>No correlation data available for the selected time period</p>
            <p className="text-sm">
              Need more training sessions with multiple skill areas to calculate
              correlations
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full h-full flex flex-col">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Skill Area Correlation Matrix
            </CardTitle>
            <CardDescription>
              Statistical correlation between skill areas (standard groups)
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
              selectedRubrics={selectedRubrics}
              multiSelect={true}
            />
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden">
        <div className="space-y-6">
          {/* Correlation Matrix Table */}
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-32">Skill Areas</TableHead>
                  {correlationMatrix.standardGroups.map((group) => (
                    <TableHead key={group.id} className="text-center w-24">
                      {group.shortName}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {correlationMatrix.standardGroups.map((group, rowIndex) => (
                  <TableRow key={group.id}>
                    <TableCell className="font-medium">
                      {group.shortName}
                    </TableCell>
                    {correlationMatrix.standardGroups.map((_, colIndex) => {
                      const cell =
                        correlationMatrix.matrix[rowIndex]?.[colIndex];
                      const colGroup =
                        correlationMatrix.standardGroups[colIndex];
                      if (!cell || !colGroup)
                        return <TableCell key={colIndex} />;

                      return (
                        <TableCell key={colIndex} className="text-center p-1">
                          <div
                            className="w-full h-12 rounded-md flex items-center justify-center text-xs font-mono relative"
                            style={{ backgroundColor: cell.color }}
                            title={`${group.shortName} ↔ ${colGroup.shortName}: ${cell.correlation} (${cell.dataPoints} data points)`}
                          >
                            <span
                              className={`${
                                cell.correlation > 0
                                  ? "text-green-900"
                                  : cell.correlation < 0
                                    ? "text-red-900"
                                    : "text-gray-600"
                              }`}
                            >
                              {cell.correlation > 0 ? "+" : ""}
                              {cell.correlation}
                            </span>
                          </div>
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span>Strong Positive</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <span>Strong Negative</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-gray-300" />
              <span>Weak/No Correlation</span>
            </div>
          </div>

          {/* Actionable Insights */}
          {correlationMatrix.insights && (
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">
                {correlationMatrix.insights}
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
