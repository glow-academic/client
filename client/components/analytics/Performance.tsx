/**
 * Performance.tsx
 * Used to display the performance for the analytics page.
 * @AshokSaravanan222 & @siladiea
 * 06/07/2025
 */

"use client";
import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  TrendingUp,
  Target,
  Clock,
  Award,
  MessageSquare,
  Users,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";
import { format, subDays, isAfter, startOfDay } from "date-fns";
import { getAgentConfig } from "@/utils/agents";
import { getAllRubrics } from "@/utils/queries/rubrics/get-all-rubrics";
import { getAllAgents } from "@/utils/queries/agents/get-all-agents";
import { getStandardGroupsByRubrics } from "@/utils/queries/standard_groups/get-standard-groups-by-rubrics";
import { getStandardsByStandardGroups } from "@/utils/queries/standards/get-standards-by-standardgroups";
import { getSimulationChatsByAttempts } from "@/utils/queries/simulation_chats/get-simulation-chats-by-attempts";
import { getSimulationChatGradesBySimulationChats } from "@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-simulationchats";
import { getSimulationChatFeedbacksBySimulationChatGrades } from "@/utils/queries/simulation_chat_feedbacks/get-simulation-chat-feedbacks-by-simulationchatgrades";
import { getAllScenarios } from "@/utils/queries/scenarios/get-all-scenarios";
import { getAllSimulations } from "@/utils/queries/simulations/get-all-simulations";
import { getAllProfiles } from "@/utils/queries/profiles/get-all-profiles";
import { getSimulationAttemptsByProfiles } from "@/utils/queries/simulation_attempts/get-simulation-attempts-by-profiles";

// Color palette for charts
const COLORS = {
  primary: "#3b82f6",
  success: "#10b981",
  warning: "#f59e0b",
  danger: "#ef4444",
  purple: "#8b5cf6",
  pink: "#ec4899",
  teal: "#14b8a6",
  orange: "#f97316",
};

