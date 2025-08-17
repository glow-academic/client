import type { Persona, Rubric, Scenario } from "@/types";
import type { FilteredData } from "@/utils/analytics/filtering";
import { format } from "date-fns";

// Common interfaces for primary analytics data
export interface AttemptImprovementDataPoint {
  attempt: string;
  "Average Score": number;
  "Average Time": number;
  "Pass Rate": number;
}

export interface GrowthDataPoint {
  date: string;
  averageScore: number;
  passRate: number;
  completionRate: number;
  firstAttemptPassRate: number;
  messagesPerSession: number;
  personaResponseTimes: number;
  sessionEfficiency: number;
  stagnationRate: number;
  timeSpent: number;
  totalAttempts: number;
  // Legacy fields for backward compatibility
  avgScore: number;
  completionPercentage: number;
  highestScore: number;
}

export interface PersonaPerformanceDataPoint {
  name: string;
  score: number;
  sessions: number;
  color: string;
  trendData: Array<{
    date: string;
    score: number;
    timestamp: number;
  }>;
}

/**
 * Calculate attempt improvement data across multiple attempts
 * @param filteredData - Pre-filtered analytics data
 * @param rubrics - All rubrics for score calculation
 * @param selectedSimulations - Array of selected simulation IDs (optional additional filtering)
 * @returns Array of attempt improvement data points
 */
export const calculateAttemptImprovement = (
  filteredData: FilteredData,
  rubrics: Rubric[],
  selectedSimulations: string[] = []
): AttemptImprovementDataPoint[] => {
  if (!filteredData.grades.length) {
    return [];
  }

  // Filter simulations by selection if provided
  const filteredSimulations =
    selectedSimulations.length > 0
      ? filteredData.simulations.filter((s) =>
          selectedSimulations.includes(s.id)
        )
      : filteredData.simulations;

  // Group attempts by simulation and profile
  const simulationAttempts = new Map<
    string,
    {
      simulationId: string;
      profileId: string;
      attempts: Array<{
        attemptId: string;
        attemptNumber: number;
        score: number;
        timeTaken: number;
        passed: boolean;
        createdAt: Date;
      }>;
    }
  >();

  // Group attempts by simulation and profile
  filteredData.attempts.forEach((attempt) => {
    const chat = filteredData.chats.find((c) => c.attemptId === attempt.id);
    const grade = filteredData.grades.find(
      (g) => g.simulationChatId === chat?.id
    );

    if (!chat || !grade) return;

    const simulation = filteredSimulations.find(
      (s) => s.id === attempt.simulationId
    );
    if (!simulation) return;

    const key = `${attempt.simulationId}-${attempt.profileId || "unknown"}`;

    if (!simulationAttempts.has(key)) {
      simulationAttempts.set(key, {
        simulationId: attempt.simulationId,
        profileId: attempt.profileId || "unknown",
        attempts: [],
      });
    }

    const simulationData = simulationAttempts.get(key);
    if (!simulationData) return;

    // Calculate score percentage
    const rubric = rubrics.find((r) => r.id === simulation.rubricId);
    const rubricTotalPoints = rubric?.points || 100;
    const scorePercent = Math.round((grade.score / rubricTotalPoints) * 100);

    simulationData.attempts.push({
      attemptId: attempt.id,
      attemptNumber: simulationData.attempts.length + 1,
      score: scorePercent,
      timeTaken: grade.timeTaken,
      passed: grade.passed,
      createdAt: new Date(grade.createdAt),
    });
  });

  // Include simulations with at least one attempt
  const allSimulations = Array.from(simulationAttempts.values())
    .filter((sim) => sim.attempts.length > 0)
    .sort((a, b) => {
      const aFirst = a.attempts[0];
      const bFirst = b.attempts[0];
      if (!aFirst || !bFirst) return 0;
      return aFirst.createdAt.getTime() - bFirst.createdAt.getTime();
    });

  if (allSimulations.length === 0) return [];

  // Calculate average metrics by attempt number
  const maxAttempts = Math.min(
    Math.max(...allSimulations.map((sim) => sim.attempts.length)),
    5 // Limit to 5 attempts for clean visualization
  );

  const attemptMetrics = new Map<
    number,
    {
      attemptNumber: number;
      scores: number[];
      times: number[];
      passRates: number[];
      count: number;
    }
  >();

  // Initialize attempt metrics
  for (let i = 1; i <= maxAttempts; i++) {
    attemptMetrics.set(i, {
      attemptNumber: i,
      scores: [],
      times: [],
      passRates: [],
      count: 0,
    });
  }

  // Aggregate data by attempt number
  allSimulations.forEach((sim) => {
    sim.attempts.slice(0, maxAttempts).forEach((attempt) => {
      const metrics = attemptMetrics.get(attempt.attemptNumber);
      if (metrics) {
        metrics.scores.push(attempt.score);
        metrics.times.push(attempt.timeTaken / 60); // Convert to minutes
        metrics.passRates.push(attempt.passed ? 100 : 0);
        metrics.count++;
      }
    });
  });

  // Calculate averages and create chart data
  const chartData = Array.from(attemptMetrics.values())
    .filter((metrics) => metrics.count > 0)
    .map((metrics) => {
      const avgScore = Math.round(
        metrics.scores.reduce((sum, score) => sum + score, 0) /
          metrics.scores.length
      );
      const avgTime = Math.round(
        metrics.times.reduce((sum, time) => sum + time, 0) /
          metrics.times.length
      );
      const avgPassRate = Math.round(
        metrics.passRates.reduce((sum, rate) => sum + rate, 0) /
          metrics.passRates.length
      );

      return {
        attempt: `Attempt ${metrics.attemptNumber}`,
        "Average Score": avgScore,
        "Average Time": avgTime,
        "Pass Rate": avgPassRate,
      };
    });

  return chartData;
};

