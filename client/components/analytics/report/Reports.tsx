/**
 * Reports.tsx
 * Used to display the reports for the analytics page in a dense table format.
 * @AshokSaravanan222 & @siladiea
 * 06/07/2025
 */
"use client";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useMemo } from "react";

import { useAnalytics } from "@/contexts/analytics-context";
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
import { getAllCohorts } from "@/utils/queries/cohorts/get-all-cohorts";
import { getAllProfiles } from "@/utils/queries/profiles/get-all-profiles";
import { getAllRubrics } from "@/utils/queries/rubrics/get-all-rubrics";
import { getAllScenarios } from "@/utils/queries/scenarios/get-all-scenarios";
import { getSimulationAttemptsByProfiles } from "@/utils/queries/simulation_attempts/get-simulation-attempts-by-profiles";
import { getSimulationChatFeedbacksBySimulationChatGrades } from "@/utils/queries/simulation_chat_feedbacks/get-simulation-chat-feedbacks-by-simulationchatgrades";
import { getSimulationChatGradesBySimulationChats } from "@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-simulationchats";
import { getSimulationChatsByAttempts } from "@/utils/queries/simulation_chats/get-simulation-chats-by-attempts";
import { getSimulationMessagesByChats } from "@/utils/queries/simulation_messages/get-simulation-messages-by-chats";
import { getAllSimulations } from "@/utils/queries/simulations/get-all-simulations";
import { getStandardGroupsByRubrics } from "@/utils/queries/standard_groups/get-standard-groups-by-rubrics";
import { getStandardsByStandardGroups } from "@/utils/queries/standards/get-standards-by-standardgroups";
import { ReportsDataTable } from "./ReportsDataTable";

