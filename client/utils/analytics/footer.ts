import type {
  Cohort,
  Parameter,
  ParameterItem,
  Profile,
  Rubric,
  Scenario,
  Simulation,
  SimulationAttempt,
  SimulationChat,
  SimulationChatGrade,
} from "@/types";
import { format, isAfter, isBefore } from "date-fns";

// Common interfaces for analytics data

export interface ScenarioAttributeElement {
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
  trendData: Array<{
    date: string;
    score: number;
    timestamp: number;
  }>;
  insight: string;
}

export interface ScenarioPerformanceData {
  metricLevel: string;
  avgScore: number;
  scenarioCount: number;
  totalAttempts: number;
  rubricPoints: number;
}

export interface CorrelationData {
  correlation: number;
  pValue: number;
}

// Common filtering function for cohort restrictions
function getAllowedSimulationIds(
  cohorts: Cohort[],
  cohortIds: string[],
  profileId?: string
): string[] | null {
  if (!cohortIds || cohortIds.length === 0) {
    return null; // No cohort filtering, allow all simulations
  }

  // Filter cohorts to only those in cohortIds
  const filteredCohorts = cohorts.filter((cohort) =>
    cohortIds.includes(cohort.id)
  );

  if (filteredCohorts.length === 0) {
    return []; // No matching cohorts, no data allowed
  }

  // If profileId is provided, check if profile belongs to any of the filtered cohorts
  if (profileId) {
    const profileInCohorts = filteredCohorts.some((cohort) =>
      cohort.profileIds.includes(profileId)
    );

    if (!profileInCohorts) {
      return []; // Profile not in any of the specified cohorts, no data allowed
    }
  }

  // Get union of all simulation IDs from matching cohorts
  const simulationIds = new Set<string>();
  filteredCohorts.forEach((cohort) => {
    cohort.simulationIds.forEach((simId) => {
      if (simId !== "RAY") {
        // Exclude placeholder
        simulationIds.add(simId);
      }
    });
  });

  return Array.from(simulationIds);
}

/**
 * Calculate scenario attribute breakdown with performance metrics
 * @param grades - All simulation chat grades
 * @param chats - All simulation chats
 * @param attempts - All simulation attempts
 * @param simulations - All simulations
 * @param scenarios - All scenarios
 * @param rubrics - All rubrics
 * @param profiles - All profiles
 * @param parameterItems - All parameter items
 * @param selectedParameter - Selected parameter for analysis
 * @param dateStart - Start date for filtering
 * @param dateEnd - End date for filtering
 * @param profileId - Optional profile ID to filter by
 * @param cohorts - All cohorts for cohort filtering
 * @param cohortIds - Array of cohort IDs to filter by
 * @returns Array of ScenarioAttributeElement with performance data
 */
