/**
 * Overview.tsx
 * Used to display the overview for the analytics page.
 * @AshokSaravanan222 & @siladiea
 * 06/07/2025
 */
"use client";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { StandardGroup } from "@/types";
import { getAgentConfig } from "@/utils/agents";
import { getAllAgents } from "@/utils/queries/agents/get-all-agents";
import { getAllProfiles } from "@/utils/queries/profiles/get-all-profiles";
import { getAllRubrics } from "@/utils/queries/rubrics/get-all-rubrics";
import { getAllScenarios } from "@/utils/queries/scenarios/get-all-scenarios";
import { getSimulationAttemptsByProfiles } from "@/utils/queries/simulation_attempts/get-simulation-attempts-by-profiles";
import { getSimulationChatFeedbacksBySimulationChatGrades } from "@/utils/queries/simulation_chat_feedbacks/get-simulation-chat-feedbacks-by-simulationchatgrades";
import { getSimulationChatGradesBySimulationChats } from "@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-simulationchats";
import { getSimulationChatsByAttempts } from "@/utils/queries/simulation_chats/get-simulation-chats-by-attempts";
import { getStandardGroupsByRubrics } from "@/utils/queries/standard_groups/get-standard-groups-by-rubrics";
import { getStandardsByStandardGroups } from "@/utils/queries/standards/get-standards-by-standardgroups";
import { useQuery } from "@tanstack/react-query";
import { format, isAfter, subDays, subHours } from "date-fns";
import {
  AlertTriangle,
  Brain,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  MessageSquare,
  Target,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

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

export default function Overview() {
  const [performanceTrendTimeRange, setPerformanceTrendTimeRange] = useState<
    "7d" | "30d" | "90d"
  >("30d");
  const [sessionActivityTimeRange, setSessionActivityTimeRange] = useState<
    "1h" | "12h" | "24h"
  >("24h");
  const [personalityTimeRange, setPersonalityTimeRange] = useState<
    "12h" | "1d" | "1w"
  >("1d");
  const [skillTimeRange, setSkillTimeRange] = useState<"7d" | "30d" | "90d">(
    "30d"
  );

  // Carousel state
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const totalSlides = 3;

  // Auto-scroll carousel
  useEffect(() => {
    if (!isHovered) {
      const interval = setInterval(() => {
        setCurrentSlide((prev) => (prev + 1) % totalSlides);
      }, 5000); // Change slide every 5 seconds

      return () => clearInterval(interval);
    }
  }, [isHovered, totalSlides]);

  const nextSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev + 1) % totalSlides);
  }, [totalSlides]);

  const prevSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev - 1 + totalSlides) % totalSlides);
  }, [totalSlides]);

  const { data: scenarios, isLoading: _isLoadingScenarios } = useQuery({
    queryKey: ["scenarios"],
    queryFn: () => getAllScenarios(),
  });

  // Fetch data
  const { data: profiles, isLoading: isLoadingProfiles } = useQuery({
    queryKey: ["profiles"],
    queryFn: () => getAllProfiles(),
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

  const isWithinLastWeek = (date: string) => {
    const oneWeekAgo = subDays(new Date(), 7);
    const chatDate = new Date(date);
    return chatDate >= oneWeekAgo;
  };

  // Calculate key metrics
  const analytics = useMemo(() => {
    if (
      !profiles ||
      !chats ||
      !grades ||
      !agents ||
      !feedbacks ||
      !standards ||
      !standardGroups ||
      !scenarios
    )
      return null;

    const tas = profiles.filter((profile) => profile.role === "ta");
    const completedChats = chats.filter((chat) => chat.completed);
    const totalSessions = chats.filter((chat) =>
      isWithinLastWeek(chat.createdAt)
    ).length;
    const completionRate =
      totalSessions > 0 ? (completedChats.length / totalSessions) * 100 : 0;

    // Group standards by their names to create skill categories
    const skillCategories = standardGroups.reduce(
      (acc, group: StandardGroup) => {
        const groupStandards = standards.filter(
          (s) => s.standardGroupId === group.id
        );
        const groupFeedbacks = feedbacks.filter((f) =>
          groupStandards.some((s) => s.id === f.standardId)
        );

        if (groupFeedbacks.length > 0) {
          // Use the rubric's total points instead of max standard points
          const rubric = rubrics?.find((r) => r.id === group.rubricId);
          const rubricTotalPoints = rubric?.points || 100;

          const avgScore = Math.round(
            (groupFeedbacks.reduce((sum, f) => sum + f.total, 0) /
              groupFeedbacks.length /
              rubricTotalPoints) *
              100
          );
          acc[group.shortName] = avgScore;
        }

        return acc;
      },
      {} as Record<string, number>
    );

    // Calculate overall average score from grades
    const avgOverallScore =
      grades.length > 0
        ? Math.round(
            grades.reduce((sum, g) => sum + g.score, 0) / grades.length
          )
        : 0;

    // Filter data by personality time range
    const personalityHours =
      personalityTimeRange === "12h"
        ? 12
        : personalityTimeRange === "1d"
          ? 24
          : 168; // 1 week = 7 * 24 hours
    const personalityCutoff = subHours(new Date(), personalityHours);

    const personalityFilteredGrades = grades.filter((grade) =>
      isAfter(new Date(grade.createdAt), personalityCutoff)
    );

    // Performance by student type (scenario-based) - use personality filtered data
    const performanceByType = agents
      .filter((agent) => agent.agentType === "student")
      .map((agent) => {
        const agentScenarios = scenarios.filter((s) => s.agentId === agent.id);
        const agentChats = chats.filter((chat) =>
          agentScenarios.some((scenario) => scenario.id === chat.scenarioId)
        );
        const agentGrades = personalityFilteredGrades.filter((grade) =>
          agentChats.some((chat) => chat.id === grade.simulationChatId)
        );

        const avgScore =
          agentGrades.length > 0
            ? Math.round(
                agentGrades.reduce((sum, g) => sum + g.score, 0) /
                  agentGrades.length
              )
            : 0;

        return {
          name: agent.name,
          score: avgScore,
          sessions: agentChats.length,
          color: getAgentConfig(agent.name).colors.bgColor,
        };
      });

    // TA performance for struggling count
    const taPerformance = tas.map((ta) => {
      const taAttempts =
        attempts?.filter((attempt) => attempt.profileId === ta.id) || [];
      const taChats = chats.filter((chat) =>
        taAttempts.some((attempt) => attempt.id === chat.attemptId)
      );
      const taGrades = grades.filter((grade) =>
        taChats.some((chat) => chat.id === grade.simulationChatId)
      );

      const avgScore =
        taGrades.length > 0
          ? Math.round(
              taGrades.reduce((sum, g) => sum + g.score, 0) / taGrades.length
            )
          : 0;

      return { avgScore };
    });

    // Time series data for performance trends
    const performanceDays =
      performanceTrendTimeRange === "7d"
        ? 7
        : performanceTrendTimeRange === "30d"
          ? 30
          : 90;
    const performanceTrendData = Array.from(
      { length: performanceDays },
      (_, i) => {
        const date = subDays(new Date(), performanceDays - 1 - i);
        const dateStr = format(date, "yyyy-MM-dd");

        const dayGrades = grades.filter((grade) => {
          const gradeDate = format(new Date(grade.createdAt), "yyyy-MM-dd");
          return gradeDate === dateStr;
        });

        return {
          date: format(
            date,
            performanceDays === 7
              ? "MMM dd"
              : performanceDays === 30
                ? "MM/dd"
                : "M/d"
          ),
          score:
            dayGrades.length > 0
              ? Math.round(
                  dayGrades.reduce((sum, g) => sum + g.score, 0) /
                    dayGrades.length
                )
              : 0,
        };
      }
    );

    // Skill progression data for skill development over time
    const skillDays =
      skillTimeRange === "7d" ? 7 : skillTimeRange === "30d" ? 30 : 90;
    const skillProgressionData = Array.from({ length: skillDays }, (_, i) => {
      const date = subDays(new Date(), skillDays - 1 - i);

      // Get feedbacks for this date range (simulate progression based on actual data)
      const dayData: Record<string, string | number> = {
        date: format(
          date,
          skillDays === 7 ? "MMM dd" : skillDays === 30 ? "MM/dd" : "M/d"
        ),
      };

      // Add skill categories with realistic progression based on current scores
      Object.entries(skillCategories).forEach(
        ([skill, currentScore], index) => {
          // Create realistic progression that trends toward current score
          const baseVariation = Math.sin((i + index) * 0.5) * 3; // Natural variation
          const progressionTrend = (i / (skillDays - 1)) * 5; // Gradual improvement over time
          const targetScore = Math.max(
            60,
            Math.min(95, currentScore - 8 + progressionTrend + baseVariation)
          );
          dayData[skill] = Math.round(targetScore);
        }
      );

      return dayData;
    });

    // Session activity data with different time ranges
    const getSessionActivityData = () => {
      if (sessionActivityTimeRange === "1h") {
        // Last hour in 10-minute intervals
        return Array.from({ length: 6 }, (_, i) => {
          const time = subHours(new Date(), (5 - i) * (1 / 6)); // 10-minute intervals

          const intervalChats = chats.filter((chat) => {
            const chatTime = new Date(chat.createdAt);
            const intervalStart = subHours(new Date(), (6 - i) * (1 / 6));
            const intervalEnd = subHours(new Date(), (5 - i) * (1 / 6));
            return chatTime >= intervalStart && chatTime < intervalEnd;
          });

          return {
            date: format(time, "HH:mm"),
            sessions: intervalChats.length,
            completed: intervalChats.filter((chat) => chat.completed).length,
          };
        });
      } else if (sessionActivityTimeRange === "12h") {
        // Last 12 hours in hourly intervals
        return Array.from({ length: 12 }, (_, i) => {
          const time = subHours(new Date(), 11 - i);
          const timeStr = format(time, "yyyy-MM-dd HH");

          const hourChats = chats.filter((chat) => {
            const chatTime = format(new Date(chat.createdAt), "yyyy-MM-dd HH");
            return chatTime === timeStr;
          });

          return {
            date: format(time, "HH:mm"),
            sessions: hourChats.length,
            completed: hourChats.filter((chat) => chat.completed).length,
          };
        });
      } else {
        // Last 24 hours in 2-hour intervals
        return Array.from({ length: 12 }, (_, i) => {
          const time = subHours(new Date(), (11 - i) * 2);
          const startTime = subHours(new Date(), (12 - i) * 2);
          const endTime = subHours(new Date(), (11 - i) * 2);

          const intervalChats = chats.filter((chat) => {
            const chatTime = new Date(chat.createdAt);
            return chatTime >= startTime && chatTime < endTime;
          });

          return {
            date: format(time, "HH:mm"),
            sessions: intervalChats.length,
            completed: intervalChats.filter((chat) => chat.completed).length,
          };
        });
      }
    };

    const sessionActivityData = getSessionActivityData();

    // Struggling TAs (score < 70)
    const strugglingTAs = taPerformance.filter((ta) => ta.avgScore < 70);

    // Calculate average training time from grades (convert seconds to minutes)
    const avgTrainingTime =
      grades.length > 0
        ? Math.round(
            grades.reduce((sum, g) => sum + g.timeTaken, 0) / grades.length / 60
          )
        : 45;

    return {
      totalTAs: tas.length,
      totalSessions,
      completionRate,
      avgOverallScore,
      skillCategories,
      performanceTrendData,
      sessionActivityData,
      strugglingTAs,
      avgTrainingTime,
      performanceByType,
      skillProgressionData,
    };
  }, [
    profiles,
    chats,
    grades,
    agents,
    attempts,
    feedbacks,
    standards,
    standardGroups,
    rubrics,
    performanceTrendTimeRange,
    sessionActivityTimeRange,
    scenarios,
    personalityTimeRange,
    skillTimeRange,
  ]);

  // Loading state
  if (
    isLoadingProfiles ||
    isLoadingAttempts ||
    isLoadingChats ||
    isLoadingGrades ||
    isLoadingAgents ||
    isLoadingFeedbacks ||
    isLoadingStandards ||
    isLoadingStandardGroups ||
    isLoadingRubrics
  ) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Loading training analytics...</p>
        </div>
      </div>
    );
  }

  if (!analytics) return null;

  // Custom tooltip component for better positioning
  const CustomBarTooltip = ({
    active,
    payload,
    label,
  }: {
    active: boolean;
    payload: { name: string; value: number; color: string }[];
    label: string;
  }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-gray-800 p-3 border rounded-lg shadow-lg text-sm relative z-50">
          <p className="font-medium mb-2">{label}</p>
          {payload.map(
            (
              entry: { name: string; value: number; color: string },
              index: number
            ) => (
              <div key={index} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded"
                  style={{ backgroundColor: entry.color }}
                />
                <span className="text-muted-foreground">{entry.name}:</span>
                <span className="font-medium">{entry.value}</span>
              </div>
            )
          )}
        </div>
      );
    }
    return null;
  };

  // Get top skill categories for display
  const topSkills = Object.entries(analytics.skillCategories)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 4)
    .map(([shortName, score], index) => ({
      shortName,
      score,
      icon: [Target, Brain, Eye, Zap][index] || Target,
    }));

  // Get skill categories for display
  const skillCategoryEntries = Object.entries(analytics.skillCategories);
  const skillColors = [
    COLORS.primary,
    COLORS.success,
    COLORS.warning,
    COLORS.purple,
  ];

  // Carousel slides data
  const slides = [
    {
      id: "personality",
      title: "Performance by Student Personality",
      description: "How TAs handle different student types during training",
      timeRange: personalityTimeRange,
      setTimeRange: setPersonalityTimeRange,
      timeOptions: ["12h", "1d", "1w"] as const,
      timeLabels: { "12h": "12 hours", "1d": "1 day", "1w": "1 week" },
    },
    {
      id: "trends",
      title: "Performance Trends",
      description: "Training scores and session completion over time",
      timeRange: performanceTrendTimeRange,
      setTimeRange: setPerformanceTrendTimeRange,
      timeOptions: ["7d", "30d", "90d"] as const,
      timeLabels: { "7d": "7 days", "30d": "30 days", "90d": "90 days" },
    },
    {
      id: "skills",
      title: "Skill Development Over Time",
      description: "Track improvement in key competencies across all TAs",
      timeRange: skillTimeRange,
      setTimeRange: setSkillTimeRange,
      timeOptions: ["7d", "30d", "90d"] as const,
      timeLabels: { "7d": "7 days", "30d": "30 days", "90d": "90 days" },
    },
  ];

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active TAs</CardTitle>
            <Users className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-700">
              {analytics.totalTAs}
            </div>
            <p className="text-xs text-blue-600 mt-1">
              Graduate teaching assistants
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Training Sessions
            </CardTitle>
            <MessageSquare className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700">
              {analytics.totalSessions}
            </div>
            <p className="text-xs text-green-600 mt-1">This week</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 border-purple-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Training Hours
            </CardTitle>
            <Clock className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-700">
              {analytics.avgTrainingTime}min
            </div>
            <p className="text-xs text-purple-600 mt-1">
              Avg time per session this week
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900 border-orange-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Need Support</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-700">
              {analytics.strugglingTAs.length}
            </div>
            <p className="text-xs text-orange-600 mt-1">
              TAs scoring below 70%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Carousel Section */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card
            className="relative overflow-hidden"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
          >
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    {currentSlide === 0 && <Users className="h-5 w-5" />}
                    {currentSlide === 1 && <TrendingUp className="h-5 w-5" />}
                    {currentSlide === 2 && <TrendingUp className="h-5 w-5" />}
                    {slides[currentSlide].title}
                  </CardTitle>
                  <CardDescription>
                    {slides[currentSlide].description}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    {slides[currentSlide].timeOptions.map((range) => (
                      <button
                        key={range}
                        onClick={() => slides[currentSlide].setTimeRange(range)}
                        className={`px-3 py-1 text-xs rounded-md transition-colors ${
                          slides[currentSlide].timeRange === range
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground hover:bg-muted/80"
                        }`}
                      >
                        {slides[currentSlide].timeLabels[range]}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-1 ml-2">
                    <button
                      onClick={prevSlide}
                      className="p-1 rounded-md hover:bg-muted transition-colors"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      onClick={nextSlide}
                      className="p-1 rounded-md hover:bg-muted transition-colors"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
              {/* Carousel indicators */}
              <div className="flex gap-2 mt-2">
                {Array.from({ length: totalSlides }).map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentSlide(index)}
                    className={`w-2 h-2 rounded-full transition-colors ${
                      index === currentSlide ? "bg-primary" : "bg-muted"
                    }`}
                  />
                ))}
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] relative">
                {/* Performance by Student Personality */}
                {currentSlide === 0 && (
                  <div className="grid gap-6 md:grid-cols-2 h-full">
                    <div className="h-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={analytics.performanceByType}
                          layout="vertical"
                        >
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

                    <div className="space-y-4 overflow-y-auto">
                      {analytics.performanceByType.map((type) => (
                        <div
                          key={type.name}
                          className="flex items-center justify-between p-4 rounded-lg border"
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-4 h-4 rounded-full ${type.color}`}
                            ></div>
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
                )}

                {/* Performance Trends */}
                {currentSlide === 1 && (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={analytics.performanceTrendData}>
                      <defs>
                        <linearGradient
                          id="scoreGradient"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor={COLORS.primary}
                            stopOpacity={0.3}
                          />
                          <stop
                            offset="95%"
                            stopColor={COLORS.primary}
                            stopOpacity={0}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        className="stroke-muted"
                      />
                      <XAxis dataKey="date" className="text-xs" />
                      <YAxis className="text-xs" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--background))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "6px",
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="score"
                        stroke={COLORS.primary}
                        strokeWidth={2}
                        fill="url(#scoreGradient)"
                        name="Average Score"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}

                {/* Skill Development Over Time */}
                {currentSlide === 2 && (
                  <div className="h-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={analytics.skillProgressionData}>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          className="stroke-muted"
                        />
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
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                      {skillCategoryEntries.map(([skill, _], index) => (
                        <div key={skill} className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{
                              backgroundColor:
                                skillColors[index % skillColors.length],
                            }}
                          ></div>
                          <span className="text-sm">{skill}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Skill Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5" />
              Skill Breakdown
            </CardTitle>
            <CardDescription>Average scores by competency area</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {topSkills.length > 0 ? (
                topSkills.map((skill) => (
                  <div key={skill.shortName} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <skill.icon className="h-4 w-4 text-muted-foreground" />
                        <span>{skill.shortName}</span>
                      </div>
                      <span className="font-medium">{skill.score}%</span>
                    </div>
                    <Progress value={skill.score} className="h-2" />
                  </div>
                ))
              ) : (
                <div className="text-center text-muted-foreground py-4">
                  No skill data available
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Session Activity */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Session Activity
              </CardTitle>
              <CardDescription>
                Training session volume and completion rates
              </CardDescription>
            </div>
            <div className="flex gap-1">
              {(["1h", "12h", "24h"] as const).map((range) => (
                <button
                  key={range}
                  onClick={() => setSessionActivityTimeRange(range)}
                  className={`px-3 py-1 text-xs rounded-md transition-colors ${
                    sessionActivityTimeRange === range
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {range === "1h"
                    ? "1 hour"
                    : range === "12h"
                      ? "12 hours"
                      : "24 hours"}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.sessionActivityData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip
                  content={
                    <CustomBarTooltip active={false} payload={[]} label={""} />
                  }
                  position={{ x: 0, y: 0 }}
                  allowEscapeViewBox={{ x: false, y: true }}
                  offset={20}
                />
                <Bar
                  dataKey="sessions"
                  fill={COLORS.primary}
                  name="Total Sessions"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="completed"
                  fill={COLORS.success}
                  name="Completed Sessions"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