/**
 * Calculate platform growth data over time
 * @param filteredData - Pre-filtered analytics data
 * @param rubrics - All rubrics for score calculation
 * @returns Array of growth data points
 */
export const calculatePlatformGrowth = (
  filteredData: FilteredData,
  rubrics: Rubric[]
): GrowthDataPoint[] => {
  if (!filteredData.grades.length) {
    return [];
  }

  // Group by date (daily intervals)
  const dailyData = new Map<
    string,
    {
      date: string;
      scores: number[];
      passed: number;
      total: number;
      completed: number;
      timeTaken: number[];
      messages: number[];
      responseTimes: number[];
      attempts: number[];
      firstAttempts: Array<{
        profileId: string;
        simulationId: string;
        attemptId: string;
        createdAt: Date;
        passed: boolean;
      }>;
    }
  >();

  filteredData.grades.forEach((grade) => {
    const gradeDate = new Date(grade.createdAt);
    const dateKey = format(gradeDate, "yyyy-MM-dd");
    const chat = filteredData.chats.find(
      (c) => c.id === grade.simulationChatId
    );

    if (!dailyData.has(dateKey)) {
      dailyData.set(dateKey, {
        date: format(gradeDate, "MMM dd"),
        scores: [],
        passed: 0,
        total: 0,
        completed: 0,
        timeTaken: [],
        messages: [],
        responseTimes: [],
        attempts: [],
        firstAttempts: [],
      });
    }

    const dayData = dailyData.get(dateKey)!;

    // Calculate score percentage
    const attempt = filteredData.attempts.find((a) => a.id === chat?.attemptId);
    const simulation = filteredData.simulations.find(
      (s) => s.id === attempt?.simulationId
    );
    const rubric = rubrics.find((r) => r.id === simulation?.rubricId);
    const rubricTotalPoints = rubric?.points || 100;
    const scorePercent = Math.round((grade.score / rubricTotalPoints) * 100);

    dayData.scores.push(scorePercent);
    dayData.total++;
    dayData.timeTaken.push(grade.timeTaken);

    if (grade.passed) {
      dayData.passed++;
    }

    if (chat?.completed) {
      dayData.completed++;
    }

    // Calculate additional metrics
    // Messages per session (estimated from chat data)
    const messageCount = 0; // TODO: Get actual message count from chat data
    dayData.messages.push(messageCount);

    // Response times (estimated from time taken and message count)
    const avgResponseTime =
      messageCount > 0 ? grade.timeTaken / messageCount / 60 : 0;
    dayData.responseTimes.push(avgResponseTime);

    // Track attempts
    dayData.attempts.push(1);

    // Track first attempts for pass rate calculation
    const isFirstAttempt = !filteredData.attempts.some(
      (a) =>
        a.profileId === attempt?.profileId &&
        a.simulationId === attempt?.simulationId &&
        new Date(a.createdAt) < new Date(attempt.createdAt)
    );
    if (isFirstAttempt) {
      dayData.firstAttempts.push({
        profileId: attempt?.profileId || "",
        simulationId: attempt?.simulationId || "",
        attemptId: attempt?.id || "",
        createdAt: new Date(attempt?.createdAt || ""),
        passed: grade.passed,
      });
    }
  });

  // Convert to array and calculate metrics
  const growthMetrics = Array.from(dailyData.values())
    .map((dayData) => {
      const avgScore =
        dayData.scores.length > 0
          ? Math.round(
              dayData.scores.reduce((sum, score) => sum + score, 0) /
                dayData.scores.length
            )
          : 0;

      const completionPercentage =
        dayData.total > 0
          ? Math.round((dayData.completed / dayData.total) * 100)
          : 0;

      // Calculate first attempt pass rate
      const firstAttemptPassRate =
        dayData.firstAttempts.length > 0
          ? Math.round(
              (dayData.firstAttempts.filter((attempt) => attempt.passed)
                .length /
                dayData.firstAttempts.length) *
                100
            )
          : 0;

      const highestScore =
        dayData.scores.length > 0 ? Math.max(...dayData.scores) : 0;

      const messagesPerSession =
        dayData.messages.length > 0
          ? Math.round(
              dayData.messages.reduce((sum, msg) => sum + msg, 0) /
                dayData.messages.length
            )
          : 0;

      const personaResponseTimes =
        dayData.responseTimes.length > 0
          ? Math.round(
              dayData.responseTimes.reduce((sum, time) => sum + time, 0) /
                dayData.responseTimes.length
            )
          : 0;

      const avgTimeMinutes =
        dayData.timeTaken.length > 0
          ? dayData.timeTaken.reduce((sum, time) => sum + time, 0) /
            dayData.timeTaken.length /
            60
          : 1; // Avoid division by zero

      // Session Efficiency Index: (Average Score %) / (Average Time per Session in minutes)
      const sessionEfficiency =
        avgTimeMinutes > 0
          ? Math.round((avgScore / avgTimeMinutes) * 10) // Scale factor of 10 for better visibility
          : 0;

      // Stagnation Rate (simplified - based on score variance)
      const scoreVariance =
        dayData.scores.length > 1
          ? Math.sqrt(
              dayData.scores.reduce(
                (sum, score) => sum + Math.pow(score - avgScore, 2),
                0
              ) /
                (dayData.scores.length - 1)
            )
          : 0;
      const stagnationRate = Math.round(Math.min(scoreVariance / 10, 100));

      const timeSpent = Math.round(avgTimeMinutes);

      const totalAttempts = dayData.attempts.reduce(
        (sum, attempt) => sum + attempt,
        0
      );

      return {
        date: dayData.date,
        averageScore: avgScore,
        passRate: firstAttemptPassRate,
        completionRate: completionPercentage,
        firstAttemptPassRate,
        messagesPerSession,
        personaResponseTimes,
        sessionEfficiency,
        stagnationRate,
        timeSpent,
        totalAttempts,
        // Legacy fields for backward compatibility
        avgScore,
        completionPercentage,
        highestScore,
      };
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Scale session efficiency to 0-100 range relative to the dataset
  if (growthMetrics.length > 0) {
    const maxEfficiency = Math.max(
      ...growthMetrics.map((m) => m.sessionEfficiency)
    );
    const minEfficiency = Math.min(
      ...growthMetrics.map((m) => m.sessionEfficiency)
    );
    const efficiencyRange = maxEfficiency - minEfficiency;

    if (efficiencyRange > 0) {
      growthMetrics.forEach((metric) => {
        metric.sessionEfficiency = Math.round(
          ((metric.sessionEfficiency - minEfficiency) / efficiencyRange) * 100
        );
      });
    }
  }

  return growthMetrics;
};

/**
 * Calculate persona performance data
 * @param filteredData - Pre-filtered analytics data
 * @param rubrics - All rubrics for score calculation
 * @param personas - All personas
 * @param scenarios - All scenarios
 * @returns Array of persona performance data points
 */
export const calculatePersonaPerformance = (
  filteredData: FilteredData,
  rubrics: Rubric[],
  personas: Persona[],
  scenarios: Scenario[]
): PersonaPerformanceDataPoint[] => {
  if (!personas?.length || !scenarios?.length || !filteredData.grades.length) {
    return [];
  }

  // Group by persona
  const performanceByPersona = personas
    .filter((persona) => persona.name)
    .map((persona) => {
      const personaScenarios = scenarios.filter(
        (s) => s.personaId === persona.id
      );
      const personaChats = filteredData.chats.filter((chat) =>
        personaScenarios.some((scenario) => scenario.id === chat.scenarioId)
      );
      const personaGrades = filteredData.grades.filter((grade) =>
        personaChats.some((chat) => chat.id === grade.simulationChatId)
      );

      // Calculate average score
      let avgScore = 0;
      if (personaGrades.length > 0) {
        const scoreSum = personaGrades.reduce((sum, grade) => {
          const chat = filteredData.chats.find(
            (c) => c.id === grade.simulationChatId
          );
          const attempt = filteredData.attempts.find(
            (a) => a.id === chat?.attemptId
          );
          const simulation = filteredData.simulations.find(
            (s) => s.id === attempt?.simulationId
          );
          const rubric = rubrics.find((r) => r.id === simulation?.rubricId);
          const rubricTotalPoints = rubric?.points || 100;
          const scorePercent = Math.round(
            (grade.score / rubricTotalPoints) * 100
          );
          return sum + scorePercent;
        }, 0);
        avgScore = Math.round(scoreSum / personaGrades.length);
      }

      // Calculate trend data for line chart
      const trendData = personaGrades
        .map((grade) => {
          const chat = filteredData.chats.find(
            (c) => c.id === grade.simulationChatId
          );
          const attempt = filteredData.attempts.find(
            (a) => a.id === chat?.attemptId
          );
          const simulation = filteredData.simulations.find(
            (s) => s.id === attempt?.simulationId
          );
          const rubric = rubrics.find((r) => r.id === simulation?.rubricId);
          const rubricTotalPoints = rubric?.points || 100;
          const scorePercent = Math.round(
            (grade.score / rubricTotalPoints) * 100
          );

          return {
            date: format(new Date(grade.createdAt), "MMM dd"),
            score: scorePercent,
            timestamp: new Date(grade.createdAt).getTime(),
          };
        })
        .sort((a, b) => a.timestamp - b.timestamp);

      return {
        name: persona.name,
        score: avgScore,
        sessions: personaGrades.length,
        color: persona.color || "#999999",
        trendData,
      };
    })
    .filter((persona) => persona.sessions > 0) // Only show personas with sessions
    .sort((a, b) => b.score - a.score); // Sort by score descending

  return performanceByPersona;
};