export const calculateScenarioAttributeBreakdown = (
  grades: SimulationChatGrade[],
  chats: SimulationChat[],
  attempts: SimulationAttempt[],
  simulations: Simulation[],
  scenarios: Scenario[],
  rubrics: Rubric[],
  profiles: Profile[],
  parameterItems: ParameterItem[],
  selectedParameter: Parameter,
  dateStart: Date,
  dateEnd: Date,
  profileId?: string,
  cohorts: Cohort[] = [],
  cohortIds: string[] = []
): ScenarioAttributeElement[] => {
  const allowedSimulationIds = getAllowedSimulationIds(
    cohorts,
    cohortIds,
    profileId
  );

  // Get parameter items for the selected parameter
  const parameterItemsForSelected = parameterItems
    .filter((item) => item.parameterId === selectedParameter.id)
    .sort((a, b) => a.value.localeCompare(b.value));

  if (parameterItemsForSelected.length === 0) {
    return [];
  }

  // Filter grades by date range, exclude practice simulations, and filter by TA role
  let filteredGrades = grades.filter((grade) => {
    const gradeDate = new Date(grade.createdAt);
    const chat = chats.find((c) => c.id === grade.simulationChatId);
    const attempt = attempts.find((a) => a.id === chat?.attemptId);
    const simulation = simulations.find((s) => s.id === attempt?.simulationId);
    const profile = profiles?.find((p) => p.id === attempt?.profileId);

    // Check date range
    const inDateRange =
      isAfter(gradeDate, dateStart) && isBefore(gradeDate, dateEnd);

    // Exclude practice simulations
    const notPractice = !simulation?.practiceSimulation;

    // Filter by TA role (temporarily relaxed for debugging)
    const isTA = profile?.role === "ta" || true; // Temporarily allow all roles for debugging

    // Filter by profile if provided
    const profileMatch = profileId ? attempt?.profileId === profileId : true;

    return inDateRange && notPractice && isTA && profileMatch;
  });

  // Apply cohort filtering if simulation IDs are restricted
  if (allowedSimulationIds !== null) {
    if (allowedSimulationIds.length === 0) {
      return []; // No data allowed due to cohort restrictions
    }

    filteredGrades = filteredGrades.filter((grade) => {
      const chat = chats.find((c) => c.id === grade.simulationChatId);
      const attempt = attempts.find((a) => a.id === chat?.attemptId);
      return allowedSimulationIds.includes(attempt?.simulationId || "");
    });
  }

  if (filteredGrades.length === 0) {
    return [];
  }

  // Get all scenarios that were attempted in the filtered data
  const attemptedScenarioIds = new Set<string>();
  filteredGrades.forEach((grade) => {
    const chat = chats.find((c) => c.id === grade.simulationChatId);
    if (chat) {
      attemptedScenarioIds.add(chat.scenarioId);
    }
  });

  const attemptedScenarios = scenarios.filter((scenario) =>
    attemptedScenarioIds.has(scenario.id)
  );

  // Calculate total parameter item occurrences for percentage calculation
  let totalParameterOccurrences = 0;
  attemptedScenarios.forEach((scenario) => {
    if (scenario.parameterItemIds) {
      // Count how many of the selected parameter's items are used in this scenario
      const scenarioParameterItems = scenario.parameterItemIds.filter(
        (itemId) =>
          parameterItemsForSelected.some((paramItem) => paramItem.id === itemId)
      );
      totalParameterOccurrences += scenarioParameterItems.length;
    }
  });

  // Generate colors for each attribute
  const colors = [
    "#3b82f6",
    "#ef4444",
    "#10b981",
    "#f59e0b",
    "#8b5cf6",
    "#06b6d4",
    "#84cc16",
    "#f97316",
    "#ec4899",
    "#6366f1",
    "#14b8a6",
    "#f43f5e",
  ];

  // Helper function to format time values
  const formatTimeValue = (timeString: string) => {
    try {
      const time = new Date(`1970-01-01T${timeString}`);
      return time.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    } catch {
      return timeString;
    }
  };

  // Analyze each parameter item
  const elements: ScenarioAttributeElement[] = parameterItemsForSelected.map(
    (paramItem, index) => {
      // Count total occurrences of this parameter item across all scenarios
      let totalOccurrences = 0;
      attemptedScenarios.forEach((scenario) => {
        if (scenario.parameterItemIds?.includes(paramItem.id)) {
          totalOccurrences++;
        }
      });

      const count = totalOccurrences;
      const percentage =
        totalParameterOccurrences > 0
          ? (count / totalParameterOccurrences) * 100
          : 0;

      // Calculate performance metrics for this attribute
      let totalScore = 0;
      let totalCompletion = 0;
      let totalAttempts = 0;
      let gradeCount = 0;

      // Collect grades for trend data
      const attributeGrades: Array<{ score: number; createdAt: string }> = [];

      // Find scenarios that use this parameter item
      const scenariosWithAttribute = attemptedScenarios.filter((scenario) => {
        return scenario.parameterItemIds?.includes(paramItem.id);
      });

      scenariosWithAttribute.forEach((scenario) => {
        const scenarioChats = chats.filter(
          (chat) => chat.scenarioId === scenario.id
        );
        const scenarioGrades = filteredGrades.filter((grade) => {
          const chat = chats.find((c) => c.id === grade.simulationChatId);
          return chat?.scenarioId === scenario.id;
        });

        scenarioGrades.forEach((grade) => {
          // Convert raw score to percentage using rubric points
          const chat = chats.find((c) => c.id === grade.simulationChatId);
          const attempt = attempts.find((a) => a.id === chat?.attemptId);
          const simulation = simulations.find(
            (s) => s.id === attempt?.simulationId
          );
          const rubric = rubrics?.find((r) => r.id === simulation?.rubricId);
          const rubricTotalPoints = rubric?.points || 100;
          const scorePercent = Math.round(
            (grade.score / rubricTotalPoints) * 100
          );

          totalScore += scorePercent;
          gradeCount++;
          attributeGrades.push({
            score: scorePercent,
            createdAt: grade.createdAt,
          });
        });

        scenarioChats.forEach((chat) => {
          if (chat.completed) {
            totalCompletion++;
          }
          totalAttempts++;
        });
      });

      const avgScore = gradeCount > 0 ? totalScore / gradeCount : 0;
      const completionRate =
        totalAttempts > 0 ? (totalCompletion / totalAttempts) * 100 : 0;

      // Calculate trend data for line chart
      const trendData = attributeGrades
        .map((grade) => ({
          date: format(new Date(grade.createdAt), "MMM dd"),
          score: Math.round(grade.score),
          timestamp: new Date(grade.createdAt).getTime(),
        }))
        .sort((a, b) => a.timestamp - b.timestamp);

      // Generate insight for this attribute
      let insight = "";
      if (trendData.length >= 2) {
        const recentScores = trendData.slice(-3);
        const earlierScores = trendData.slice(0, 3);

        if (recentScores.length > 0 && earlierScores.length > 0) {
          const recentAvg =
            recentScores.reduce((sum, item) => sum + item.score, 0) /
            recentScores.length;
          const earlierAvg =
            earlierScores.reduce((sum, item) => sum + item.score, 0) /
            earlierScores.length;
          const improvement = recentAvg - earlierAvg;

          if (improvement > 5) {
            insight = `Performance has improved by ${Math.round(improvement)}% recently. Consider using this ${selectedParameter.name.toLowerCase()} more frequently.`;
          } else if (improvement < -5) {
            insight = `Performance has declined by ${Math.round(Math.abs(improvement))}% recently. Review training approach for this ${selectedParameter.name.toLowerCase()}.`;
          } else {
            insight = `Performance has remained stable. Current average score is ${Math.round(avgScore)}% with ${Math.round(completionRate)}% completion rate.`;
          }
        }
      } else {
        insight = `Limited data available. Current average score is ${Math.round(avgScore)}% with ${Math.round(completionRate)}% completion rate.`;
      }

      // Format display name based on parameter type
      let displayName = paramItem.value;
      if (selectedParameter.name.toLowerCase().includes("time")) {
        displayName = formatTimeValue(paramItem.value);
      }

      return {
        id: paramItem.id,
        name: paramItem.value,
        displayName,
        icon: "📊", // Generic icon since we don't have specific icons for parameters
        color: colors[index % colors.length] || "#3b82f6",
        count,
        percentage: Math.round(percentage * 10) / 10, // Round to 1 decimal place
        avgScore: Math.round(avgScore),
        completionRate: Math.round(completionRate),
        totalAttempts,
        trendData,
        insight,
      };
    }
  );

  // Filter out attributes with no usage and sort by percentage descending
  return elements
    .filter((element) => element.count > 0)
    .sort((a, b) => b.percentage - a.percentage);
};

/**
 * Calculate scenario performance analysis with correlation data
 * @param grades - All simulation chat grades
 * @param chats - All simulation chats
 * @param attempts - All simulation attempts
 * @param simulations - All simulations
 * @param scenarios - All scenarios
 * @param rubrics - All rubrics
 * @param profiles - All profiles
 * @param parameterItems - All parameter items
 * @param selectedParameter - Selected parameter for analysis
 * @param dateStart - Start date for filtering
 * @param dateEnd - End date for filtering
 * @param profileId - Optional profile ID to filter by
 * @param cohorts - All cohorts for cohort filtering
 * @param cohortIds - Array of cohort IDs to filter by
 * @returns Object with performance data and correlation analysis
 */
