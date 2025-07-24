/**
 * RubricHeatmap.tsx
 * This component displays the rubric heatmap for the personas.
 * @AshokSaravanan222 & @siladiea
 * 07/23/2025
 */
"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getAllRubrics } from "@/utils/queries/rubrics/get-all-rubrics";
import { getSimulationChatFeedbacksBySimulationChatGrades } from "@/utils/queries/simulation_chat_feedbacks/get-simulation-chat-feedbacks-by-simulationchatgrades";
import { getSimulationChatGradesByRubrics } from "@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-rubrics";
import { getStandardGroupsByRubrics } from "@/utils/queries/standard_groups/get-standard-groups-by-rubrics";
import { getStandardsByStandardGroups } from "@/utils/queries/standards/get-standards-by-standardgroups";
import { useQuery } from "@tanstack/react-query";
import { isAfter, isBefore } from "date-fns";
import { Loader2, TrendingUp } from "lucide-react";
import { useMemo } from "react";

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
  // Fetch data
  const { data: rubrics, isLoading: rubricsLoading } = useQuery({
    queryKey: ["rubrics"],
    queryFn: () => getAllRubrics(),
  });

  const { data: standardGroups, isLoading: standardGroupsLoading } = useQuery({
    queryKey: ["standardGroups", rubrics?.map((r) => r.id) || []],
    queryFn: () => getStandardGroupsByRubrics(rubrics?.map((r) => r.id) || []),
    enabled: !!rubrics && rubrics.length > 0,
  });

  const { data: standards, isLoading: standardsLoading } = useQuery({
    queryKey: ["standards", standardGroups?.map((sg) => sg.id) || []],
    queryFn: () =>
      getStandardsByStandardGroups(standardGroups?.map((sg) => sg.id) || []),
    enabled: !!standardGroups && standardGroups.length > 0,
  });

  const { data: grades, isLoading: gradesLoading } = useQuery({
    queryKey: ["grades", rubrics?.map((r) => r.id) || []],
    queryFn: () =>
      getSimulationChatGradesByRubrics(rubrics?.map((r) => r.id) || []),
    enabled: !!rubrics && rubrics.length > 0,
  });

  const { data: feedbacks, isLoading: feedbacksLoading } = useQuery({
    queryKey: ["feedbacks", grades?.map((g) => g.id) || []],
    queryFn: () =>
      getSimulationChatFeedbacksBySimulationChatGrades(
        grades?.map((g) => g.id) || []
      ),
    enabled: !!grades && grades.length > 0,
  });

  // Calculate correlation matrix
  const correlationMatrix = useMemo(() => {
    if (!grades || !feedbacks || !standards || !standardGroups || !rubrics) {
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

    // Get all standards that have feedback data
    const standardsWithData = standards.filter((standard) =>
      filteredFeedbacks.some((feedback) => feedback.standardId === standard.id)
    );

    if (standardsWithData.length < 2) return { matrix: [], insights: null };

    // Create correlation matrix
    const matrix: Array<{
      standard1: string;
      standard2: string;
      correlation: number;
      color: string;
    }> = [];

    // Calculate correlations between all pairs of standards
    for (let i = 0; i < standardsWithData.length; i++) {
      for (let j = i + 1; j < standardsWithData.length; j++) {
        const standard1 = standardsWithData[i];
        const standard2 = standardsWithData[j];

        if (!standard1 || !standard2) continue;

        // Get all grades that have feedback for both standards
        const gradesWithBothStandards = filteredGrades.filter((grade) => {
          const gradeFeedbacks = filteredFeedbacks.filter(
            (f) => f.simulationChatGradeId === grade.id
          );
          return (
            gradeFeedbacks.some((f) => f.standardId === standard1.id) &&
            gradeFeedbacks.some((f) => f.standardId === standard2.id)
          );
        });

        if (gradesWithBothStandards.length < 3) continue; // Need at least 3 data points

        // Extract scores for both standards
        const scores1: number[] = [];
        const scores2: number[] = [];

        gradesWithBothStandards.forEach((grade) => {
          const feedback1 = filteredFeedbacks.find(
            (f) =>
              f.simulationChatGradeId === grade.id &&
              f.standardId === standard1.id
          );
          const feedback2 = filteredFeedbacks.find(
            (f) =>
              f.simulationChatGradeId === grade.id &&
              f.standardId === standard2.id
          );

          if (feedback1 && feedback2) {
            // Normalize scores to percentage
            const rubric = rubrics.find((r) => r.id === grade.rubricId);
            const rubricTotalPoints = rubric?.points || 100;
            scores1.push((feedback1.total / rubricTotalPoints) * 100);
            scores2.push((feedback2.total / rubricTotalPoints) * 100);
          }
        });

        if (scores1.length >= 3) {
          const correlation = calculateCorrelation(scores1, scores2);
          const absCorrelation = Math.abs(correlation);

          // Determine color based on correlation strength
          let color = "#e5e7eb"; // Light gray for weak correlation
          if (absCorrelation >= 0.7) {
            color = correlation > 0 ? "#10b981" : "#ef4444"; // Green for positive, red for negative
          } else if (absCorrelation >= 0.5) {
            color = correlation > 0 ? "#34d399" : "#f87171"; // Lighter green/red
          } else if (absCorrelation >= 0.3) {
            color = correlation > 0 ? "#6ee7b7" : "#fca5a5"; // Even lighter
          }

          matrix.push({
            standard1: standard1.name,
            standard2: standard2.name,
            correlation: Math.round(correlation * 100) / 100,
            color,
          });
        }
      }
    }

    // Sort by absolute correlation strength
    matrix.sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation));

    // Generate insights
    let insights = null;
    if (matrix.length > 0) {
      const strongestPositive = matrix.find((m) => m.correlation > 0.5);
      const strongestNegative = matrix.find((m) => m.correlation < -0.5);

      if (strongestPositive) {
        insights = `Strong positive correlation (${strongestPositive.correlation}) between "${strongestPositive.standard1}" and "${strongestPositive.standard2}". Students who excel in one tend to excel in the other.`;
      } else if (strongestNegative) {
        insights = `Strong negative correlation (${strongestNegative.correlation}) between "${strongestNegative.standard1}" and "${strongestNegative.standard2}". Consider if these skills are competing for attention.`;
      } else {
        insights =
          "Most skill correlations are moderate. Skills appear to be relatively independent.";
      }
    }

    return { matrix, insights };
  }, [
    grades,
    feedbacks,
    standards,
    standardGroups,
    rubrics,
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
            Rubric Correlation Matrix
          </CardTitle>
          <CardDescription>
            Statistical correlation between rubric standards
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
  if (!correlationMatrix.matrix.length) {
    return (
      <Card className="w-full h-full flex flex-col">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Rubric Correlation Matrix
          </CardTitle>
          <CardDescription>
            Statistical correlation between rubric standards
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center flex-1">
          <div className="text-center text-muted-foreground">
            <p>No correlation data available for the selected time period</p>
            <p className="text-sm">
              Need more training sessions with multiple standards to calculate
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
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Rubric Correlation Matrix
        </CardTitle>
        <CardDescription>
          Statistical correlation between rubric standards
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden">
        <div className="space-y-6">
          {/* Correlation Matrix */}
          <div className="grid gap-2">
            {correlationMatrix.matrix.slice(0, 10).map((item, index) => (
              <div
                key={index}
                className="p-3 border rounded-lg"
                style={{ borderLeftColor: item.color, borderLeftWidth: "4px" }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="font-medium text-sm">
                      {item.standard1} ↔ {item.standard2}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Correlation: {item.correlation}
                    </p>
                  </div>
                  <div
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                </div>
              </div>
            ))}
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