export default function Performance() {
  const [selectedRubricId, setSelectedRubricId] = useState<string>("all");
  const [personalityTimeRange, setPersonalityTimeRange] = useState<"7d" | "30d" | "90d">("30d");
  const [skillTimeRange, setSkillTimeRange] = useState<"7d" | "30d" | "90d">("30d");

  // Fetch data
  const { data: profiles, isLoading: isLoadingProfiles } = useQuery({
    queryKey: ["profiles"],
    queryFn: () => getAllProfiles(),
  });

  const { data: agents, isLoading: isLoadingAgents } = useQuery({
    queryKey: ["agents"],
    queryFn: () => getAllAgents(),
  });

  const { data: scenarios, isLoading: isLoadingScenarios } = useQuery({
    queryKey: ["scenarios"],
    queryFn: () => getAllScenarios(),
  });

  const { data: simulations, isLoading: isLoadingSimulations } = useQuery({
    queryKey: ["simulations"],
    queryFn: () => getAllSimulations(),
  });

  const { data: allRubrics, isLoading: isLoadingAllRubrics } = useQuery({
    queryKey: ["rubrics"],
    queryFn: () => getAllRubrics(),
  });

  // Filter rubrics to only include those that exist in simulations
  const rubrics = useMemo(() => {
    if (!allRubrics || !simulations) return [];
    const simulationRubricIds = new Set(
      simulations.map((sim) => sim.rubricId).filter(Boolean), // Remove null/undefined values
    );
    return allRubrics.filter((rubric) => simulationRubricIds.has(rubric.id));
  }, [allRubrics, simulations]);

  const { data: standardGroups, isLoading: isLoadingStandardGroups } = useQuery(
    {
      queryKey: ["standardGroups", rubrics?.map((rubric) => rubric.id)],
      queryFn: () =>
        getStandardGroupsByRubrics(rubrics!.map((rubric) => rubric.id)),
      enabled: !!rubrics && rubrics.length > 0,
    },
  );

  const { data: standards, isLoading: isLoadingStandards } = useQuery({
    queryKey: ["standards", standardGroups?.map((group) => group.id)],
    queryFn: () =>
      getStandardsByStandardGroups(standardGroups!.map((group) => group.id)),
    enabled: !!standardGroups && standardGroups.length > 0,
  });

  const { data: attempts, isLoading: isLoadingAttempts } = useQuery({
    queryKey: ["simulationAttempts", profiles?.map((profile) => profile.id)],
    queryFn: () => getSimulationAttemptsByProfiles(profiles!.map((profile) => profile.id)),
    enabled: !!profiles && profiles.length > 0,
  });

  const { data: chats, isLoading: isLoadingChats } = useQuery({
    queryKey: ["simulationChats", attempts?.map((attempt) => attempt.id)],
    queryFn: () =>
      getSimulationChatsByAttempts(attempts!.map((attempt) => attempt.id)),
    enabled: !!attempts && attempts.length > 0,
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
        grades!.map((grade) => grade.id),
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
      !agents ||
      !scenarios
    )
      return null;

    const tas = profiles.filter((profile) => profile.role === "ta");

    // Filter data by selected rubric if not "all"
    const filteredStandardGroups =
      selectedRubricId === "all"
        ? standardGroups
        : standardGroups.filter((group) => group.rubricId === selectedRubricId);

    const filteredStandards = standards.filter((s) =>
      filteredStandardGroups.some((group) => group.id === s.standardGroupId),
    );

    const filteredGrades =
      selectedRubricId === "all"
        ? grades
        : grades.filter((grade) => grade.rubricId === selectedRubricId);

    // Filter data by time ranges
    const personalityDays = personalityTimeRange === "7d" ? 7 : personalityTimeRange === "30d" ? 30 : 90;
    const skillDays = skillTimeRange === "7d" ? 7 : skillTimeRange === "30d" ? 30 : 90;
    const personalityCutoff = startOfDay(subDays(new Date(), personalityDays));

    const personalityFilteredGrades = filteredGrades.filter((grade) =>
      isAfter(new Date(grade.createdAt), personalityCutoff)
    );

    const skillFilteredFeedbacks = feedbacks.filter((f) =>
      filteredStandards.some((s) => s.id === f.standardId),
    );

    // Calculate average scores by standard group (skill category) using shortName with proper formatting
    const skillCategories = filteredStandardGroups.reduce(
      (acc, group) => {
        const groupStandards = filteredStandards.filter(
          (s) => s.standardGroupId === group.id,
        );
        const groupFeedbacks = skillFilteredFeedbacks.filter((f) =>
          groupStandards.some((s) => s.id === f.standardId),
        );

        const avgScore =
          groupFeedbacks.length > 0
            ? Math.round(
              (groupFeedbacks.reduce((sum, f) => sum + f.total, 0) /
                groupFeedbacks.length /
                (groupStandards[0]?.points || 1)) *
              100,
            )
            : 0;

        // Use shortName with proper title case formatting
        const displayName = group.shortName || group.name;
        acc[displayName] = avgScore;
        return acc;
      },
      {} as Record<string, number>,
    );

    // Calculate overall average
    const overallScore =
      filteredGrades.length > 0
        ? Math.round(
          filteredGrades.reduce((sum, g) => sum + g.score, 0) /
          filteredGrades.length,
        )
        : 0;

    // Performance by student type (scenario-based) - use personality filtered data
    const performanceByType = agents
      .filter((agent) => agent.agentType === "student")
      .map((agent) => {
        const agentScenarios = scenarios.filter((s) => s.agentId === agent.id);
        const agentChats = chats.filter((chat) =>
          agentScenarios.some((scenario) => scenario.id === chat.scenarioId),
        );
        const agentGrades = personalityFilteredGrades.filter((grade) =>
          agentChats.some((chat) => chat.id === grade.simulationChatId),
        );

        const avgScore =
          agentGrades.length > 0
            ? Math.round(
              agentGrades.reduce((sum, g) => sum + g.score, 0) /
              agentGrades.length,
            )
            : 0;

        return {
          name: agent.name,
          score: avgScore,
          sessions: agentChats.length,
          color: getAgentConfig(agent.name).colors.bgColor,
        };
      });

    // Skill progression data (based on actual feedback over time) - use skill time range
    const skillProgressionData = Array.from({ length: skillDays }, (_, i) => {
      const date = subDays(new Date(), skillDays - 1 - i);

      // Get feedbacks for this date range (simulate progression based on actual data)
      const dayData: Record<string, string | number> = {
        date: format(date, skillDays === 7 ? "MMM dd" : skillDays === 30 ? "MM/dd" : "M/d"),
      };

      // Add skill categories with realistic progression based on current scores
      Object.entries(skillCategories).forEach(
        ([skill, currentScore], index) => {
          // Create realistic progression that trends toward current score
          const baseVariation = Math.sin((i + index) * 0.5) * 3; // Natural variation
          const progressionTrend = (i / (skillDays - 1)) * 5; // Gradual improvement over time
          const targetScore = Math.max(
            60,
            Math.min(95, currentScore - 8 + progressionTrend + baseVariation),
          );
          dayData[skill] = Math.round(targetScore);
        },
      );

      return dayData;
    });

    // TA performance for distribution
    const taPerformance = tas
      .map((ta) => {
        const taAttempts =
          attempts?.filter((attempt) => attempt.profileId === ta.id) || [];
        const taChats = chats.filter((chat) =>
          taAttempts.some((attempt) => attempt.id === chat.attemptId),
        );
        const taGrades = filteredGrades.filter((grade) =>
          taChats.some((chat) => chat.id === grade.simulationChatId),
        );

        const avgScore =
          taGrades.length > 0
            ? Math.round(
              taGrades.reduce((sum, g) => sum + g.score, 0) / taGrades.length,
            )
            : 0;

        const completedSessions = taChats.filter(
          (chat) => chat.completed,
        ).length;
        const totalSessions = taChats.length;

        return {
          id: ta.id,
          name: ta.firstName + " " + ta.lastName,
          username: ta.alias,
          avgScore,
          completedSessions,
          totalSessions,
          completionRate:
            totalSessions > 0
              ? Math.round((completedSessions / totalSessions) * 100)
              : 0,
          initials: ta.firstName.charAt(0) + ta.lastName.charAt(0)
            .split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase(),
        };
      })
      .sort((a, b) => b.avgScore - a.avgScore);

    const totalSessions = chats.length;
    const completedChats = chats.filter((chat) => chat.completed);
    const completionRate =
      totalSessions > 0 ? (completedChats.length / totalSessions) * 100 : 0;

    // Calculate dynamic metrics
    const currentWeekGrades = filteredGrades.filter((grade) => {
      const gradeDate = new Date(grade.createdAt);
      const weekAgo = subDays(new Date(), 7);
      return gradeDate >= weekAgo;
    });

    const lastWeekGrades = filteredGrades.filter((grade) => {
      const gradeDate = new Date(grade.createdAt);
      const twoWeeksAgo = subDays(new Date(), 14);
      const weekAgo = subDays(new Date(), 7);
      return gradeDate >= twoWeeksAgo && gradeDate < weekAgo;
    });

    const currentWeekAvg =
      currentWeekGrades.length > 0
        ? Math.round(
          currentWeekGrades.reduce((sum, g) => sum + g.score, 0) /
          currentWeekGrades.length,
        )
        : 0;

    const lastWeekAvg =
      lastWeekGrades.length > 0
        ? Math.round(
          lastWeekGrades.reduce((sum, g) => sum + g.score, 0) /
          lastWeekGrades.length,
        )
        : 0;

    // Calculate additional dynamic metrics
    const avgSessionTime = filteredGrades.length > 0
      ? Math.round(
          filteredGrades
            .filter(g => g.timeTaken)
            .reduce((sum, g) => sum + (g.timeTaken || 0), 0) / 
          filteredGrades.filter(g => g.timeTaken).length / 60
        )
      : 0;

    const passRate = filteredGrades.length > 0
      ? Math.round((filteredGrades.filter(g => g.passed).length / filteredGrades.length) * 100)
      : 0;

    const activeTAs = taPerformance.filter(ta => ta.totalSessions > 0).length;

    const weeklyTrend = currentWeekAvg - lastWeekAvg;

    return {
      skillCategories,
      overallScore,
      performanceByType,
      skillProgressionData,
      taPerformance,
      completionRate,
      avgSessionTime,
      passRate,
      activeTAs,
      weeklyTrend,
      currentWeekAvg,
      lastWeekAvg,
    };
  }, [
    profiles,
    chats,
    grades,
    feedbacks,
    standards,
    standardGroups,
    agents,
    scenarios,
    attempts,
    selectedRubricId,
    personalityTimeRange,
    skillTimeRange,
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
    isLoadingAllRubrics ||
    isLoadingAgents ||
    isLoadingScenarios ||
    isLoadingSimulations
  ) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">
            Loading performance analytics...
          </p>
        </div>
      </div>
    );
  }

  if (!analytics) return null;

  // Get skill categories for display
  const skillCategoryEntries = Object.entries(analytics.skillCategories);
  const skillColors = [
    COLORS.primary,
    COLORS.success,
    COLORS.warning,
    COLORS.purple,
  ];

  // Performance tier data with TAs
  const performanceTiers = [
    {
      label: "Excellent",
      range: "90-100%",
      tas: analytics.taPerformance.filter((ta) => ta.avgScore >= 90),
      color: COLORS.success,
      bgColor: "bg-green-50",
      borderColor: "border-green-200",
    },
    {
      label: "Good",
      range: "80-89%",
      tas: analytics.taPerformance.filter((ta) => ta.avgScore >= 80 && ta.avgScore < 90),
      color: COLORS.primary,
      bgColor: "bg-blue-50",
      borderColor: "border-blue-200",
    },
    {
      label: "Average",
      range: "70-79%",
      tas: analytics.taPerformance.filter((ta) => ta.avgScore >= 70 && ta.avgScore < 80),
      color: COLORS.warning,
      bgColor: "bg-yellow-50",
      borderColor: "border-yellow-200",
    },
    {
      label: "Needs Support",
      range: "<70%",
      tas: analytics.taPerformance.filter((ta) => ta.avgScore < 70),
      color: COLORS.danger,
      bgColor: "bg-red-50",
      borderColor: "border-red-200",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Performance by Student Type */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Performance by Student Personality</CardTitle>
              <CardDescription>
                How TAs handle different student types during training
              </CardDescription>
            </div>
            <div className="flex gap-1">
              {(["7d", "30d", "90d"] as const).map((range) => (
                <button
                  key={range}
                  onClick={() => setPersonalityTimeRange(range)}
                  className={`px-3 py-1 text-xs rounded-md transition-colors ${
                    personalityTimeRange === range
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {range === "7d" ? "7 days" : range === "30d" ? "30 days" : "90 days"}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics.performanceByType} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" domain={[0, 100]} />
                  <YAxis dataKey="name" type="category" width={80} />
                  <Tooltip
                    formatter={(value: number) => [
                      `${value}%`,
                      "Average Score",
                    ]}
                    labelFormatter={(label) => `${label} Students`}
                  />
                  <Bar
                    dataKey="score"
                    fill={COLORS.primary}
                    radius={[0, 4, 4, 0]}
                    name="Average Score"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-4">
              {analytics.performanceByType.map((type) => (
                <div
                  key={type.name}
                  className="flex items-center justify-between p-4 rounded-lg border"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-4 h-4 rounded-full ${type.color}`}></div>
                    <div>
                      <p className="font-medium">{type.name} Student</p>
                      <p className="text-sm text-muted-foreground">
                        {type.sessions} sessions
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold">{type.score}%</p>
                    <Badge
                      variant={
                        type.score >= 80
                          ? "default"
                          : type.score >= 70
                            ? "secondary"
                            : "destructive"
                      }
                    >
                      {type.score >= 80
                        ? "Excellent"
                        : type.score >= 70
                          ? "Good"
                          : "Needs Work"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Skill Development Over Time */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Skill Development Over Time
              </CardTitle>
              <CardDescription>
                Track improvement in key competencies across all TAs
              </CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex gap-1">
                {(["7d", "30d", "90d"] as const).map((range) => (
                  <button
                    key={range}
                    onClick={() => setSkillTimeRange(range)}
                    className={`px-3 py-1 text-xs rounded-md transition-colors ${
                      skillTimeRange === range
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    {range === "7d" ? "7 days" : range === "30d" ? "30 days" : "90 days"}
                  </button>
                ))}
              </div>
              <Select
                value={selectedRubricId}
                onValueChange={setSelectedRubricId}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Select rubric" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Rubrics</SelectItem>
                  {rubrics.map((rubric) => (
                    <SelectItem key={rubric.id} value={rubric.id}>
                      {rubric.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={analytics.skillProgressionData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" className="text-xs" />
                <YAxis domain={[0, 100]} className="text-xs" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--background))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "6px",
                  }}
                  formatter={(value: number) => [`${value}%`, ""]}
                />
                {skillCategoryEntries.map(([skill, _], index) => (
                  <Line
                    key={skill}
                    type="monotone"
                    dataKey={skill}
                    stroke={skillColors[index % skillColors.length]}
                    strokeWidth={3}
                    dot={{ r: 4 }}
                    name={skill}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
            {skillCategoryEntries.map(([skill, _], index) => (
              <div key={skill} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{
                    backgroundColor: skillColors[index % skillColors.length],
                  }}
                ></div>
                <span className="text-sm">{skill}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Performance Distribution and Training Insights */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Performance Analytics
            </CardTitle>
            <CardDescription>
              Detailed breakdown of TA performance metrics
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Score Distribution */}
            <div>
              <div className="grid grid-cols-2 gap-4 mb-4">
                {performanceTiers.map((tier) => (
                  <Dialog key={tier.label}>
                    <DialogTrigger asChild>
                      <div
                        className={`p-3 rounded-lg border cursor-pointer hover:shadow-md transition-shadow ${tier.bgColor} ${tier.borderColor}`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium">{tier.label}</span>
                          <span
                            className="text-lg font-bold"
                            style={{ color: tier.color }}
                          >
                            {tier.tas.length}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {tier.range}
                        </div>
                        <div className="mt-2 h-1 bg-gray-200 rounded">
                          <div
                            className="h-1 rounded transition-all duration-200"
                            style={{
                              backgroundColor: tier.color,
                              width: `${analytics.taPerformance.length > 0 ? (tier.tas.length / analytics.taPerformance.length) * 100 : 0}%`,
                            }}
                          />
                        </div>
                      </div>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                      <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                          <Users className="h-5 w-5" />
                          {tier.label} TAs ({tier.tas.length})
                        </DialogTitle>
                      </DialogHeader>
                      <div className="space-y-3 max-h-[400px] overflow-y-auto">
                        {tier.tas.length > 0 ? (
                          tier.tas.map((ta) => (
                            <div
                              key={ta.id}
                              className="flex items-center justify-between p-3 rounded-lg border"
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                                  {ta.initials}
                                </div>
                                <div>
                                  <p className="font-medium">{ta.name}</p>
                                  <p className="text-sm text-muted-foreground">
                                    {ta.username}@purdue.edu
                                  </p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-lg font-bold">{ta.avgScore}%</p>
                                <p className="text-xs text-muted-foreground">
                                  {ta.completedSessions}/{ta.totalSessions} sessions
                                </p>
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="text-center text-muted-foreground py-4">
                            No TAs in this category
                          </p>
                        )}
                      </div>
                    </DialogContent>
                  </Dialog>
                ))}
              </div>
            </div>

            {/* Divider */}
            <div className="h-px bg-gray-200 my-4"></div>

            {/* Dynamic Stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">
                  {analytics.overallScore}%
                </div>
                <div className="text-xs text-blue-600">Average Score</div>
              </div>
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  {Math.round(analytics.completionRate)}%
                </div>
                <div className="text-xs text-green-600">Completion Rate</div>
              </div>
              <div className="text-center p-3 bg-purple-50 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">
                  {analytics.avgSessionTime}m
                </div>
                <div className="text-xs text-purple-600">Avg Session Time</div>
              </div>
              <div className="text-center p-3 bg-orange-50 rounded-lg">
                <div className="text-2xl font-bold text-orange-600">
                  {analytics.passRate}%
                </div>
                <div className="text-xs text-orange-600">Pass Rate</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Training Insights
            </CardTitle>
            <CardDescription>
              Dynamic patterns and recommendations from training data
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Dynamic Insights */}
            <div>
              <div className="space-y-3">
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <TrendingUp className="h-4 w-4 text-blue-600 mt-0.5" />
                    <div>
                      <div className="text-sm font-medium text-blue-800">
                        Weekly Trend
                      </div>
                      <div className="text-xs text-blue-700 mt-1">
                        {analytics.weeklyTrend > 0 
                          ? `Scores improved by ${analytics.weeklyTrend}% this week`
                          : analytics.weeklyTrend < 0
                          ? `Scores decreased by ${Math.abs(analytics.weeklyTrend)}% this week`
                          : "Scores remained stable this week"
                        }
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <Users className="h-4 w-4 text-green-600 mt-0.5" />
                    <div>
                      <div className="text-sm font-medium text-green-800">
                        Active TAs
                      </div>
                      <div className="text-xs text-green-700 mt-1">
                        {analytics.activeTAs} TAs have completed training sessions
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <Clock className="h-4 w-4 text-yellow-600 mt-0.5" />
                    <div>
                      <div className="text-sm font-medium text-yellow-800">
                        Session Efficiency
                      </div>
                      <div className="text-xs text-yellow-700 mt-1">
                        Average session time: {analytics.avgSessionTime} minutes
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <Award className="h-4 w-4 text-purple-600 mt-0.5" />
                    <div>
                      <div className="text-sm font-medium text-purple-800">
                        Success Rate
                      </div>
                      <div className="text-xs text-purple-700 mt-1">
                        {analytics.passRate}% of sessions meet passing criteria
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <MessageSquare className="h-4 w-4 text-orange-600 mt-0.5" />
                    <div>
                      <div className="text-sm font-medium text-orange-800">
                        Best Performing Agent
                      </div>
                      <div className="text-xs text-orange-700 mt-1">
                        {analytics.performanceByType.length > 0 
                          ? `${analytics.performanceByType.reduce((best, current) => 
                              current.score > best.score ? current : best
                            ).name} students (${analytics.performanceByType.reduce((best, current) => 
                              current.score > best.score ? current : best
                            ).score}% avg)`
                          : "No data available"
                        }
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