export const calculateScenarioPerformance = (
  grades: SimulationChatGrade[],
  chats: SimulationChat[],
  attempts: SimulationAttempt[],
  simulations: Simulation[],
  scenarios: Scenario[],
  rubrics: Rubric[],
  profiles: Profile[],
  parameterItems: ParameterItem[],
  selectedParameter: Parameter,
  dateStart: Date,
  dateEnd: Date,
  profileId?: string,
  cohorts: Cohort[] = [],
  cohortIds: string[] = []
): {
  performanceData: ScenarioPerformanceData[];
  correlationData: CorrelationData;
} => {
  const allowedSimulationIds = getAllowedSimulationIds(
    cohorts,
    cohortIds,
    profileId
  );

  // Get parameter items for the selected parameter
  const parameterItemsForSelected = parameterItems
    .filter((item) => item.parameterId === selectedParameter.id)
    .sort((a, b) => parseFloat(a.value) - parseFloat(b.value));

  if (parameterItemsForSelected.length === 0) {
    return {
      performanceData: [],
      correlationData: { correlation: 0, pValue: 1 },
    };
  }

  // Filter data by date range, exclude practice simulations, and filter by TA role
  const filteredGrades = grades.filter((grade) => {
    const gradeDate = new Date(grade.createdAt);
    const chat = chats.find((c) => c.id === grade.simulationChatId);
    const attempt = attempts.find((a) => a.id === chat?.attemptId);
    const simulation = simulations.find((s) => s.id === attempt?.simulationId);
    const profile = profiles?.find((p) => p.id === attempt?.profileId);

    // Check date range
    const inDateRange =
      isAfter(gradeDate, dateStart) && isBefore(gradeDate, dateEnd);

    // Exclude practice simulations
    const notPractice = !simulation?.practiceSimulation;

    // Filter by TA role (temporarily relaxed for debugging)
    const isTA = profile?.role === "ta" || true; // Temporarily allow all roles for debugging

    // Filter by profile if provided
    const profileMatch = profileId ? attempt?.profileId === profileId : true;

    // Apply cohort-based simulation filtering
    const cohortSimulationMatch = allowedSimulationIds
      ? simulation && allowedSimulationIds.includes(simulation.id)
      : true;

    return (
      inDateRange &&
      notPractice &&
      isTA &&
      profileMatch &&
      cohortSimulationMatch
    );
  });

  if (filteredGrades.length === 0) {
    return {
      performanceData: [],
      correlationData: { correlation: 0, pValue: 1 },
    };
  }

  // Group scenarios by metric level and calculate average performance
  const metricGroups: {
    [key: string]: { scores: number[]; count: number; rubricPoints: number };
  } = {};

  scenarios.forEach((scenario) => {
    const scenarioChats = chats.filter(
      (chat) => chat.scenarioId === scenario.id
    );
    const scenarioGrades = filteredGrades.filter((grade) =>
      scenarioChats.some((chat) => chat.id === grade.simulationChatId)
    );

    if (scenarioGrades.length === 0) return;

    // Find the parameter item for this scenario that matches our selected parameter
    const scenarioParameterItem = scenario.parameterItemIds?.find((itemId) => {
      const item = parameterItemsForSelected.find((pi) => pi.id === itemId);
      return item && item.parameterId === selectedParameter?.id;
    });

    if (scenarioParameterItem) {
      const item = parameterItemsForSelected.find(
        (pi) => pi.id === scenarioParameterItem
      );
      const metricValue = item?.value || "";

      if (metricValue) {
        // Calculate percentage scores based on rubric points
        const percentageScores = scenarioGrades.map((grade) => {
          const rubric = rubrics.find((r) => r.id === grade.rubricId);
          if (!rubric || rubric.points === 0) return 0;

          // Calculate percentage score (score out of rubric.points)
          return Math.round((grade.score / rubric.points) * 100);
        });

        const avgScore = Math.round(
          percentageScores.reduce((sum, score) => sum + score, 0) /
            percentageScores.length
        );

        if (!metricGroups[metricValue]) {
          metricGroups[metricValue] = {
            scores: [],
            count: 0,
            rubricPoints: 0,
          };
        }
        const group = metricGroups[metricValue];
        if (group) {
          group.scores.push(avgScore);
          group.count += scenarioChats.length;

          // Store rubric points for reference (use the first one found)
          if (group.rubricPoints === 0) {
            const firstGrade = scenarioGrades[0];
            if (firstGrade) {
              const rubric = rubrics.find((r) => r.id === firstGrade.rubricId);
              group.rubricPoints = rubric?.points || 0;
            }
          }
        }
      }
    }
  });

  // Convert to array format for chart
  const performanceData = Object.entries(metricGroups)
    .map(([metricLevel, data]) => ({
      metricLevel,
      avgScore: Math.round(
        data.scores.reduce((sum, score) => sum + score, 0) / data.scores.length
      ),
      scenarioCount: data.scores.length,
      totalAttempts: data.count,
      rubricPoints: data.rubricPoints,
    }))
    .sort((a, b) => parseFloat(a.metricLevel) - parseFloat(b.metricLevel))
    .filter((item) => item.scenarioCount >= 1); // Show all levels with at least 1 scenario

  // Calculate Pearson correlation coefficient and p-value
  let correlation = 0;
  let pValue = 1;

  if (performanceData.length >= 2) {
    const n = performanceData.length;
    const sumX = performanceData.reduce(
      (sum, item) => sum + parseFloat(item.metricLevel),
      0
    );
    const sumY = performanceData.reduce((sum, item) => sum + item.avgScore, 0);
    const sumXY = performanceData.reduce(
      (sum, item) => sum + parseFloat(item.metricLevel) * item.avgScore,
      0
    );
    const sumX2 = performanceData.reduce(
      (sum, item) => sum + Math.pow(parseFloat(item.metricLevel), 2),
      0
    );
    const sumY2 = performanceData.reduce(
      (sum, item) => sum + item.avgScore * item.avgScore,
      0
    );

    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt(
      (n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY)
    );

    correlation = denominator === 0 ? 0 : numerator / denominator;

    // Calculate p-value using t-test
    const tStat =
      correlation * Math.sqrt((n - 2) / (1 - correlation * correlation));
    pValue = 2 * (1 - Math.abs(tStat) / Math.sqrt(tStat * tStat + n - 2));
  }

  return {
    performanceData,
    correlationData: { correlation, pValue },
  };
};

