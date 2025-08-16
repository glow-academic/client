/**
 * Reports.tsx
 * Used to display the reports for the analytics page in a dense table format.
 * @AshokSaravanan222 & @siladiea
 * 06/07/2025
 */
"use client";
import { useRouter } from "next/navigation";
import { useMemo } from "react";

import { useFilteredAnalyticsData } from "@/hooks/use-filtered-analytics-data";
import {
  TAPerformanceData,
  useReportColumns,
} from "@/hooks/use-report-columns";
import {
  calculateAverageScore,
  calculateCompletionPercentage,
  calculateFirstAttemptPassRate,
  calculateHighestScore,
  calculateMessagesPerSession,
  calculatePersonaResponseTimes,
  calculateSessionEfficiency,
  calculateStagnationRate,
  calculateTimeSpent,
  calculateTotalAttempts,
} from "@/utils/analytics/header";
import { ReportsDataTable } from "./ReportsDataTable";

export default function Reports() {
  const router = useRouter();
  const {
    data: filteredData,
    isLoading,
    rubrics,
    messages,
  } = useFilteredAnalyticsData();

  const handleViewReport = (profileId: string) => {
    router.push(`/analytics/reports/p/${profileId}`);
  };

  const { columns, personaOptions, scenarioOptions, simulationOptions } =
    useReportColumns({ showExport: true, onViewReport: handleViewReport });

  // Build the TA rows from the pre-filtered datasets using header computations
  const taPerformanceData = useMemo((): TAPerformanceData[] => {
    if (!filteredData || !rubrics) return [];

    const {
      attempts,
      chats,
      grades,
      simulations,
      scenarios,
      profiles,
      cohorts,
    } = filteredData;

    // Non-default profiles only
    const tas = profiles.filter((p) => !p.defaultProfile);

    // Calculate cohort performance averages (using rubric-normalized percent)
    const cohortPerformance = cohorts.reduce(
      (acc, cohort) => {
        const cohortMemberIds = new Set(cohort.profileIds);
        const cohortGrades = grades.filter((g) => {
          const chat = chats.find((c) => c.id === g.simulationChatId);
          const attempt = attempts.find((a) => a.id === chat?.attemptId);
          return attempt && cohortMemberIds.has(attempt.profileId || "");
        });

        let cohortAvgScore = 0;
        if (cohortGrades.length > 0) {
          const cohortScoreSum = cohortGrades.reduce((sum, grade) => {
            const chat = chats.find((c) => c.id === grade.simulationChatId);
            const attempt = attempts.find((a) => a.id === chat?.attemptId);
            const simulation = simulations.find(
              (s) => s.id === attempt?.simulationId
            );
            const rubric = rubrics.find((r) => r.id === simulation?.rubricId);
            const rubricTotalPoints = rubric?.points || 100;
            const scorePercent = Math.round(
              (grade.score / rubricTotalPoints) * 100
            );
            return sum + scorePercent;
          }, 0);
          cohortAvgScore = Math.round(cohortScoreSum / cohortGrades.length);
        }

        acc[cohort.id] = {
          avgScore: cohortAvgScore,
          memberCount: cohortMemberIds.size,
        };
        return acc;
      },
      {} as Record<string, { avgScore: number; memberCount: number }>
    );

    // Build each TA row using header computations against filteredData
    const taPerformance = tas.map((user): TAPerformanceData => {
      const filteredForUser = {
        ...filteredData,
        attempts: filteredData.attempts.filter((a) => a.profileId === user.id),
        chats: filteredData.chats.filter((c) =>
          filteredData.attempts
            .filter((a) => a.profileId === user.id)
            .some((a) => a.id === c.attemptId)
        ),
        grades: filteredData.grades.filter((g) =>
          filteredData.chats
            .filter((c) =>
              filteredData.attempts
                .filter((a) => a.profileId === user.id)
                .some((a) => a.id === c.attemptId)
            )
            .some((c) => c.id === g.simulationChatId)
        ),
      } as typeof filteredData;

      // 1. Average Score
      const averageScore = calculateAverageScore(
        filteredForUser,
        rubrics
      ).currentValue;

      // 2. Completion Percentage
      const completionPercentage =
        calculateCompletionPercentage(filteredForUser).currentValue;

      // 3. First Attempt Pass Rate
      const firstAttemptPassRate =
        calculateFirstAttemptPassRate(filteredForUser).currentValue;

      // 4. Highest Score
      const highestScore = calculateHighestScore(
        filteredForUser,
        rubrics
      ).currentValue;

      // 5. Messages Per Session
      const messagesPerSession = calculateMessagesPerSession(
        messages || [],
        filteredForUser
      ).currentValue;

      // 6. Persona Response Times (seconds -> we show minutes in UI)
      const personaResponseSeconds = calculatePersonaResponseTimes(
        messages || [],
        filteredForUser
      ).currentValue;
      const personaResponseTimes = Math.round(personaResponseSeconds / 60);

      // 7. Session Efficiency
      const sessionEfficiency = calculateSessionEfficiency(
        filteredForUser,
        rubrics
      ).currentValue;

      // 8. Stagnation Rate
      const stagnationRate = calculateStagnationRate(
        filteredForUser,
        rubrics
      ).currentValue;

      // 9. Time Spent (seconds -> minutes)
      const timeSpentSeconds = calculateTimeSpent(filteredForUser).currentValue;
      const timeSpent = Math.round(timeSpentSeconds / 60);

      // 10. Total Attempts
      const totalAttempts =
        calculateTotalAttempts(filteredForUser).currentValue;

      // Calculate risk assessment based on all 10 metrics
      const thresholds = {
        averageScore: { danger: 70, warning: 80, success: 85 },
        completionPercentage: { danger: 70, warning: 80, success: 85 },
        firstAttemptPassRate: { danger: 70, warning: 80, success: 85 },
        highestScore: { danger: 80, warning: 85, success: 90 },
        messagesPerSession: { danger: 5, warning: 8, success: 12 },
        personaResponseTimes: { danger: 10, warning: 5, success: 3 }, // Lower is better
        sessionEfficiency: { danger: 70, warning: 80, success: 85 },
        stagnationRate: { danger: 30, warning: 20, success: 15 }, // Lower is better
        timeSpent: { danger: 120, warning: 90, success: 60 }, // Lower is better
        totalAttempts: { danger: 2, warning: 5, success: 8 }, // Higher is better
      };

      const riskAssessment = {
        averageScore:
          averageScore < thresholds.averageScore.danger
            ? "danger"
            : averageScore < thresholds.averageScore.warning
              ? "warning"
              : "good",
        completionPercentage:
          completionPercentage < thresholds.completionPercentage.danger
            ? "danger"
            : completionPercentage < thresholds.completionPercentage.warning
              ? "warning"
              : "good",
        firstAttemptPassRate:
          firstAttemptPassRate < thresholds.firstAttemptPassRate.danger
            ? "danger"
            : firstAttemptPassRate < thresholds.firstAttemptPassRate.warning
              ? "warning"
              : "good",
        highestScore:
          highestScore < thresholds.highestScore.danger
            ? "danger"
            : highestScore < thresholds.highestScore.warning
              ? "warning"
              : "good",
        messagesPerSession:
          messagesPerSession < thresholds.messagesPerSession.danger
            ? "danger"
            : messagesPerSession < thresholds.messagesPerSession.warning
              ? "warning"
              : "good",
        personaResponseTimes:
          personaResponseTimes > thresholds.personaResponseTimes.danger
            ? "danger"
            : personaResponseTimes > thresholds.personaResponseTimes.warning
              ? "warning"
              : "good",
        sessionEfficiency:
          sessionEfficiency < thresholds.sessionEfficiency.danger
            ? "danger"
            : sessionEfficiency < thresholds.sessionEfficiency.warning
              ? "warning"
              : "good",
        stagnationRate:
          stagnationRate > thresholds.stagnationRate.danger
            ? "danger"
            : stagnationRate > thresholds.stagnationRate.warning
              ? "warning"
              : "good",
        timeSpent:
          timeSpent > thresholds.timeSpent.danger
            ? "danger"
            : timeSpent > thresholds.timeSpent.warning
              ? "warning"
              : "good",
        totalAttempts:
          totalAttempts < thresholds.totalAttempts.danger
            ? "danger"
            : totalAttempts < thresholds.totalAttempts.warning
              ? "warning"
              : "good",
      };

      const riskCounts = {
        dangerCount: Object.values(riskAssessment).filter((r) => r === "danger")
          .length,
        warningCount: Object.values(riskAssessment).filter(
          (r) => r === "warning"
        ).length,
        goodCount: Object.values(riskAssessment).filter((r) => r === "good")
          .length,
      };

      // Determine overall risk level
      let riskLevel: "good" | "warning" | "danger" = "good";
      if (riskCounts.dangerCount >= 5) {
        riskLevel = "danger";
      } else if (riskCounts.dangerCount >= 2 || riskCounts.warningCount >= 4) {
        riskLevel = "warning";
      }

      // Legacy calculations for compatibility
      const userAttempts = filteredForUser.attempts;
      const userChats = filteredForUser.chats;
      const userGrades = filteredForUser.grades;
      const completedSessions = userChats.filter(
        (chat) => chat.completed
      ).length;
      const totalSessions = userChats.length;

      // Skill breakdown omitted in refactor scope (requires standards/feedbacks not in filteredData)
      const skillBreakdown: Array<{
        skill: string;
        score: number;
        feedbackCount: number;
      }> = [];
      const weakestSkill = skillBreakdown[0] || {
        skill: "Unknown",
        score: 100,
        feedbackCount: 0,
      };
      const strongestSkill = skillBreakdown[0] || {
        skill: "Unknown",
        score: 0,
        feedbackCount: 0,
      };

      // Find weakest and strongest skills

      // Calculate average time taken
      const avgTimeMinutes =
        userGrades.length > 0
          ? Math.round(
              userGrades.reduce((sum, g) => sum + g.timeTaken, 0) /
                userGrades.length /
                60
            )
          : 0;

      // Calculate pass rate
      const passRate =
        userGrades.length > 0
          ? Math.round(
              (userGrades.filter((g) => g.passed).length / userGrades.length) *
                100
            )
          : 0;

      // Determine if struggling (no sessions OR low performance)
      const isStruggling =
        totalSessions === 0 || (averageScore < 70 && totalSessions > 0);

      // Calculate trend (last 3 vs first 3 sessions) using rubric-based scores
      const sortedGrades = userGrades.sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
      let trend: "improving" | "declining" | "stable" = "stable";
      if (sortedGrades.length >= 3) {
        const firstThree = sortedGrades.slice(0, 3);
        const lastThree = sortedGrades.slice(-3);

        // Calculate first three average using rubric points
        const firstAvg =
          firstThree.reduce((sum, grade) => {
            const chat = chats.find((c) => c.id === grade.simulationChatId);
            const attempt = userAttempts.find((a) => a.id === chat?.attemptId);
            const simulation = simulations.find(
              (s) => s.id === attempt?.simulationId
            );
            const rubric = rubrics.find((r) => r.id === simulation?.rubricId);
            const rubricTotalPoints = rubric?.points || 100;
            const scorePercent = Math.round(
              (grade.score / rubricTotalPoints) * 100
            );
            return sum + scorePercent;
          }, 0) / firstThree.length;

        // Calculate last three average using rubric points
        const lastAvg =
          lastThree.reduce((sum, grade) => {
            const chat = chats.find((c) => c.id === grade.simulationChatId);
            const attempt = userAttempts.find((a) => a.id === chat?.attemptId);
            const simulation = simulations.find(
              (s) => s.id === attempt?.simulationId
            );
            const rubric = rubrics.find((r) => r.id === simulation?.rubricId);
            const rubricTotalPoints = rubric?.points || 100;
            const scorePercent = Math.round(
              (grade.score / rubricTotalPoints) * 100
            );
            return sum + scorePercent;
          }, 0) / lastThree.length;

        if (lastAvg > firstAvg + 5) trend = "improving";
        else if (lastAvg < firstAvg - 5) trend = "declining";
      }

      // Last Activity
      const lastActivity =
        userChats.length > 0
          ? new Date(
              Math.max(
                ...userChats.map((chat) =>
                  new Date(chat.completedAt || chat.updatedAt).getTime()
                )
              )
            )
          : null;

      // Scenarios Completed
      const uniqueScenarios = new Set(userChats.map((chat) => chat.scenarioId));
      const scenariosCompleted = uniqueScenarios.size;

      // Cohorts this user belongs to
      const userCohorts = cohorts.filter(
        (cohort) =>
          user.role === "admin" ||
          user.role === "superadmin" ||
          cohort.profileIds.includes(user.id)
      );
      const activeCohorts = userCohorts.filter((cohort) => cohort.active);

      // Cohort Performance Comparison
      const cohortComparison = userCohorts.map((cohort) => {
        const cohortAvg = cohortPerformance[cohort.id]?.avgScore || 0;
        const difference = averageScore - cohortAvg;
        return {
          cohortId: cohort.id,
          cohortName: cohort.title,
          cohortAvg,
          difference,
          rank: 0, // Will calculate below
        };
      });

      // Calculate rank within each cohort using rubric-based scores
      cohortComparison.forEach((comparison) => {
        const cohortTAs = tas.filter((ta) =>
          cohorts
            .find((c) => c.id === comparison.cohortId)
            ?.profileIds.includes(ta.id)
        );
        const cohortScores = cohortTAs
          .map((ta) => {
            const taGrades = grades.filter((grade) => {
              const chat = chats.find((c) => c.id === grade.simulationChatId);
              const attempt = attempts.find((a) => a.id === chat?.attemptId);
              return attempt && attempt.profileId === ta.id;
            });

            if (taGrades.length === 0) return 0;

            const taScoreSum = taGrades.reduce((sum, grade) => {
              const chat = chats.find((c) => c.id === grade.simulationChatId);
              const attempt = attempts.find((a) => a.id === chat?.attemptId);
              const simulation = simulations.find(
                (s) => s.id === attempt?.simulationId
              );
              const rubric = rubrics.find((r) => r.id === simulation?.rubricId);
              const rubricTotalPoints = rubric?.points || 100;
              const scorePercent = Math.round(
                (grade.score / rubricTotalPoints) * 100
              );
              return sum + scorePercent;
            }, 0);

            return Math.round(taScoreSum / taGrades.length);
          })
          .sort((a, b) => b - a);

        comparison.rank = cohortScores.indexOf(averageScore) + 1;
      });

      // Best cohort performance
      const bestCohortPerformance =
        cohortComparison.length > 0
          ? Math.max(...cohortComparison.map((c) => c.difference))
          : 0;

      // Get unique persona IDs from scenarios this user has worked on
      const userPersonaIds = [
        ...new Set(
          userChats
            .map((chat) => {
              const scenario = scenarios.find((s) => s.id === chat.scenarioId);
              return scenario?.personaId;
            })
            .filter((personaId): personaId is string => personaId !== null)
        ),
      ];

      // Get unique scenario IDs this user has worked on
      const userScenarioIds = [
        ...new Set(userChats.map((chat) => chat.scenarioId)),
      ];

      // Get unique simulation IDs this user has worked on
      const userSimulationIds = [
        ...new Set(userAttempts.map((attempt) => attempt.simulationId)),
      ];

      return {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.alias,
        // The 10 metrics from header components
        averageScore,
        completionPercentage,
        firstAttemptPassRate,
        highestScore,
        messagesPerSession,
        personaResponseTimes,
        sessionEfficiency,
        stagnationRate,
        timeSpent,
        totalAttempts,
        // Risk assessment
        riskLevel,
        riskDetails: riskCounts,
        // Legacy fields for compatibility
        avgScore: averageScore,
        completedSessions,
        totalSessions,
        completionRate:
          totalSessions > 0
            ? Math.round((completedSessions / totalSessions) * 100)
            : 0,
        initials:
          user.firstName +
          " " +
          user.lastName
            .split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase(),
        skillBreakdown,
        weakestSkill,
        strongestSkill,
        avgTimeMinutes,
        passRate,
        trend,
        isStruggling,
        hasNoSessions: totalSessions === 0,
        lastActivity,
        scenariosCompleted,
        taCohorts: userCohorts.map((c) => c.title),
        activeCohorts: activeCohorts.length,
        cohortComparison,
        bestCohortRank:
          cohortComparison.length > 0
            ? Math.min(...cohortComparison.map((c) => c.rank))
            : 0,
        avgVsCohort: bestCohortPerformance,
        // Additional fields for filtering
        role: user.role,
        personasTested: userPersonaIds,
        scenarioIds: userScenarioIds,
        simulationIds: userSimulationIds,
      };
    });

    return taPerformance;
  }, [filteredData, rubrics, messages]);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Loading reports...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ReportsDataTable
        columns={columns}
        data={taPerformanceData}
        personaOptions={personaOptions}
        scenarioOptions={scenarioOptions}
        simulationOptions={simulationOptions}
        simulations={
          filteredData?.simulations?.map((s) => ({
            id: s.id,
            title: s.title,
          })) || []
        }
        showExport={true}
        onViewReport={handleViewReport}
      />
    </div>
  );
}
