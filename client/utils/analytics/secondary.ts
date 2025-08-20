import type { Rubric, Standard, StandardGroup } from "@/types";
import type { FilteredData } from "@/utils/analytics/filtering";

export interface CohortPerformanceData {
  id: string;
  name: string;
  passRate: number;
  avgPercentageScore: number;
  totalStudents: number;
  passedStudents: number;
  totalAttempts: number;
  passedAttempts: number;
  rubricPoints: number;
  rubricPassPoints: number;
  availableSimulations: number;
  color: string;
}

export interface DailyPerformanceData {
  date: string;
  avgScore: number;
  passRate: number;
  totalAttempts: number;
  passedAttempts: number;
}

export interface CohortPerformanceResult {
  cohortData: CohortPerformanceData[];
  dailyData: DailyPerformanceData[];
  insights: string | null;
  hasData: boolean;
}

export interface SkillPerformanceData {
  metric: string;
  value: number;
  fullMark: number;
  score: number;
  points: number;
}

export interface SkillPerformanceResult {
  radarData: SkillPerformanceData[];
  hasData: boolean;
}

export interface CorrelationMatrixCell {
  correlation: number;
  pValue: number;
  color: string;
  strength: string;
  dataPoints: number;
}

export interface RubricHeatmapResult {
  matrix: CorrelationMatrixCell[][];
  insights: string | null;
  standardGroups: StandardGroup[];
  hasData: boolean;
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

// Calculate p-value for correlation coefficient
function calculatePValue(correlation: number, n: number): number {
  if (n < 3) return 1;

  const tStat =
    correlation * Math.sqrt((n - 2) / (1 - correlation * correlation));

  const pValue = 2 * (1 - Math.abs(tStat) / Math.sqrt(tStat * tStat + n - 2));

  return Math.max(0, Math.min(1, pValue));
}

export const calculateCohortPerformance = (
  filteredData: FilteredData,
  rubrics: Rubric[],
  thresholds: { danger: number; warning: number; success: number },
  selectedSimulationIds: string[] = []
): CohortPerformanceResult => {
  // Filter cohorts to only active ones
  const filteredCohorts = filteredData.cohorts.filter((c) => c.active);

  if (filteredCohorts.length === 0) {
    return {
      cohortData: [],
      dailyData: [],
      insights: null,
      hasData: false,
    };
  }

  // Filter simulations based on selection
  const filteredSimulations =
    selectedSimulationIds.length === 0
      ? filteredData.simulations
      : filteredData.simulations.filter((s) =>
          selectedSimulationIds.includes(s.id)
        );

  // Note: Do not early-return when there are no grades; we still want to
  // return zeroed cohorts so the UI can display cohort rows even without data

  // Calculate pass rates per cohort
  // Note: totalStudents includes ALL profiles in the cohort, not just those with attempts
  const cohortStats = new Map<
    string,
    {
      totalAttempts: number;
      passedAttempts: number;
      totalStudents: Set<string>;
      passedStudents: Set<string>;
      totalScores: number[];
      rubricPoints: number;
      rubricPassPoints: number;
      studentSimulationPasses: Map<string, Set<string>>;
      availableSimulations: Set<string>;
    }
  >();

  // Initialize all filtered cohorts
  filteredCohorts.forEach((cohort) => {
    // Calculate available simulations for this cohort (inner join with filtered simulations)
    // If specific simulations are selected, only count those that are in the cohort
    const availableSimulationIds =
      selectedSimulationIds.length > 0
        ? cohort.simulationIds.filter((id) =>
            selectedSimulationIds.includes(id)
          )
        : cohort.simulationIds;

    // Find the rubric for this cohort based on available simulations
    let cohortRubricPoints = 0;
    let cohortRubricPassPoints = 0;

    // Get the first simulation's rubric from the available simulations for this cohort
    // This handles the case where there are no attempts yet but we still want to show rubric info
    const firstAvailableSimulation = filteredData.simulations.find((s) =>
      availableSimulationIds.includes(s.id)
    );

    if (firstAvailableSimulation) {
      const rubric = rubrics.find(
        (r) => r.id === firstAvailableSimulation.rubricId
      );
      if (rubric) {
        cohortRubricPoints = rubric.points;
        cohortRubricPassPoints = rubric.passPoints;
      }
    }

    // Initialize totalStudents with ALL profiles in this cohort, not just those with attempts
    const totalStudents = new Set<string>();
    cohort.profileIds.forEach((profileId) => {
      // Only add profiles that exist in filteredData.profiles (to respect filtering)
      if (filteredData.profiles.some((p) => p.id === profileId)) {
        totalStudents.add(profileId);
      }
    });

    cohortStats.set(cohort.id, {
      totalAttempts: 0,
      passedAttempts: 0,
      totalStudents,
      passedStudents: new Set(),
      totalScores: [],
      rubricPoints: cohortRubricPoints,
      rubricPassPoints: cohortRubricPassPoints,
      studentSimulationPasses: new Map(),
      availableSimulations: new Set(availableSimulationIds),
    });
  });

  // Aggregate data by cohort
  filteredData.grades.forEach((grade) => {
    const chat = filteredData.chats.find(
      (c) => c.id === grade.simulationChatId
    );
    const attempt = filteredData.attempts.find((a) => a.id === chat?.attemptId);
    const profile = filteredData.profiles?.find(
      (p) => p.id === attempt?.profileId
    );
    const rubric = rubrics?.find((r) => r.id === grade.rubricId);
    const simulation = filteredSimulations.find(
      (s) => s.id === attempt?.simulationId
    );

    if (!profile || !rubric || !simulation) return;

    // Find which cohort this profile belongs to
    const cohort = filteredCohorts.find((c) =>
      c.profileIds.includes(profile.id)
    );

    if (cohort) {
      // Only count simulations that are part of this cohort
      if (!cohort.simulationIds.includes(simulation.id)) {
        return;
      }
      const cohortData = cohortStats.get(cohort.id);
      if (cohortData) {
        cohortData.totalAttempts++;
        // Note: totalStudents is already initialized with all profiles in the cohort
        // Store normalized percentage per grade to avoid divide-by-zero later
        const normalizedPercent = Math.round(
          (grade.score / (rubric.points > 0 ? rubric.points : 100)) * 100
        );
        cohortData.totalScores.push(normalizedPercent);
        // Update rubric points if this is the first grade or if we need to use a different rubric
        // This ensures we use the actual rubric from the grade if it differs from the initial simulation rubric
        if (
          cohortData.rubricPoints === 0 ||
          cohortData.rubricPoints !== rubric.points
        ) {
          cohortData.rubricPoints = rubric.points;
          cohortData.rubricPassPoints = rubric.passPoints;
        }
        // Note: availableSimulations is pre-populated with cohort simulation IDs
        // No need to add simulation.id here as it's already included

        // Check if this attempt passed based on rubric pass points
        const passed = grade.score >= rubric.passPoints;
        if (passed) {
          cohortData.passedAttempts++;

          // Track which simulation this student passed
          if (!cohortData.studentSimulationPasses.has(profile.id)) {
            cohortData.studentSimulationPasses.set(profile.id, new Set());
          }
          cohortData.studentSimulationPasses
            .get(profile.id)!
            .add(simulation.id);
        }
      }
    }
  });

  // Calculate which students have passed all simulations in their cohort
  cohortStats.forEach((cohortData, cohortId) => {
    const cohort = filteredCohorts.find((c) => c.id === cohortId);
    if (!cohort) return;

    // Determine which simulations to check based on selection
    const simulationsToCheck =
      selectedSimulationIds.length > 0
        ? selectedSimulationIds
        : cohort.simulationIds;

    // For each student in this cohort, check if they've passed all relevant simulations
    cohort.profileIds.forEach((profileId: string) => {
      const studentPassedSimulations =
        cohortData.studentSimulationPasses.get(profileId) || new Set();

      // Check if student has passed all relevant simulations
      const hasPassedAll = simulationsToCheck.every((simId: string) =>
        studentPassedSimulations.has(simId)
      );

      if (hasPassedAll) {
        cohortData.passedStudents.add(profileId);
      }
    });
  });

  // Calculate pass rates and create chart data
  const cohortData = Array.from(cohortStats.entries())
    .map(([cohortId, data]) => {
      const cohort = filteredCohorts.find((c) => c.id === cohortId);
      const passRate =
        data.totalStudents.size > 0
          ? Math.round(
              (data.passedStudents.size / data.totalStudents.size) * 100
            )
          : 0;

      // Calculate average percentage score
      const avgPercentageScore =
        data.totalScores.length > 0
          ? Math.round(
              data.totalScores.reduce((sum, pct) => sum + pct, 0) /
                data.totalScores.length
            )
          : 0;

      // Determine color based on pass rate and thresholds
      let color: string;
      if (passRate >= thresholds.success) {
        color = "#10b981"; // Green
      } else if (passRate >= thresholds.warning) {
        color = "#f59e0b"; // Yellow
      } else {
        color = "#ef4444"; // Red
      }

      return {
        id: cohortId,
        name: cohort?.title || "Unknown Cohort",
        passRate,
        avgPercentageScore,
        totalStudents: data.totalStudents.size,
        passedStudents: data.passedStudents.size,
        totalAttempts: data.totalAttempts,
        passedAttempts: data.passedAttempts,
        rubricPoints: data.rubricPoints,
        rubricPassPoints: data.rubricPassPoints,
        availableSimulations: data.availableSimulations.size,
        color,
      };
    })
    // Keep cohorts even if there are zero students/data so the UI can render them
    .filter((cohort) => {
      if (selectedSimulationIds.length > 0) {
        return cohort.availableSimulations > 0;
      }
      return true;
    })
    .sort((a, b) => b.passRate - a.passRate);

  // Calculate daily performance data (simplified - would need selectedCohort parameter for full implementation)
  const dailyData: DailyPerformanceData[] = [];

  // Generate insights
  let insights: string | null = null;
  if (cohortData.length > 0) {
    const avgPassRate =
      cohortData.reduce((sum, cohort) => sum + cohort.passRate, 0) /
      cohortData.length;

    if (avgPassRate < thresholds.warning) {
      insights = `Overall cohort performance is below expectations (${avgPassRate.toFixed(2)}% average pass rate). Consider additional training sessions or one-on-one support.`;
    } else if (avgPassRate >= thresholds.success) {
      insights = `Overall cohort performance is excellent (${avgPassRate.toFixed(2)}% average pass rate). Consider advancing to more challenging scenarios.`;
    } else {
      insights = `Overall cohort performance is adequate (${avgPassRate.toFixed(2)}% average pass rate). Monitor progress and provide targeted feedback.`;
    }
  }

  return {
    cohortData,
    dailyData,
    insights,
    hasData:
      cohortData.length > 0 &&
      cohortData.some((cohort) => cohort.totalStudents > 0),
  };
};

export const calculateSkillPerformance = (
  filteredData: FilteredData,
  standards: Standard[],
  standardGroups: StandardGroup[],
  rubrics: Rubric[],
  selectedRubricIds: string[] = []
): SkillPerformanceResult => {
  // Filter rubrics based on selection
  const filteredRubrics =
    selectedRubricIds.length === 0
      ? rubrics
      : rubrics.filter((r) => selectedRubricIds.includes(r.id));

  if (filteredRubrics.length === 0) {
    return {
      radarData: [],
      hasData: false,
    };
  }

  // Filter feedbacks to only include those from filtered grades
  const filteredFeedbacks = filteredData.feedbacks.filter((feedback) =>
    filteredData.grades.some(
      (grade) => grade.id === feedback.simulationChatGradeId
    )
  );

  // Calculate skill-based scores from feedbacks and standards
  const skillData = standardGroups.reduce(
    (acc, group) => {
      // Find all standards that belong to this standard group
      const groupStandards = standards.filter(
        (s) => s.standardGroupId === group.id
      );

      // Find all feedbacks that correspond to standards in this group
      const groupFeedbacks = filteredFeedbacks.filter((feedback) =>
        groupStandards.some((standard) => standard.id === feedback.standardId)
      );

      if (groupFeedbacks.length > 0) {
        // Group feedbacks by grade (user session) to calculate per-user performance
        const feedbacksByGrade = new Map<string, typeof groupFeedbacks>();

        groupFeedbacks.forEach((feedback) => {
          const gradeId = feedback.simulationChatGradeId;
          if (!feedbacksByGrade.has(gradeId)) {
            feedbacksByGrade.set(gradeId, []);
          }
          feedbacksByGrade.get(gradeId)!.push(feedback);
        });

        // Calculate performance for each user session
        const userPerformances: number[] = [];

        feedbacksByGrade.forEach((userFeedbacks) => {
          // Sum up all feedback totals for this user in this standard group
          const userTotalPoints = userFeedbacks.reduce(
            (sum, feedback) => sum + feedback.total,
            0
          );

          // Calculate user's percentage for this standard group
          const userPercentage =
            group.points > 0 ? (userTotalPoints / group.points) * 100 : 0;

          userPerformances.push(userPercentage);
        });

        // Calculate average performance across all users for this standard group
        const averagePerformance =
          userPerformances.length > 0
            ? Math.round(
                userPerformances.reduce((sum, perf) => sum + perf, 0) /
                  userPerformances.length
              )
            : 0;

        // Calculate average score per user session
        const averageScore =
          userPerformances.length > 0
            ? (Math.round(
                userPerformances.reduce((sum, perf) => sum + perf, 0) /
                  userPerformances.length
              ) /
                100) *
              group.points
            : 0;

        acc[group.shortName || group.name] = {
          percentage: averagePerformance,
          score: averageScore,
          points: group.points,
        };
      } else {
        // No feedback for this standard group, set to 0
        acc[group.shortName || group.name] = {
          percentage: 0,
          score: 0,
          points: group.points,
        };
      }

      return acc;
    },
    {} as Record<string, { percentage: number; score: number; points: number }>
  );

  // Create metrics based on standard groups using shortName
  const radarData: SkillPerformanceData[] = [];

  // Add skill scores based on standard groups
  standardGroups.forEach((group) => {
    const skillKey = group.shortName || group.name;
    const skillInfo = skillData[skillKey];
    if (skillInfo) {
      radarData.push({
        metric: skillKey,
        value: skillInfo.points > 0 ? skillInfo.score / skillInfo.points : 0,
        fullMark: 1,
        score: skillInfo.score,
        points: skillInfo.points,
      });
    }
  });

  return {
    radarData,
    hasData: radarData.length > 0 && radarData.some((skill) => skill.value > 0),
  };
};

export const calculateRubricHeatmap = (
  filteredData: FilteredData,
  standards: Standard[],
  standardGroups: StandardGroup[],
  rubrics: Rubric[],
  selectedRubricIds: string[] = []
): RubricHeatmapResult => {
  // Filter rubrics based on selection
  const filteredRubrics =
    selectedRubricIds.length === 0
      ? rubrics
      : rubrics.filter((r) => selectedRubricIds.includes(r.id));

  if (filteredRubrics.length === 0) {
    return {
      matrix: [],
      insights: null,
      standardGroups: [],
      hasData: false,
    };
  }

  // Filter feedbacks to only include those from filtered grades
  const filteredFeedbacks = filteredData.feedbacks.filter((feedback) =>
    filteredData.grades.some(
      (grade) => grade.id === feedback.simulationChatGradeId
    )
  );

  // Use all standard groups, not just those with data, so users can see the structure
  const standardGroupsToShow = standardGroups.length >= 2 ? standardGroups : [];

  if (standardGroupsToShow.length < 2) {
    return {
      matrix: [],
      insights: null,
      standardGroups: [],
      hasData: false,
    };
  }

  // Get all standard groups that have feedback data (for correlation calculations)
  const standardGroupsWithData = standardGroups.filter((group) =>
    filteredFeedbacks.some((feedback) => {
      const standard = standards.find((s) => s.id === feedback.standardId);
      return standard && standard.standardGroupId === group.id;
    })
  );

  // Create n x n correlation matrix for all standard groups
  const matrix: CorrelationMatrixCell[][] = [];

  // Initialize matrix with zeros for all standard groups
  for (let i = 0; i < standardGroupsToShow.length; i++) {
    matrix[i] = [];
    for (let j = 0; j < standardGroupsToShow.length; j++) {
      if (matrix[i]) {
        matrix[i]![j] = {
          correlation: 0,
          pValue: 1,
          color: "#e5e7eb",
          strength: "No Data",
          dataPoints: 0,
        };
      }
    }
  }

  // Calculate correlations between all pairs of standard groups
  for (let i = 0; i < standardGroupsToShow.length; i++) {
    for (let j = 0; j < standardGroupsToShow.length; j++) {
      const group1 = standardGroupsToShow[i];
      const group2 = standardGroupsToShow[j];

      if (!group1 || !group2) continue;

      // Get all grades that have feedback for both standard groups
      const gradesWithBothGroups = filteredData.grades.filter((grade) => {
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
        const pValue = calculatePValue(correlation, scores1.length);
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
            pValue,
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

    for (let i = 0; i < standardGroupsToShow.length; i++) {
      for (let j = i + 1; j < standardGroupsToShow.length; j++) {
        const cell = matrix[i]?.[j];
        if (cell && cell.correlation > strongestPositive.correlation) {
          const group1 = standardGroupsToShow[i];
          const group2 = standardGroupsToShow[j];
          if (group1 && group2) {
            strongestPositive = {
              correlation: cell.correlation,
              group1: group1.shortName,
              group2: group2.shortName,
            };
          }
        }
        if (cell && cell.correlation < strongestNegative.correlation) {
          const group1 = standardGroupsToShow[i];
          const group2 = standardGroupsToShow[j];
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

  return {
    matrix,
    insights,
    standardGroups: standardGroupsToShow,
    hasData: matrix.length > 0 && standardGroupsToShow.length > 0,
  };
};