/**
 * Calculate simulation composition analysis
 * @param grades - All simulation chat grades
 * @param chats - All simulation chats
 * @param attempts - All simulation attempts
 * @param simulations - All simulations
 * @param scenarios - All scenarios
 * @param profiles - All profiles
 * @param parameters - All parameters
 * @param parameterItems - All parameter items
 * @param dateStart - Start date for filtering
 * @param dateEnd - End date for filtering
 * @param profileId - Optional profile ID to filter by
 * @param cohorts - All cohorts for cohort filtering
 * @param cohortIds - Array of cohort IDs to filter by
 * @param config - Configuration for analysis method
 * @returns Object with simulation composition analysis data
 */
export const calculateSimulationComposition = (
  grades: SimulationChatGrade[],
  chats: SimulationChat[],
  attempts: SimulationAttempt[],
  simulations: Simulation[],
  scenarios: Scenario[],
  profiles: Profile[],
  parameters: Parameter[],
  parameterItems: ParameterItem[],
  dateStart: Date,
  dateEnd: Date,
  profileId?: string,
  cohorts: Cohort[] = [],
  cohortIds: string[] = [],
  config: {
    method: "percentile" | "quartile" | "standard_deviation";
    topPercentage: number;
    bottomPercentage: number;
  } = {
    method: "percentile",
    topPercentage: 25,
    bottomPercentage: 25,
  }
): {
  highPerforming: Array<{
    name: string;
    value: number;
    icon: string;
    color: string;
    description: string;
    significance: "high" | "medium" | "low" | "none";
  }>;
  lowPerforming: Array<{
    name: string;
    value: number;
    icon: string;
    color: string;
    description: string;
    significance: "high" | "medium" | "low" | "none";
  }>;
  highPerformingCount: number;
  lowPerformingCount: number;
  highPerformingDetails: Array<{
    id: string;
    title: string;
    avgScore: number;
    completionRate: number;
    totalAttempts: number;
    combinedScore: number;
    timeLimit: number | undefined;
    scenarioCount: number;
    parameterBreakdown: Array<{
      parameterName: string;
      parameterValue: string;
      isNumerical: boolean;
    }>;
  }>;
  lowPerformingDetails: Array<{
    id: string;
    title: string;
    avgScore: number;
    completionRate: number;
    totalAttempts: number;
    combinedScore: number;
    timeLimit: number | undefined;
    scenarioCount: number;
    parameterBreakdown: Array<{
      parameterName: string;
      parameterValue: string;
      isNumerical: boolean;
    }>;
  }>;
} => {
  const allowedSimulationIds = getAllowedSimulationIds(
    cohorts,
    cohortIds,
    profileId
  );

  // Filter grades by date range, exclude practice simulations, and filter by TA role
  const filteredGrades = grades.filter((grade) => {
    const gradeDate = new Date(grade.createdAt);
    const chat = chats.find((c) => c.id === grade.simulationChatId);
    const attempt = attempts.find((a) => a.id === chat?.attemptId);
    const simulation = simulations.find((s) => s.id === attempt?.simulationId);
    const profile = profiles?.find((p) => p.id === attempt?.profileId);

    // Check date range
    const inDateRange =
      isAfter(gradeDate, dateStart) && isBefore(gradeDate, dateEnd);

    // Exclude practice simulations
    const notPractice = !simulation?.practiceSimulation;

    // Filter by TA role (relaxed for better data availability)
    const isTA = profile?.role === "ta" || true; // Temporarily allow all roles

    // Filter by profile if provided
    const profileMatch = profileId ? attempt?.profileId === profileId : true;

    // Apply cohort-based simulation filtering
    const cohortSimulationMatch = allowedSimulationIds
      ? simulation && allowedSimulationIds.includes(simulation.id)
      : true;

    return (
      inDateRange &&
      notPractice &&
      isTA &&
      profileMatch &&
      cohortSimulationMatch
    );
  });

  if (filteredGrades.length === 0) {
    return {
      highPerforming: [],
      lowPerforming: [],
      highPerformingCount: 0,
      lowPerformingCount: 0,
      highPerformingDetails: [],
      lowPerformingDetails: [],
    };
  }

  // Group by simulation and calculate performance
  const simulationPerformance = new Map<
    string,
    {
      simulation: Simulation;
      grades: SimulationChatGrade[];
      chats: SimulationChat[];
      avgScore: number;
      completionRate: number;
      totalAttempts: number;
      timeLimit: number | undefined;
      scenarioCount: number;
      parameterBreakdown: Array<{
        parameterName: string;
        parameterValue: string;
        isNumerical: boolean;
      }>;
    }
  >();

  filteredGrades.forEach((grade) => {
    const chat = chats.find((c) => c.id === grade.simulationChatId);
    if (!chat) return;

    const attempt = attempts.find((a) => a.id === chat.attemptId);
    if (!attempt) return;

    const simulation = simulations.find((s) => s.id === attempt.simulationId);
    if (!simulation) return;

    if (!simulationPerformance.has(simulation.id)) {
      simulationPerformance.set(simulation.id, {
        simulation,
        grades: [],
        chats: [],
        avgScore: 0,
        completionRate: 0,
        totalAttempts: 0,
        timeLimit: simulation.timeLimit ?? undefined,
        scenarioCount: simulation.scenarioIds?.length || 0,
        parameterBreakdown: [],
      });
    }

    const performance = simulationPerformance.get(simulation.id)!;
    performance.grades.push(grade);
    performance.chats.push(chat);
  });

  // Calculate performance metrics and parameter breakdown for each simulation
  simulationPerformance.forEach((performance) => {
    const completedChats = performance.chats.filter((chat) => chat.completed);
    performance.avgScore =
      performance.grades.reduce((sum, grade) => sum + grade.score, 0) /
      performance.grades.length;
    performance.completionRate =
      (completedChats.length / performance.chats.length) * 100;
    performance.totalAttempts = performance.chats.length;

    // Calculate parameter breakdown for this simulation
    const simScenarios = scenarios.filter((s) =>
      performance.simulation.scenarioIds?.includes(s.id)
    );

    // Collect all parameter items used in this simulation's scenarios
    const usedParameterItems = new Map<
      string,
      {
        parameterName: string;
        parameterValue: string;
        isNumerical: boolean;
        count: number;
      }
    >();

    simScenarios.forEach((scenario) => {
      scenario.parameterItemIds?.forEach((paramItemId) => {
        const paramItem = parameterItems.find((pi) => pi.id === paramItemId);
        if (paramItem) {
          const parameter = parameters.find(
            (p) => p.id === paramItem.parameterId
          );
          if (parameter) {
            const key = `${paramItem.parameterId}-${paramItem.id}`;
            if (usedParameterItems.has(key)) {
              usedParameterItems.get(key)!.count++;
            } else {
              usedParameterItems.set(key, {
                parameterName: parameter.name,
                parameterValue: paramItem.value,
                isNumerical: parameter.numerical,
                count: 1,
              });
            }
          }
        }
      });
    });

    // Convert to array and sort by frequency
    performance.parameterBreakdown = Array.from(usedParameterItems.values())
      .sort((a, b) => b.count - a.count)
      .map(({ parameterName, parameterValue, isNumerical }) => ({
        parameterName,
        parameterValue,
        isNumerical,
      }));
  });

  // Calculate relative performance metrics
  const allSimulations = Array.from(simulationPerformance.values());

  if (allSimulations.length === 0) {
    return {
      highPerforming: [],
      lowPerforming: [],
      highPerformingCount: 0,
      lowPerformingCount: 0,
      highPerformingDetails: [],
      lowPerformingDetails: [],
    };
  }

  // Calculate combined performance score (weighted average of score and completion rate)
  const simulationsWithScore = allSimulations.map((sim) => ({
    ...sim,
    combinedScore: sim.avgScore * 0.7 + sim.completionRate * 0.3, // Weight score more heavily
  }));

  // Sort by combined performance score
  simulationsWithScore.sort((a, b) => b.combinedScore - a.combinedScore);

  // Apply statistical method to determine high and low performers
  let highPerformingSims: typeof simulationsWithScore = [];
  let lowPerformingSims: typeof simulationsWithScore = [];

  switch (config.method) {
    case "percentile":
      const topCount = Math.ceil(
        (simulationsWithScore.length * config.topPercentage) / 100
      );
      const bottomCount = Math.ceil(
        (simulationsWithScore.length * config.bottomPercentage) / 100
      );
      highPerformingSims = simulationsWithScore.slice(0, topCount);
      lowPerformingSims = simulationsWithScore.slice(-bottomCount);
      break;

    case "quartile":
      const q1Count = Math.ceil(simulationsWithScore.length * 0.25);
      const q4Count = Math.ceil(simulationsWithScore.length * 0.25);
      highPerformingSims = simulationsWithScore.slice(0, q1Count);
      lowPerformingSims = simulationsWithScore.slice(-q4Count);
      break;

    case "standard_deviation":
      const scores = simulationsWithScore.map((sim) => sim.combinedScore);
      const mean =
        scores.reduce((sum, score) => sum + score, 0) / scores.length;
      const variance =
        scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) /
        scores.length;
      const stdDev = Math.sqrt(variance);

      const upperThreshold = mean + stdDev;
      const lowerThreshold = mean - stdDev;

      highPerformingSims = simulationsWithScore.filter(
        (sim) => sim.combinedScore >= upperThreshold
      );
      lowPerformingSims = simulationsWithScore.filter(
        (sim) => sim.combinedScore <= lowerThreshold
      );
      break;

    default:
      const fallbackTopCount = Math.ceil(
        (simulationsWithScore.length * 25) / 100
      );
      const fallbackBottomCount = Math.ceil(
        (simulationsWithScore.length * 25) / 100
      );
      highPerformingSims = simulationsWithScore.slice(0, fallbackTopCount);
      lowPerformingSims = simulationsWithScore.slice(-fallbackBottomCount);
  }

  // Create detailed simulation lists for dialog
  const highPerformingDetails = highPerformingSims.map((sim) => ({
    id: sim.simulation.id,
    title: sim.simulation.title,
    avgScore: Math.round(sim.avgScore),
    completionRate: Math.round(sim.completionRate),
    totalAttempts: sim.totalAttempts,
    combinedScore: Math.round(sim.combinedScore),
    timeLimit: sim.timeLimit,
    scenarioCount: sim.scenarioCount,
    parameterBreakdown: sim.parameterBreakdown,
  }));

  const lowPerformingDetails = lowPerformingSims.map((sim) => ({
    id: sim.simulation.id,
    title: sim.simulation.title,
    avgScore: Math.round(sim.avgScore),
    completionRate: Math.round(sim.completionRate),
    totalAttempts: sim.totalAttempts,
    combinedScore: Math.round(sim.combinedScore),
    timeLimit: sim.timeLimit,
    scenarioCount: sim.scenarioCount,
    parameterBreakdown: sim.parameterBreakdown,
  }));

  // Generate colors for attributes
  const colors = [
    "#3b82f6",
    "#ef4444",
    "#10b981",
    "#f59e0b",
    "#8b5cf6",
    "#06b6d4",
    "#84cc16",
    "#f97316",
    "#ec4899",
    "#6366f1",
    "#14b8a6",
    "#f43f5e",
  ];

  // Analyze parameter usage patterns
  const parameterUsage = new Map<
    string,
    {
      id: string;
      name: string;
      icon: string;
      color: string;
      highPerforming: number;
      lowPerforming: number;
      description: string;
      difference: number;
      significance: "high" | "medium" | "low" | "none";
      parameterId: string;
      parameterItemId: string;
      value: string;
      isNumerical: boolean;
    }
  >();

  // Helper function to get or create attribute
  const getOrCreateAttribute = (
    parameterId: string,
    parameterItemId: string,
    parameterName: string,
    parameterValue: string,
    isNumerical: boolean
  ) => {
    const key = `${parameterId}-${parameterItemId}`;
    if (!parameterUsage.has(key)) {
      const colorIndex = parameterUsage.size % colors.length;
      parameterUsage.set(key, {
        id: key,
        name: `${parameterName}: ${parameterValue}`,
        icon: isNumerical ? "📊" : "🏷️",
        color: colors[colorIndex] || "#000000",
        highPerforming: 0,
        lowPerforming: 0,
        description: `${parameterName} with value ${parameterValue}`,
        difference: 0,
        significance: "none",
        parameterId,
        parameterItemId,
        value: parameterValue,
        isNumerical,
      });
    }
    return parameterUsage.get(key)!;
  };

  // Analyze high performing simulations
  highPerformingSims.forEach((sim) => {
    sim.parameterBreakdown.forEach((param) => {
      // Find the parameter item for this value
      const paramItem = parameterItems.find(
        (pi) => pi.value === param.parameterValue
      );

      if (paramItem && paramItem.parameterId) {
        const attribute = getOrCreateAttribute(
          paramItem.parameterId,
          paramItem.id,
          param.parameterName,
          param.parameterValue,
          param.isNumerical
        );
        attribute.highPerforming += 1;
      }
    });
  });

  // Analyze low performing simulations
  lowPerformingSims.forEach((sim) => {
    sim.parameterBreakdown.forEach((param) => {
      // Find the parameter item for this value
      const paramItem = parameterItems.find(
        (pi) => pi.value === param.parameterValue
      );

      if (paramItem && paramItem.parameterId) {
        const attribute = getOrCreateAttribute(
          paramItem.parameterId,
          paramItem.id,
          param.parameterName,
          param.parameterValue,
          param.isNumerical
        );
        attribute.lowPerforming += 1;
      }
    });
  });

  // Calculate differences and significance
  parameterUsage.forEach((attr) => {
    attr.difference = attr.highPerforming - attr.lowPerforming;
    const totalHigh = highPerformingSims.length;
    const totalLow = lowPerformingSims.length;

    if (totalHigh > 0 && totalLow > 0) {
      const highRate = attr.highPerforming / totalHigh;
      const lowRate = attr.lowPerforming / totalLow;
      const rateDiff = Math.abs(highRate - lowRate);

      // Lowered thresholds for better data visibility
      if (rateDiff > 0.2) {
        attr.significance = "high";
      } else if (rateDiff > 0.1) {
        attr.significance = "medium";
      } else if (rateDiff > 0.02) {
        attr.significance = "low";
      } else {
        attr.significance = "none";
      }
    }
  });

  // Create separate attribute lists for high and low performing simulations
  const highPerformingAttributes = Array.from(parameterUsage.values())
    .filter((attr) => attr.highPerforming > 0)
    .sort((a, b) => {
      // Sort by significance first, then by high performing value
      if (a.significance !== b.significance) {
        const significanceOrder = { high: 3, medium: 2, low: 1, none: 0 };
        return (
          significanceOrder[b.significance] - significanceOrder[a.significance]
        );
      }
      return b.highPerforming - a.highPerforming;
    })
    .slice(0, 5); // Show top 5 for high performing

  const lowPerformingAttributes = Array.from(parameterUsage.values())
    .filter((attr) => attr.lowPerforming > 0)
    .sort((a, b) => {
      // Sort by significance first, then by low performing value
      if (a.significance !== b.significance) {
        const significanceOrder = { high: 3, medium: 2, low: 1, none: 0 };
        return (
          significanceOrder[b.significance] - significanceOrder[a.significance]
        );
      }
      return b.lowPerforming - a.lowPerforming;
    })
    .slice(0, 5); // Show top 5 for low performing

  // Convert to chart data format using the separate attribute lists
  const highPerformingData = highPerformingAttributes.map((attr) => ({
    name: attr.name,
    value: attr.highPerforming,
    icon: attr.icon,
    color: attr.color,
    description: attr.description,
    significance: attr.significance,
  }));

  const lowPerformingData = lowPerformingAttributes.map((attr) => ({
    name: attr.name,
    value: attr.lowPerforming,
    icon: attr.icon,
    color: attr.color,
    description: attr.description,
    significance: attr.significance,
  }));

  return {
    highPerforming: highPerformingData,
    lowPerforming: lowPerformingData,
    highPerformingCount: highPerformingSims.length,
    lowPerformingCount: lowPerformingSims.length,
    highPerformingDetails,
    lowPerformingDetails,
  };
};

