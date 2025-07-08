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

import { getAllAgents } from "@/utils/queries/agents/get-all-agents";
import { getAllClasses } from "@/utils/queries/classes/get-all-classes";
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
import { TAPerformanceData, useReportsColumns } from "./reports-columns";
import { ReportsDataTable } from "./reports-data-table";

export interface ReportOptions {
  includeStudentTypeChart: boolean;
  includePerformanceChart: boolean;
  includeRadarChart: boolean;
  includeTimeChart: boolean;
  includeDetailedScores: boolean;
  includeFeedback: boolean;
}

export default function Reports() {
  const router = useRouter();

  const handleViewReport = (profileId: string) => {
    router.push(`/analytics/reports/p/${profileId}`);
  };

  const {
    columns,
    performanceOptions,
    classOptions,
    cohortOptions,
    agentOptions,
  } = useReportsColumns({
    showExport: true,
    onViewReport: handleViewReport,
  });

  // Fetch data
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

  const { data: _classes, isLoading: isLoadingClasses } = useQuery({
    queryKey: ["classes"],
    queryFn: () => getAllClasses(),
  });

  const { data: _agents, isLoading: isLoadingAgents } = useQuery({
    queryKey: ["agents"],
    queryFn: () => getAllAgents(),
  });

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

  // Calculate analytics - same logic as before but formatted for TAPerformanceData
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

    const tas = profiles.filter((profile) => profile.role === "ta");

    // Calculate cohort performance averages
    const cohortPerformance = cohorts.reduce(
      (acc, cohort) => {
        const cohortTAs = tas.filter((ta) => cohort.profileIds.includes(ta.id));
        const cohortGrades = grades.filter((grade) => {
          const chat = chats.find((c) => c.id === grade.simulationChatId);
          const attempt = attempts?.find((a) => a.id === chat?.attemptId);
          return attempt && cohortTAs.some((ta) => ta.id === attempt.profileId);
        });

        const avgScore =
          cohortGrades.length > 0
            ? Math.round(
                cohortGrades.reduce((sum, g) => sum + g.score, 0) /
                  cohortGrades.length
              )
            : 0;

        acc[cohort.id] = { avgScore, memberCount: cohortTAs.length };
        return acc;
      },
      {} as Record<string, { avgScore: number; memberCount: number }>
    );

    // TA leaderboard based on actual grades
    const taPerformance = tas.map((ta): TAPerformanceData => {
      const taAttempts =
        attempts?.filter((attempt) => attempt.profileId === ta.id) || [];
      const taChats = chats.filter((chat) =>
        taAttempts.some((attempt) => attempt.id === chat.attemptId)
      );
      const taGrades = grades.filter((grade) =>
        taChats.some((chat) => chat.id === grade.simulationChatId)
      );
      const taMessages = messages.filter((message) =>
        taChats.some((chat) => chat.id === message.chatId)
      );

      const avgScore =
        taGrades.length > 0
          ? Math.round(
              taGrades.reduce((sum, g) => sum + g.score, 0) / taGrades.length
            )
          : 0;

      const completedSessions = taChats.filter((chat) => chat.completed).length;
      const totalSessions = taChats.length;

      // Calculate skill breakdown for this TA using only simulation chat rubrics
      const taFeedbacks = feedbacks.filter((f) =>
        taGrades.some((g) => g.id === f.simulationChatGradeId)
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
        const groupFeedbacks = taFeedbacks.filter((f) =>
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
        taGrades.length > 0
          ? Math.round(
              taGrades.reduce((sum, g) => sum + g.timeTaken, 0) /
                taGrades.length /
                60
            )
          : 0;

      // Calculate pass rate
      const passRate =
        taGrades.length > 0
          ? Math.round(
              (taGrades.filter((g) => g.passed).length / taGrades.length) * 100
            )
          : 0;

      // Determine if struggling (no sessions OR low performance)
      const isStruggling =
        totalSessions === 0 || (avgScore < 70 && totalSessions > 0);

      // Calculate trend (last 3 vs first 3 sessions)
      const sortedGrades = taGrades.sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
      let trend: "improving" | "declining" | "stable" = "stable";
      if (sortedGrades.length >= 3) {
        const firstThree = sortedGrades.slice(0, 3);
        const lastThree = sortedGrades.slice(-3);
        const firstAvg =
          firstThree.reduce((sum, g) => sum + g.score, 0) / firstThree.length;
        const lastAvg =
          lastThree.reduce((sum, g) => sum + g.score, 0) / lastThree.length;

        if (lastAvg > firstAvg + 5) trend = "improving";
        else if (lastAvg < firstAvg - 5) trend = "declining";
      }

      // Last Activity
      const lastActivity =
        taChats.length > 0
          ? new Date(
              Math.max(
                ...taChats.map((chat) =>
                  new Date(chat.completedAt || chat.updatedAt).getTime()
                )
              )
            )
          : null;

      // Scenarios Completed
      const uniqueScenarios = new Set(taChats.map((chat) => chat.scenarioId));
      const scenariosCompleted = uniqueScenarios.size;

      // Messages Per Session
      const messagesPerSession =
        taChats.length > 0 ? Math.round(taMessages.length / taChats.length) : 0;

      // Total Simulation Attempts
      const totalAttempts = taAttempts.length;

      // Cohorts this TA belongs to
      const taCohorts = cohorts.filter((cohort) =>
        cohort.profileIds.includes(ta.id)
      );
      const activeCohorts = taCohorts.filter((cohort) => cohort.active);

      // Cohort Performance Comparison
      const cohortComparison = taCohorts.map((cohort) => {
        const cohortAvg = cohortPerformance[cohort.id]?.avgScore || 0;
        const difference = avgScore - cohortAvg;
        return {
          cohortId: cohort.id,
          cohortName: cohort.title,
          cohortAvg,
          difference,
          rank: 0, // Will calculate below
        };
      });

      // Calculate rank within each cohort
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
            return taGrades.length > 0
              ? Math.round(
                  taGrades.reduce((sum, g) => sum + g.score, 0) /
                    taGrades.length
                )
              : 0;
          })
          .sort((a, b) => b - a);

        comparison.rank = cohortScores.indexOf(avgScore) + 1;
      });

      // Best cohort performance
      const bestCohortPerformance =
        cohortComparison.length > 0
          ? Math.max(...cohortComparison.map((c) => c.difference))
          : 0;

      return {
        id: ta.id,
        firstName: ta.firstName,
        lastName: ta.lastName,
        username: ta.alias,
        avgScore,
        completedSessions,
        totalSessions,
        completionRate:
          totalSessions > 0
            ? Math.round((completedSessions / totalSessions) * 100)
            : 0,
        initials:
          ta.firstName +
          " " +
          ta.lastName
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
        messagesPerSession,
        totalAttempts,
        taCohorts: taCohorts.map((c) => c.title),
        activeCohorts: activeCohorts.length,
        cohortComparison,
        bestCohortRank:
          cohortComparison.length > 0
            ? Math.min(...cohortComparison.map((c) => c.rank))
            : 0,
        avgVsCohort: bestCohortPerformance,
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
    isLoadingCohorts ||
    isLoadingClasses ||
    isLoadingAgents
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
        performanceOptions={performanceOptions}
        classOptions={classOptions}
        cohortOptions={cohortOptions}
        agentOptions={agentOptions}
        showExport={true}
      />
    </div>
  );
}
