/**
 * Reports.tsx
 * Used to display the reports for the analytics page in a dense table format.
 * @AshokSaravanan222 & @siladiea
 * 06/07/2025
 */
"use client";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
// Removed downloadReport import - now calling API directly
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
import {
  AlertTriangle,
  ArrowUp,
  Award,
  Clock,
  MessageCircle,
  Search,
  Target,
  TrendingDown,
  TrendingUp,
  Trophy,
  Users,
} from "lucide-react";

export interface ReportOptions {
  includeStudentTypeChart: boolean;
  includePerformanceChart: boolean;
  includeRadarChart: boolean;
  includeTimeChart: boolean;
  includeDetailedScores: boolean;
  includeFeedback: boolean;
}

type SortOption =
  | "score-desc"
  | "score-asc"
  | "name-asc"
  | "name-desc"
  | "sessions-desc"
  | "last-activity-desc"
  | "consistency-desc"
  | "scenarios-desc";
type FilterOption = "all" | "struggling" | "performing-well";

export default function Reports() {
  const router = useRouter();
  const [sortBy, setSortBy] = useState<SortOption>("score-desc");
  const [filterBy, setFilterBy] = useState<FilterOption>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedClass, setSelectedClass] = useState<string>("all");
  const [selectedCohort, setSelectedCohort] = useState<string>("all");
  const [selectedAgent, setSelectedAgent] = useState<string>("all");

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

  const { data: classes, isLoading: isLoadingClasses } = useQuery({
    queryKey: ["classes"],
    queryFn: () => getAllClasses(),
  });

  const { data: agents, isLoading: isLoadingAgents } = useQuery({
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

  // Calculate analytics
  const analytics = useMemo(() => {
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
      return null;

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
    const taPerformance = tas.map((ta) => {
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
      let trend = "stable";
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

      // COHORT-BASED ANALYTICS

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
        // Cohort-based fields
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

    return {
      taPerformance,
    };
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

  // Sort, filter, and search TAs
  const sortedFilteredAndSearchedTAs = useMemo(() => {
    if (!analytics) return [];

    let filtered = [...analytics.taPerformance];

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(
        (ta) =>
          ta.firstName.toLowerCase().includes(query) ||
          ta.lastName.toLowerCase().includes(query) ||
          ta.username.toLowerCase().includes(query)
      );
    }

    // Apply class filter
    if (selectedClass !== "all" && classes) {
      const selectedClassObj = classes.find((c) => c.id === selectedClass);
      if (selectedClassObj) {
        filtered = filtered.filter((ta) => {
          const profile = profiles?.find((p) => p.id === ta.id);
          return profile?.classIds.includes(selectedClass);
        });
      }
    }

    // Apply cohort filter
    if (selectedCohort !== "all" && cohorts) {
      const selectedCohortObj = cohorts.find((c) => c.id === selectedCohort);
      if (selectedCohortObj) {
        filtered = filtered.filter((ta) =>
          selectedCohortObj.profileIds.includes(ta.id)
        );
      }
    }

    // Apply agent filter (through scenarios)
    if (selectedAgent !== "all" && scenarios) {
      const agentScenarios = scenarios.filter(
        (s) => s.agentId === selectedAgent
      );
      const agentScenarioIds = agentScenarios.map((s) => s.id);

      filtered = filtered.filter((ta) => {
        const taAttempts =
          attempts?.filter((attempt) => attempt.profileId === ta.id) || [];
        const taChats =
          chats?.filter((chat) =>
            taAttempts.some((attempt) => attempt.id === chat.attemptId)
          ) || [];

        return taChats.some((chat) =>
          agentScenarioIds.includes(chat.scenarioId)
        );
      });
    }

    // Apply performance filter
    switch (filterBy) {
      case "struggling":
        filtered = filtered.filter((ta) => ta.isStruggling);
        break;
      case "performing-well":
        filtered = filtered.filter((ta) => !ta.isStruggling);
        break;
      // "all" shows everyone
    }

    // Apply sort
    switch (sortBy) {
      case "score-desc":
        filtered.sort((a, b) => b.avgScore - a.avgScore);
        break;
      case "score-asc":
        filtered.sort((a, b) => a.avgScore - b.avgScore);
        break;
      case "name-asc":
        filtered.sort((a, b) => a.firstName.localeCompare(b.firstName));
        break;
      case "name-desc":
        filtered.sort((a, b) => b.firstName.localeCompare(a.firstName));
        break;
      case "sessions-desc":
        filtered.sort((a, b) => b.totalSessions - a.totalSessions);
        break;
      case "last-activity-desc":
        filtered.sort((a, b) => {
          if (!a.lastActivity && !b.lastActivity) return 0;
          if (!a.lastActivity) return 1;
          if (!b.lastActivity) return -1;
          return b.lastActivity.getTime() - a.lastActivity.getTime();
        });
        break;
      case "consistency-desc":
        filtered.sort((a, b) => b.avgVsCohort - a.avgVsCohort);
        break;
      case "scenarios-desc":
        filtered.sort((a, b) => b.scenariosCompleted - a.scenariosCompleted);
        break;
    }

    return filtered;
  }, [
    analytics,
    sortBy,
    filterBy,
    searchQuery,
    selectedClass,
    selectedCohort,
    selectedAgent,
    classes,
    cohorts,
    scenarios,
    attempts,
    chats,
    profiles,
  ]);

  const handleViewReport = (profileId: string) => {
    router.push(`/analytics/reports/p/${profileId}`);
  };

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

  if (!analytics) return null;

  return (
    <div className="space-y-6">
      {/* Header with search and filters */}
      <div className="flex flex-col gap-4">
        {/* Search bar */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search TAs by name or alias..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Filters row */}
        <div className="flex items-center gap-4 flex-wrap">
          {/* Performance Filter */}
          <div className="flex items-center gap-2">
            <Label htmlFor="filter" className="text-sm font-medium">
              Performance:
            </Label>
            <Select
              value={filterBy}
              onValueChange={(value: FilterOption) => setFilterBy(value)}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All TAs</SelectItem>
                <SelectItem value="struggling">Struggling</SelectItem>
                <SelectItem value="performing-well">Performing Well</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Class Filter */}
          <div className="flex items-center gap-2">
            <Label htmlFor="class-filter" className="text-sm font-medium">
              Class:
            </Label>
            <Select
              value={selectedClass}
              onValueChange={(value: string) => setSelectedClass(value)}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Classes</SelectItem>
                {classes?.map((classItem) => (
                  <SelectItem key={classItem.id} value={classItem.id}>
                    {classItem.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Cohort Filter */}
          <div className="flex items-center gap-2">
            <Label htmlFor="cohort-filter" className="text-sm font-medium">
              Cohort:
            </Label>
            <Select
              value={selectedCohort}
              onValueChange={(value: string) => setSelectedCohort(value)}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Cohorts</SelectItem>
                {cohorts?.map((cohort) => (
                  <SelectItem key={cohort.id} value={cohort.id}>
                    {cohort.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Agent Filter */}
          <div className="flex items-center gap-2">
            <Label htmlFor="agent-filter" className="text-sm font-medium">
              Agent:
            </Label>
            <Select
              value={selectedAgent}
              onValueChange={(value: string) => setSelectedAgent(value)}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Agents</SelectItem>
                {agents?.map((agent) => (
                  <SelectItem key={agent.id} value={agent.id}>
                    {agent.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Sort Filter */}
          <div className="flex items-center gap-2">
            <Label htmlFor="sort" className="text-sm font-medium">
              Sort:
            </Label>
            <Select
              value={sortBy}
              onValueChange={(value: SortOption) => setSortBy(value)}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="score-desc">Score (High to Low)</SelectItem>
                <SelectItem value="score-asc">Score (Low to High)</SelectItem>
                <SelectItem value="name-asc">Name (A to Z)</SelectItem>
                <SelectItem value="name-desc">Name (Z to A)</SelectItem>
                <SelectItem value="sessions-desc">
                  Sessions (Most to Least)
                </SelectItem>
                <SelectItem value="last-activity-desc">
                  Last Activity (Recent)
                </SelectItem>
                <SelectItem value="consistency-desc">
                  Consistency (High to Low)
                </SelectItem>
                <SelectItem value="scenarios-desc">
                  Scenarios (Most to Least)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Dense Table */}
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="h-8">
              <TableHead className="w-[30px] border-r px-1 py-1 text-xs">
                #
              </TableHead>
              <TableHead className="min-w-[100px] border-r px-2 py-1 text-xs">
                Name
              </TableHead>
              <TableHead className="w-[60px] border-r px-1 py-1 text-xs">
                Alias
              </TableHead>
              <TableHead className="w-[50px] text-center border-r px-1 py-1 text-xs">
                Score
              </TableHead>
              <TableHead className="w-[60px] text-center border-r px-1 py-1 text-xs">
                Sessions
              </TableHead>
              <TableHead className="w-[45px] text-center border-r px-1 py-1 text-xs">
                Pass
              </TableHead>
              <TableHead className="w-[45px] text-center border-r px-1 py-1 text-xs">
                Time
              </TableHead>
              <TableHead className="w-[55px] text-center border-r px-1 py-1 text-xs">
                Complete
              </TableHead>
              <TableHead className="w-[45px] text-center border-r px-1 py-1 text-xs">
                Trend
              </TableHead>
              <TableHead className="w-[70px] text-center border-r px-1 py-1 text-xs">
                Last Activity
              </TableHead>
              <TableHead className="w-[55px] text-center border-r px-1 py-1 text-xs">
                Scenarios
              </TableHead>
              <TableHead className="w-[55px] text-center border-r px-1 py-1 text-xs">
                Msgs/Sess
              </TableHead>
              <TableHead className="w-[60px] text-center border-r px-1 py-1 text-xs">
                Total Attempts
              </TableHead>
              <TableHead className="w-[60px] text-center border-r px-1 py-1 text-xs">
                Cohorts
              </TableHead>
              <TableHead className="w-[55px] text-center border-r px-1 py-1 text-xs">
                Cohort Rank
              </TableHead>
              <TableHead className="w-[60px] text-center border-r px-1 py-1 text-xs">
                vs Cohort
              </TableHead>
              <TableHead className="w-[50px] text-center border-r px-1 py-1 text-xs">
                Status
              </TableHead>
              <TableHead className="w-[45px] px-1 py-1 text-xs">
                Action
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedFilteredAndSearchedTAs.length > 0 ? (
              sortedFilteredAndSearchedTAs.map((ta, index) => (
                <TableRow
                  key={ta.id}
                  className={`h-8 ${
                    ta.isStruggling
                      ? "bg-orange-50/50 border-orange-200"
                      : "hover:bg-muted/30"
                  } transition-colors`}
                >
                  {/* Rank */}
                  <TableCell className="font-medium text-center border-r px-1 py-1">
                    <div className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 text-primary font-bold text-[10px]">
                      {index + 1}
                    </div>
                  </TableCell>

                  {/* Name */}
                  <TableCell className="border-r px-2 py-1">
                    <div className="flex items-center gap-1">
                      <div
                        className="font-medium text-xs cursor-pointer hover:text-primary hover:underline truncate"
                        onClick={() => handleViewReport(ta.id)}
                        title={`${ta.firstName} ${ta.lastName}`}
                      >
                        {ta.firstName} {ta.lastName}
                      </div>
                      {ta.isStruggling && (
                        <AlertTriangle className="h-2.5 w-2.5 text-orange-600 flex-shrink-0" />
                      )}
                    </div>
                  </TableCell>

                  {/* Alias */}
                  <TableCell
                    className="text-xs text-muted-foreground border-r px-1 py-1 truncate"
                    title={ta.username}
                  >
                    {ta.username}
                  </TableCell>

                  {/* Score */}
                  <TableCell className="text-center border-r px-1 py-1">
                    <Badge
                      variant={
                        ta.avgScore >= 80
                          ? "default"
                          : ta.avgScore >= 70
                            ? "secondary"
                            : "destructive"
                      }
                      className="text-[10px] font-medium px-1 py-0 h-4"
                    >
                      {ta.hasNoSessions ? "N/A" : `${ta.avgScore}%`}
                    </Badge>
                  </TableCell>

                  {/* Sessions */}
                  <TableCell className="text-center border-r px-1 py-1">
                    <div className="text-[10px] font-medium">
                      {ta.completedSessions}/{ta.totalSessions}
                    </div>
                  </TableCell>

                  {/* Pass Rate */}
                  <TableCell className="text-center border-r px-1 py-1">
                    <div className="text-[10px] font-medium">
                      {ta.hasNoSessions ? "N/A" : `${ta.passRate}%`}
                    </div>
                  </TableCell>

                  {/* Avg Time */}
                  <TableCell className="text-center border-r px-1 py-1">
                    <div className="text-[10px] font-medium">
                      {ta.hasNoSessions ? "N/A" : `${ta.avgTimeMinutes}m`}
                    </div>
                  </TableCell>

                  {/* Completion Rate */}
                  <TableCell className="text-center border-r px-1 py-1">
                    <div className="text-[10px] font-medium">
                      {ta.completionRate}%
                    </div>
                  </TableCell>

                  {/* Trend */}
                  <TableCell className="text-center border-r px-1 py-1">
                    {ta.trend === "improving" ? (
                      <div className="flex items-center justify-center text-green-600">
                        <TrendingUp className="h-2.5 w-2.5" />
                      </div>
                    ) : ta.trend === "declining" ? (
                      <div className="flex items-center justify-center text-red-600">
                        <TrendingDown className="h-2.5 w-2.5" />
                      </div>
                    ) : (
                      <div className="flex items-center justify-center text-gray-600">
                        <ArrowUp className="h-2.5 w-2.5 rotate-90" />
                      </div>
                    )}
                  </TableCell>

                  {/* Last Activity */}
                  <TableCell className="text-center border-r px-1 py-1">
                    <div className="text-[10px] font-medium flex items-center justify-center gap-0.5">
                      <Clock className="h-2.5 w-2.5" />
                      <span className="truncate">
                        {ta.lastActivity
                          ? new Date(ta.lastActivity).toLocaleDateString(
                              "en-US",
                              {
                                month: "short",
                                day: "numeric",
                              }
                            )
                          : "Never"}
                      </span>
                    </div>
                  </TableCell>

                  {/* Scenarios Completed */}
                  <TableCell className="text-center border-r px-1 py-1">
                    <div className="text-[10px] font-medium flex items-center justify-center gap-0.5">
                      <Target className="h-2.5 w-2.5" />
                      {ta.scenariosCompleted}
                    </div>
                  </TableCell>

                  {/* Messages Per Session */}
                  <TableCell className="text-center border-r px-1 py-1">
                    <div className="text-[10px] font-medium flex items-center justify-center gap-0.5">
                      <MessageCircle className="h-2.5 w-2.5" />
                      {ta.hasNoSessions ? "N/A" : ta.messagesPerSession}
                    </div>
                  </TableCell>

                  {/* Total Attempts */}
                  <TableCell className="text-center border-r px-1 py-1">
                    <div className="text-[10px] font-medium">
                      {ta.totalAttempts}
                    </div>
                  </TableCell>

                  {/* Cohorts */}
                  <TableCell className="text-center border-r px-1 py-1">
                    <div className="text-[10px] font-medium flex items-center justify-center gap-0.5">
                      <Users className="h-2.5 w-2.5" />
                      <span title={ta.taCohorts.join(", ")}>
                        {ta.taCohorts.length}
                      </span>
                    </div>
                  </TableCell>

                  {/* Cohort Rank */}
                  <TableCell className="text-center border-r px-1 py-1">
                    <div className="text-[10px] font-medium flex items-center justify-center gap-0.5">
                      <Trophy className="h-2.5 w-2.5" />
                      {ta.bestCohortRank > 0 ? `#${ta.bestCohortRank}` : "N/A"}
                    </div>
                  </TableCell>

                  {/* Avg vs Cohort */}
                  <TableCell className="text-center border-r px-1 py-1">
                    <div
                      className={`text-[10px] font-medium ${ta.avgVsCohort > 0 ? "text-green-600" : ta.avgVsCohort < 0 ? "text-red-600" : "text-gray-600"}`}
                    >
                      {ta.avgVsCohort > 0 ? "+" : ""}
                      {ta.avgVsCohort}%
                    </div>
                  </TableCell>

                  {/* Status */}
                  <TableCell className="text-center border-r px-1 py-1">
                    {ta.hasNoSessions ? (
                      <Badge
                        variant="destructive"
                        className="text-[10px] px-1 py-0 h-4"
                      >
                        None
                      </Badge>
                    ) : ta.isStruggling ? (
                      <Badge
                        variant="secondary"
                        className="text-[10px] bg-orange-100 text-orange-800 px-1 py-0 h-4"
                      >
                        Risk
                      </Badge>
                    ) : (
                      <Badge
                        variant="default"
                        className="text-[10px] bg-green-100 text-green-800 px-1 py-0 h-4"
                      >
                        Good
                      </Badge>
                    )}
                  </TableCell>

                  {/* Actions */}
                  <TableCell className="px-1 py-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 px-2 text-[10px]"
                      onClick={() => handleViewReport(ta.id)}
                    >
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={18} className="text-center py-8">
                  <div className="flex flex-col items-center gap-3">
                    <Award className="h-12 w-12 text-muted-foreground" />
                    <div>
                      <h3 className="text-base font-medium mb-1">
                        {searchQuery.trim() ||
                        selectedClass !== "all" ||
                        selectedCohort !== "all" ||
                        selectedAgent !== "all"
                          ? "No TAs found matching the current filters"
                          : "No TAs match the current filter"}
                      </h3>
                      <p className="text-sm text-muted-foreground mb-3">
                        Try adjusting your search or filter criteria
                      </p>
                      {(searchQuery.trim() ||
                        selectedClass !== "all" ||
                        selectedCohort !== "all" ||
                        selectedAgent !== "all") && (
                        <div className="flex gap-2">
                          {searchQuery.trim() && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSearchQuery("")}
                            >
                              Clear search
                            </Button>
                          )}
                          {(selectedClass !== "all" ||
                            selectedCohort !== "all" ||
                            selectedAgent !== "all") && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedClass("all");
                                setSelectedCohort("all");
                                setSelectedAgent("all");
                              }}
                            >
                              Clear filters
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