/**
 * Calculate scenario performance within a simulation
 * @param grades - All simulation chat grades
 * @param chats - All simulation chats
 * @param attempts - All simulation attempts
 * @param simulations - All simulations
 * @param scenarios - All scenarios
 * @param profiles - All profiles
 * @param rubrics - All rubrics
 * @param selectedSimulation - Selected simulation for analysis
 * @param dateStart - Start date for filtering
 * @param dateEnd - End date for filtering
 * @param profileId - Optional profile ID to filter by
 * @param cohorts - All cohorts for cohort filtering
 * @param cohortIds - Array of cohort IDs to filter by
 * @param thresholds - Performance thresholds
 * @returns Array of scenario performance data
 */
export const calculateScenarioPerformanceWithinSimulation = (
  grades: SimulationChatGrade[],
  chats: SimulationChat[],
  attempts: SimulationAttempt[],
  scenarios: Scenario[],
  profiles: Profile[],
  rubrics: Rubric[],
  selectedSimulation: Simulation | null,
  dateStart: Date,
  dateEnd: Date,
  thresholds: {
    danger: number;
    warning: number;
    success: number;
  },
  profileId?: string,
  cohorts: Cohort[] = [],
  cohortIds: string[] = []
): Array<{
  scenarioId: string;
  scenarioName: string;
  avgScore: number;
  successRate: number;
  performanceChange: number;
  totalAttempts: number;
  completedAttempts: number;
  color: string;
}> => {
  if (!selectedSimulation) return [];

  const allowedSimulationIds = getAllowedSimulationIds(
    cohorts,
    cohortIds,
    profileId
  );

  // Get rubric for score calculation
  const rubric = rubrics.find((r) => r.id === selectedSimulation.rubricId);
  const rubricTotalPoints = rubric?.points || 100;

  // Filter data by date range, selected simulation, and filter by TA role
  const filteredGrades = grades.filter((grade) => {
    const gradeDate = new Date(grade.createdAt);
    const chat = chats.find((c) => c.id === grade.simulationChatId);
    const attempt = attempts.find((a) => a.id === chat?.attemptId);
    const profile = profiles?.find((p) => p.id === attempt?.profileId);

    // Check date range
    const inDateRange =
      isAfter(gradeDate, dateStart) && isBefore(gradeDate, dateEnd);

    // Check if it's from the selected simulation
    const isSelectedSimulation =
      attempt?.simulationId === selectedSimulation.id;

    // Filter by TA role (relaxed for better data visibility)
    const isTA = profile?.role === "ta" || true; // Temporarily allow all roles

    // Filter by profile if provided
    const profileMatch = profileId ? attempt?.profileId === profileId : true;

    // Apply cohort-based simulation filtering
    const cohortSimulationMatch = allowedSimulationIds
      ? selectedSimulation &&
        allowedSimulationIds.includes(selectedSimulation.id)
      : true;

    return (
      inDateRange &&
      isSelectedSimulation &&
      isTA &&
      profileMatch &&
      cohortSimulationMatch
    );
  });

  if (filteredGrades.length === 0) return [];

  // Get scenarios for the selected simulation
  const simulationScenarios = scenarios.filter((scenario) =>
    selectedSimulation.scenarioIds.includes(scenario.id)
  );

  // Calculate performance for each scenario
  const scenarioData = simulationScenarios
    .map((scenario) => {
      const scenarioChats = chats.filter(
        (chat) => chat.scenarioId === scenario.id
      );
      const scenarioGrades = filteredGrades.filter((grade) =>
        scenarioChats.some((chat) => chat.id === grade.simulationChatId)
      );

      if (scenarioGrades.length === 0) return null;

      const completedChats = scenarioChats.filter((chat) => chat.completed);
      const successRate = Math.round(
        (completedChats.length / scenarioChats.length) * 100
      );

      // Calculate average score as percentage
      const avgScore = Math.round(
        (scenarioGrades.reduce((sum, grade) => sum + grade.score, 0) /
          scenarioGrades.length /
          rubricTotalPoints) *
          100
      );

      // Calculate performance trend (simple comparison with previous period)
      const midPoint = new Date((dateStart.getTime() + dateEnd.getTime()) / 2);
      const recentGrades = scenarioGrades.filter(
        (grade) => new Date(grade.createdAt) >= midPoint
      );
      const olderGrades = scenarioGrades.filter(
        (grade) => new Date(grade.createdAt) < midPoint
      );

      let performanceChange = 0;
      if (recentGrades.length > 0 && olderGrades.length > 0) {
        const recentAvg =
          recentGrades.reduce((sum, grade) => sum + grade.score, 0) /
          recentGrades.length;
        const olderAvg =
          olderGrades.reduce((sum, grade) => sum + grade.score, 0) /
          olderGrades.length;
        performanceChange = Math.round(
          ((recentAvg - olderAvg) / rubricTotalPoints) * 100
        );
      }

      return {
        scenarioId: scenario.id,
        scenarioName: scenario.name,
        avgScore,
        successRate,
        performanceChange,
        totalAttempts: scenarioChats.length,
        completedAttempts: completedChats.length,
        color:
          avgScore >= thresholds.success
            ? "#10b981"
            : avgScore >= thresholds.warning
              ? "#f59e0b"
              : "#ef4444",
      };
    })
    .filter(
      (item): item is NonNullable<typeof item> =>
        item !== null && item.totalAttempts >= 1
    )
    .sort((a, b) => b.avgScore - a.avgScore);

  return scenarioData;
};