export default function Reports() {
  const router = useRouter();
  const {
    startDate,
    endDate,
    effectiveCohortIds,
    selectedRoles,
    includePractice,
  } = useAnalytics();

  const handleViewReport = (profileId: string) => {
    router.push(`/analytics/reports/p/${profileId}`);
  };

  const { columns, personaOptions, scenarioOptions, simulationOptions } =
    useReportColumns({
      showExport: true,
      onViewReport: handleViewReport,
    });

  // Filter out default profiles and only include non-default profiles
  const { data: profiles, isLoading: isLoadingProfiles } = useQuery({
    queryKey: ["profiles"],
    queryFn: () => getAllProfiles(),
  });

  const { data: simulations, isLoading: isLoadingSimulations } = useQuery({
    queryKey: ["simulations"],
    queryFn: () => getAllSimulations(),
  });

  const { data: scenarios, isLoading: isLoadingScenarios } = useQuery({
    queryKey: ["scenarios"],
    queryFn: () => getAllScenarios(),
  });

  const { data: cohorts, isLoading: isLoadingCohorts } = useQuery({
    queryKey: ["cohorts"],
    queryFn: () => getAllCohorts(),
  });

  // Filter out default profiles and only include non-default profiles
  const tas = useMemo(() => {
    if (!profiles) return [];
    let tas = profiles.filter((profile) => !profile.defaultProfile);

    // Apply role filtering from analytics filters (higher-level logic)
    if (selectedRoles && selectedRoles.length > 0) {
      tas = tas.filter((profile) => selectedRoles.includes(profile.role));
    }

    if (effectiveCohortIds.length > 0 && cohorts) {
      const selectedCohorts = cohorts.filter((cohort) =>
        effectiveCohortIds.includes(cohort.id)
      );
      const cohortProfileIds = new Set<string>();
      selectedCohorts.forEach((cohort) => {
        cohort.profileIds.forEach((id) => cohortProfileIds.add(id));
      });
      tas = tas.filter((profile) => cohortProfileIds.has(profile.id));
    }
    return tas;
  }, [profiles, effectiveCohortIds, cohorts, selectedRoles]);

  const { data: rubrics, isLoading: isLoadingRubrics } = useQuery({
    queryKey: ["rubrics"],
    queryFn: () => getAllRubrics(),
  });

  const { data: standardGroups, isLoading: isLoadingStandardGroups } = useQuery(
    {
      queryKey: ["standardGroups", rubrics?.map((rubric) => rubric.id)],
      queryFn: () =>
        getStandardGroupsByRubrics(rubrics!.map((rubric) => rubric.id)),
      enabled: !!rubrics && rubrics.length > 0,
    }
  );

  const { data: standards, isLoading: isLoadingStandards } = useQuery({
    queryKey: ["standards", standardGroups?.map((group) => group.id)],
    queryFn: () =>
      getStandardsByStandardGroups(standardGroups!.map((group) => group.id)),
    enabled: !!standardGroups && standardGroups.length > 0,
  });

  const { data: attempts, isLoading: isLoadingAttempts } = useQuery({
    queryKey: ["simulationAttempts", profiles?.map((profile) => profile.id)],
    queryFn: () =>
      getSimulationAttemptsByProfiles(profiles!.map((profile) => profile.id)),
    enabled: !!profiles && profiles.length > 0,
  });

  const { data: chats, isLoading: isLoadingChats } = useQuery({
    queryKey: ["simulationChats", attempts?.map((attempt) => attempt.id)],
    queryFn: () =>
      getSimulationChatsByAttempts(attempts!.map((attempt) => attempt.id)),
    enabled: !!attempts && attempts.length > 0,
  });

  const { data: messages, isLoading: isLoadingMessages } = useQuery({
    queryKey: ["simulationMessages", chats?.map((chat) => chat.id)],
    queryFn: () => getSimulationMessagesByChats(chats!.map((chat) => chat.id)),
    enabled: !!chats && chats.length > 0,
  });

  const { data: grades, isLoading: isLoadingGrades } = useQuery({
    queryKey: ["simulationGrades", chats?.map((chat) => chat.id)],
    queryFn: () =>
      getSimulationChatGradesBySimulationChats(chats!.map((chat) => chat.id)),
    enabled: !!chats && chats.length > 0,
  });

  const { data: feedbacks, isLoading: isLoadingFeedbacks } = useQuery({
    queryKey: ["simulationFeedbacks", grades?.map((grade) => grade.id)],
    queryFn: () =>
      getSimulationChatFeedbacksBySimulationChatGrades(
        grades!.map((grade) => grade.id)
      ),
    enabled: !!grades && grades.length > 0,
  });

  // Calculate analytics with the 10 metrics from header components
  const taPerformanceData = useMemo((): TAPerformanceData[] => {
    if (
      !profiles ||
      !chats ||
      !grades ||
      !feedbacks ||
      !standards ||
      !standardGroups ||
      !rubrics ||
      !scenarios ||
      !simulations ||
      !messages ||
      !cohorts
    )
      return [];

    // Filter simulations based on selected cohorts (used for cohort comparisons and breakdowns)
    let filteredSimulations = simulations;
    if (effectiveCohortIds.length > 0) {
      const selectedCohorts = cohorts.filter((cohort) =>
        effectiveCohortIds.includes(cohort.id)
      );
      const cohortSimulationIds = new Set<string>();
      selectedCohorts.forEach((cohort) => {
        cohort.simulationIds.forEach((id) => cohortSimulationIds.add(id));
      });
      filteredSimulations = simulations.filter((simulation) =>
        cohortSimulationIds.has(simulation.id)
      );
    }

    // Local filtered collections for non-header extras (skill breakdown, cohort comparisons)
    const dateFilteredGrades = grades.filter((grade) => {
      const gradeDate = new Date(grade.createdAt);
      return gradeDate >= startDate && gradeDate <= endDate;
    });

    const dateFilteredChats = chats.filter((chat) => {
      const chatDate = new Date(chat.createdAt);
      return chatDate >= startDate && chatDate <= endDate;
    });

    const dateFilteredAttempts =
      attempts?.filter((attempt) => {
        const attemptDate = new Date(attempt.createdAt);
        return attemptDate >= startDate && attemptDate <= endDate;
      }) || [];

    // messages are not needed for centralized header metric calculations here

    // Filter attempts by selected simulations
    const simulationFilteredAttempts = dateFilteredAttempts.filter((attempt) =>
      filteredSimulations.some(
        (simulation) => simulation.id === attempt.simulationId
      )
    );

    // Filter chats by filtered attempts
    const simulationFilteredChats = dateFilteredChats.filter((chat) =>
      simulationFilteredAttempts.some(
        (attempt) => attempt.id === chat.attemptId
      )
    );

    // Filter grades by filtered chats
    const simulationFilteredGrades = dateFilteredGrades.filter((grade) =>
      simulationFilteredChats.some((chat) => chat.id === grade.simulationChatId)
    );

    // messages filtered by chats not required here

    // Calculate cohort performance averages
    const cohortPerformance = cohorts.reduce(
      (acc, cohort) => {
        const cohortMembers = tas.filter((member) =>
          cohort.profileIds.includes(member.id)
        );
        const cohortGrades = simulationFilteredGrades.filter((grade) => {
          const chat = simulationFilteredChats.find(
            (c) => c.id === grade.simulationChatId
          );
          const attempt = simulationFilteredAttempts?.find(
            (a) => a.id === chat?.attemptId
          );
          return (
            attempt &&
            cohortMembers.some((member) => member.id === attempt.profileId)
          );
        });

        // Calculate cohort average using rubric points
        let cohortAvgScore = 0;
        if (cohortGrades.length > 0) {
          const cohortScoreSum = cohortGrades.reduce((sum, grade) => {
            const chat = simulationFilteredChats.find(
              (c) => c.id === grade.simulationChatId
            );
            const attempt = simulationFilteredAttempts?.find(
              (a) => a.id === chat?.attemptId
            );
            const simulation = filteredSimulations?.find(
              (s) => s.id === attempt?.simulationId
            );
            const rubric = rubrics?.find((r) => r.id === simulation?.rubricId);
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
          memberCount: cohortMembers.length,
        };
        return acc;
      },
      {} as Record<string, { avgScore: number; memberCount: number }>
    );

    // User performance based on the 10 metrics from centralized header analytics
    const taPerformance = tas.map((user): TAPerformanceData => {
      // Build common inputs
      const cohortIds = effectiveCohortIds;
      const profilesForRoles = profiles.map((p) => ({
        id: p.id,
        role: p.role,
      }));

      // 1. Average Score
      const averageScore = calculateAverageScore(
        grades,
        chats,
        attempts || [],
        simulations,
        rubrics,
        startDate,
        endDate,
        user.id,
        cohorts,
        cohortIds,
        selectedRoles,
        includePractice,
        profilesForRoles
      ).currentValue;

      // 2. Completion Percentage
      const completionPercentage = calculateCompletionPercentage(
        chats,
        grades,
        attempts || [],
        simulations,
        startDate,
        endDate,
        user.id,
        cohorts,
        cohortIds,
        selectedRoles,
        includePractice,
        profilesForRoles
      ).currentValue;

      // 3. First Attempt Pass Rate
      const firstAttemptPassRate = calculateFirstAttemptPassRate(
        attempts || [],
        chats,
        grades,
        simulations,
        startDate,
        endDate,
        user.id,
        cohorts,
        cohortIds,
        selectedRoles,
        includePractice,
        profilesForRoles
      ).currentValue;

      // 4. Highest Score
      const highestScore = calculateHighestScore(
        grades,
        chats,
        attempts || [],
        simulations,
        rubrics,
        startDate,
        endDate,
        user.id,
        cohorts,
        cohortIds,
        selectedRoles,
        includePractice,
        profilesForRoles
      ).currentValue;

      // 5. Messages Per Session
      const messagesPerSession = calculateMessagesPerSession(
        messages,
        chats,
        attempts || [],
        simulations,
        startDate,
        endDate,
        user.id,
        cohorts,
        cohortIds,
        selectedRoles,
        includePractice,
        profilesForRoles
      ).currentValue;

      // 6. Persona Response Times (seconds -> we show minutes in UI)
      const personaResponseSeconds = calculatePersonaResponseTimes(
        messages,
        chats,
        attempts || [],
        simulations,
        startDate,
        endDate,
        user.id,
        cohorts,
        cohortIds,
        selectedRoles,
        includePractice,
        profilesForRoles
      ).currentValue;
      const personaResponseTimes = Math.round(personaResponseSeconds / 60);

      // 7. Session Efficiency
      const sessionEfficiency = calculateSessionEfficiency(
        grades,
        chats,
        attempts || [],
        simulations,
        rubrics,
        startDate,
        endDate,
        user.id,
        cohorts,
        cohortIds,
        selectedRoles,
        includePractice,
        profilesForRoles
      ).currentValue;

      // 8. Stagnation Rate
      const stagnationRate = calculateStagnationRate(
        attempts || [],
        chats,
        grades,
        simulations,
        rubrics,
        startDate,
        endDate,
        user.id,
        cohorts,
        cohortIds,
        selectedRoles,
        includePractice,
        profilesForRoles
      ).currentValue;

      // 9. Time Spent (seconds -> minutes)
      const timeSpentSeconds = calculateTimeSpent(
        chats,
        attempts || [],
        simulations,
        startDate,
        endDate,
        user.id,
        cohorts,
        cohortIds,
        selectedRoles,
        includePractice,
        profilesForRoles
      ).currentValue;
      const timeSpent = Math.round(timeSpentSeconds / 60);

      // 10. Total Attempts
      const totalAttempts = calculateTotalAttempts(
        attempts || [],
        simulations,
        startDate,
        endDate,
        user.id,
        cohorts,
        cohortIds,
        selectedRoles,
        includePractice,
        profilesForRoles
      ).currentValue;

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
      const userAttempts =
        simulationFilteredAttempts?.filter(
          (attempt) => attempt.profileId === user.id
        ) || [];
      const userChats = simulationFilteredChats.filter((chat) =>
        userAttempts.some((attempt) => attempt.id === chat.attemptId)
      );
      const userGrades = simulationFilteredGrades.filter((grade) =>
        userChats.some((chat) => chat.id === grade.simulationChatId)
      );
      const completedSessions = userChats.filter(
        (chat) => chat.completed
      ).length;
      const totalSessions = userChats.length;

      // Calculate skill breakdown for this user using only simulation chat rubrics
      const userFeedbacks = feedbacks.filter((f) =>
        userGrades.some((g) => g.id === f.simulationChatGradeId)
      );

      const validRubrics = rubrics?.filter((r) =>
        simulations?.some((s) => s.rubricId === r.id)
      );
      const validGroupStandards = standardGroups?.filter((g) =>
        validRubrics?.some((r) => r.id === g.rubricId)
      );
      const validStandards = standards?.filter((s) =>
        validGroupStandards?.some((g) => g.id === s.standardGroupId)
      );

      const skillBreakdown = validGroupStandards.map((group) => {
        const groupStandards = validStandards.filter(
          (s) => s.standardGroupId === group.id
        );
        const groupFeedbacks = userFeedbacks.filter((f) =>
          groupStandards.some((s) => s.id === f.standardId)
        );

        const avgSkillScore =
          groupFeedbacks.length > 0
            ? Math.round(
                (groupFeedbacks.reduce((sum, f) => sum + f.total, 0) /
                  groupFeedbacks.length /
                  (rubrics?.find((r) => r.id === group.rubricId)?.points ||
                    100)) *
                  100
              )
            : 0;

        return {
          skill: group.shortName,
          score: avgSkillScore,
          feedbackCount: groupFeedbacks.length,
        };
      });

      // Find weakest and strongest skills
      const weakestSkill = skillBreakdown.reduce(
        (min, skill) => (skill.score < min.score ? skill : min),
        skillBreakdown[0] || { skill: "Unknown", score: 100, feedbackCount: 0 }
      );

      const strongestSkill = skillBreakdown.reduce(
        (max, skill) => (skill.score > max.score ? skill : max),
        skillBreakdown[0] || { skill: "Unknown", score: 0, feedbackCount: 0 }
      );

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
            const simulation = filteredSimulations?.find(
              (s) => s.id === attempt?.simulationId
            );
            const rubric = rubrics?.find((r) => r.id === simulation?.rubricId);
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
            const simulation = filteredSimulations?.find(
              (s) => s.id === attempt?.simulationId
            );
            const rubric = rubrics?.find((r) => r.id === simulation?.rubricId);
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
      const userCohorts = cohorts.filter((cohort) =>
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
              const attempt = attempts?.find((a) => a.id === chat?.attemptId);
              return attempt && attempt.profileId === ta.id;
            });

            if (taGrades.length === 0) return 0;

            const taScoreSum = taGrades.reduce((sum, grade) => {
              const chat = chats.find((c) => c.id === grade.simulationChatId);
              const attempt = attempts?.find((a) => a.id === chat?.attemptId);
              const simulation = filteredSimulations?.find(
                (s) => s.id === attempt?.simulationId
              );
              const rubric = rubrics?.find(
                (r) => r.id === simulation?.rubricId
              );
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
  }, [
    profiles,
    chats,
    grades,
    feedbacks,
    standards,
    standardGroups,
    attempts,
    rubrics,
    simulations,
    scenarios,
    messages,
    cohorts,
    startDate,
    endDate,
    effectiveCohortIds,
    tas,
    selectedRoles,
    includePractice,
  ]);

  // Loading state
  if (
    isLoadingProfiles ||
    isLoadingAttempts ||
    isLoadingChats ||
    isLoadingGrades ||
    isLoadingFeedbacks ||
    isLoadingStandards ||
    isLoadingStandardGroups ||
    isLoadingRubrics ||
    isLoadingSimulations ||
    isLoadingScenarios ||
    isLoadingMessages ||
    isLoadingCohorts
  ) {
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
        simulations={simulations || []}
        showExport={true}
        onViewReport={handleViewReport}
      />
    </div>
  );
}