/**
 * Get available simulations for performance analysis
 * @param simulations - All simulations
 * @param chats - All simulation chats
 * @param grades - All simulation chat grades
 * @param attempts - All simulation attempts
 * @param profiles - All profiles
 * @param dateStart - Start date for filtering
 * @param dateEnd - End date for filtering
 * @param profileId - Optional profile ID to filter by
 * @param cohorts - All cohorts for cohort filtering
 * @param cohortIds - Array of cohort IDs to filter by
 * @returns Array of available simulations
 */
export const getAvailableSimulations = (
  simulations: Simulation[],
  chats: SimulationChat[],
  grades: SimulationChatGrade[],
  attempts: SimulationAttempt[],
  profiles: Profile[],
  dateStart: Date,
  dateEnd: Date,
  profileId?: string,
  cohorts: Cohort[] = [],
  cohortIds: string[] = []
): Simulation[] => {
  const allowedSimulationIds = getAllowedSimulationIds(
    cohorts,
    cohortIds,
    profileId
  );

  // First, get all non-practice, active simulations
  const activeSimulations = simulations
    .filter((sim) => !sim.practiceSimulation && sim.active)
    .map((sim) => ({
      ...sim,
      id: sim.id,
      title: sim.title,
      description: `Simulation with ${sim.scenarioIds?.length || 0} scenarios`,
      scenarioIds: sim.scenarioIds || [],
      active: sim.active,
      practiceSimulation: sim.practiceSimulation,
      rubricId: sim.rubricId,
    }));

  // Apply cohort-based simulation filtering
  const cohortFilteredSimulations = allowedSimulationIds
    ? activeSimulations.filter((sim) => allowedSimulationIds.includes(sim.id))
    : activeSimulations;

  // Filter out simulations that don't have data in the selected date range
  const simulationsWithData = cohortFilteredSimulations.filter((sim) => {
    // Check if this simulation has any attempts
    const simulationAttempts = attempts.filter(
      (attempt) => attempt.simulationId === sim.id
    );

    if (simulationAttempts.length === 0) {
      return false;
    }

    // Check if any of these attempts have chats
    const simulationChats = chats.filter((chat) =>
      simulationAttempts.some((attempt) => attempt.id === chat.attemptId)
    );

    if (simulationChats.length === 0) {
      return false;
    }

    // Check if any of these chats have grades in the date range
    const simulationGrades = grades.filter((grade) => {
      const gradeDate = new Date(grade.createdAt);
      const chat = simulationChats.find((c) => c.id === grade.simulationChatId);
      if (!chat) return false;

      const attempt = attempts.find((a) => a.id === chat.attemptId);
      const profile = profiles?.find((p) => p.id === attempt?.profileId);

      // Check date range
      const inDateRange =
        isAfter(gradeDate, dateStart) && isBefore(gradeDate, dateEnd);

      // Filter by TA role (relaxed for better data visibility)
      const isTA = profile?.role === "ta" || true; // Temporarily allow all roles

      // Filter by profile if provided
      const profileMatch = profileId ? attempt?.profileId === profileId : true;

      // Apply cohort-based profile filtering (simplified)
      const cohortProfileMatch = true; // Temporarily allow all profiles

      return inDateRange && isTA && profileMatch && cohortProfileMatch;
    });

    // Only include simulations that have at least 1 grade
    return simulationGrades.length >= 1;
  });

  return simulationsWithData;
};

/**
 * Calculate simulation performance metrics with trend data
 * @param grades - All simulation chat grades
 * @param chats - All simulation chats
 * @param attempts - All simulation attempts
 * @param simulations - All simulations
 * @param rubrics - All rubrics
 * @param dateStart - Start date for filtering
 * @param dateEnd - End date for filtering
 * @param profileId - Optional profile ID to filter by
 * @param cohorts - All cohorts for cohort filtering
 * @param cohortIds - Array of cohort IDs to filter by
 * @returns Object with currentValue, trendData, and hasData properties
 */
export const calculateSimulationPerformance = (
  grades: SimulationChatGrade[],
  chats: SimulationChat[],
  attempts: SimulationAttempt[],
  simulations: Simulation[],
  rubrics: Rubric[],
  dateStart: Date,
  dateEnd: Date,
  profileId?: string,
  cohorts: Cohort[] = [],
  cohortIds: string[] = []
): {
  currentValue: number;
  trendData: Array<{
    date: string;
    value: number;
    count: number;
  }>;
  hasData: boolean;
} => {
  const allowedSimulationIds = getAllowedSimulationIds(
    cohorts,
    cohortIds,
    profileId
  );

  // Filter grades by date range, exclude practice simulations, and filter by TA role
  let filteredGrades = grades.filter((grade) => {
    const gradeDate = new Date(grade.createdAt);
    const chat = chats.find((c) => c.id === grade.simulationChatId);
    const attempt = attempts.find((a) => a.id === chat?.attemptId);
    const simulation = simulations.find((s) => s.id === attempt?.simulationId);

    // Check date range
    const inDateRange =
      isAfter(gradeDate, dateStart) && isBefore(gradeDate, dateEnd);

    // Exclude practice simulations
    const notPractice = !simulation?.practiceSimulation;

    // Filter by profile if provided
    const profileMatch = profileId ? attempt?.profileId === profileId : true;

    return inDateRange && notPractice && profileMatch;
  });

  // Apply cohort filtering if simulation IDs are restricted
  if (allowedSimulationIds !== null) {
    if (allowedSimulationIds.length === 0) {
      return {
        currentValue: 0,
        trendData: [],
        hasData: false,
      };
    }

    filteredGrades = filteredGrades.filter((grade) => {
      const chat = chats.find((c) => c.id === grade.simulationChatId);
      const attempt = attempts.find((a) => a.id === chat?.attemptId);
      return allowedSimulationIds.includes(attempt?.simulationId || "");
    });
  }

  if (filteredGrades.length === 0) {
    return {
      currentValue: 0,
      trendData: [],
      hasData: false,
    };
  }

  // Calculate current average performance
  let totalScore = 0;
  let totalRubricPoints = 0;

  filteredGrades.forEach((grade) => {
    const chat = chats.find((c) => c.id === grade.simulationChatId);
    const attempt = attempts.find((a) => a.id === chat?.attemptId);
    const simulation = simulations.find((s) => s.id === attempt?.simulationId);
    const rubric = rubrics?.find((r) => r.id === simulation?.rubricId);

    const rubricPoints = rubric?.points || 100;
    totalScore += grade.score;
    totalRubricPoints += rubricPoints;
  });

  const currentValue =
    totalRubricPoints > 0
      ? Math.round((totalScore / totalRubricPoints) * 100)
      : 0;

  // Calculate trend data by date
  const trendDataMap = new Map<
    string,
    { totalScore: number; totalPoints: number; count: number }
  >();

  filteredGrades.forEach((grade) => {
    const gradeDate = format(new Date(grade.createdAt), "MMM dd");
    const chat = chats.find((c) => c.id === grade.simulationChatId);
    const attempt = attempts.find((a) => a.id === chat?.attemptId);
    const simulation = simulations.find((s) => s.id === attempt?.simulationId);
    const rubric = rubrics?.find((r) => r.id === simulation?.rubricId);

    const rubricPoints = rubric?.points || 100;
    const existing = trendDataMap.get(gradeDate);

    if (existing) {
      existing.totalScore += grade.score;
      existing.totalPoints += rubricPoints;
      existing.count += 1;
    } else {
      trendDataMap.set(gradeDate, {
        totalScore: grade.score,
        totalPoints: rubricPoints,
        count: 1,
      });
    }
  });

  const trendData = Array.from(trendDataMap.entries())
    .map(([date, data]) => ({
      date,
      value: Math.round((data.totalScore / data.totalPoints) * 100),
      count: data.count,
    }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return {
    currentValue,
    trendData,
    hasData: true,
  };
};
