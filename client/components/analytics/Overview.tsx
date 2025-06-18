/**
 * Dashboard.tsx (renamed from Overview.tsx)
 * Used to display the main dashboard for the analytics page.
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
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Progress } from "@/components/ui/progress";
import { getAllCohorts } from "@/utils/queries/cohorts/get-all-cohorts";
import { getAllProfiles } from "@/utils/queries/profiles/get-all-profiles";
import { getAllRubrics } from "@/utils/queries/rubrics/get-all-rubrics";
import { getSimulationAttemptsByProfiles } from "@/utils/queries/simulation_attempts/get-simulation-attempts-by-profiles";
import { getSimulationChatFeedbacksBySimulationChatGrades } from "@/utils/queries/simulation_chat_feedbacks/get-simulation-chat-feedbacks-by-simulationchatgrades";
import { getSimulationChatGradesBySimulationChats } from "@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-simulationchats";
import { getSimulationChatsByAttempts } from "@/utils/queries/simulation_chats/get-simulation-chats-by-attempts";
import { getStandardGroupsByRubrics } from "@/utils/queries/standard_groups/get-standard-groups-by-rubrics";
import { getStandardsByStandardGroups } from "@/utils/queries/standards/get-standards-by-standardgroups";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Clock,
  MessageSquare,
  TrendingUp,
  Users,
} from "lucide-react";
import { useMemo } from "react";
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  RadialBar,
  RadialBarChart,
} from "recharts";

const radarChartConfig = {
  score: {
    label: "Performance Score",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

const radialChartConfig = {
  progress: {
    label: "Progress",
    color: "var(--chart-2)",
  },
  completed: {
    label: "Completed",
    color: "var(--chart-3)",
  },
} satisfies ChartConfig;

export default function Dashboard() {
  // Fetch data
  const { data: profiles, isLoading: isLoadingProfiles } = useQuery({
    queryKey: ["profiles"],
    queryFn: () => getAllProfiles(),
  });

  const { data: cohorts, isLoading: isLoadingCohorts } = useQuery({
    queryKey: ["cohorts"],
    queryFn: () => getAllCohorts(),
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

  // Calculate radar chart data (skill development)
  const radarData = useMemo(() => {
    if (!grades || !feedbacks || !standards || !standardGroups || !rubrics)
      return [];

    if (grades.length === 0) return [];

    // Calculate overall score from grades - normalize to percentage based on rubric total points
    const rubric = rubrics?.find((r) =>
      standardGroups?.some((sg) => sg.rubricId === r.id)
    );
    const rubricTotalPoints = rubric?.points || 20;

    const avgScore = Math.round(
      (grades.reduce((sum, grade) => sum + grade.score, 0) /
        grades.length /
        rubricTotalPoints) *
        100
    );

    // Calculate skill-based scores from feedbacks and standards using rubric total points
    const skillScores = standardGroups.reduce(
      (acc, group) => {
        const groupStandards = standards.filter(
          (s) => s.standardGroupId === group.id
        );
        const groupFeedbacks = feedbacks.filter((f) =>
          groupStandards.some((s) => s.id === f.standardId)
        );

        if (groupFeedbacks.length > 0) {
          const rubric = rubrics?.find((r) => r.id === group.rubricId);
          const rubricTotalPoints = rubric?.points || 20;

          const avgScore = Math.round(
            (groupFeedbacks.reduce((sum, f) => sum + f.total, 0) /
              groupFeedbacks.length /
              rubricTotalPoints) *
              100
          );
          acc[group.name.toLowerCase().replace(/\s+/g, "")] = avgScore;
        }

        return acc;
      },
      {} as Record<string, number>
    );

    // Calculate time management score from grades (inverse of time taken, normalized)
    const avgTimeTaken =
      grades.reduce((sum, grade) => sum + grade.timeTaken, 0) / grades.length;
    const timeManagementScore = Math.max(
      0,
      Math.min(100, 100 - avgTimeTaken / 3600)
    ); // Normalize based on hours

    // Calculate engagement score based on interaction frequency and completion
    const completedChats = chats?.filter((chat) => chat.completed).length || 0;
    const totalChats = chats?.length || 0;
    const engagementScore =
      totalChats > 0 ? Math.round((completedChats / totalChats) * 100) : 0;

    // Create dynamic metrics based on actual standard groups
    const dynamicMetrics = [
      {
        metric: "Overall Score",
        value: avgScore,
        fullMark: 100,
      },
    ];

    // Add skill scores based on actual standard groups
    standardGroups.forEach((group) => {
      const skillKey = group.name.toLowerCase().replace(/\s+/g, "");
      const skillValue = skillScores[skillKey] || 0;
      dynamicMetrics.push({
        metric: group.shortName || group.name,
        value: skillValue,
        fullMark: 100,
      });
    });

    // Add calculated metrics
    dynamicMetrics.push(
      {
        metric: "Time Management",
        value: Math.round(timeManagementScore),
        fullMark: 100,
      },
      {
        metric: "Engagement",
        value: engagementScore,
        fullMark: 100,
      }
    );

    return dynamicMetrics;
  }, [grades, feedbacks, standards, standardGroups, chats, rubrics]);

  // Calculate radial chart data (cohort progress)
  const radialData = useMemo(() => {
    if (!cohorts || !profiles || !attempts) return [];

    return cohorts.map((cohort) => {
      // Filter profiles that belong to this cohort
      const cohortProfiles = profiles.filter((profile) =>
        cohort.profileIds.includes(profile.id)
      );

      // Calculate completion rate for this cohort
      const cohortAttempts = attempts.filter((attempt) =>
        cohortProfiles.some((profile) => profile.id === attempt.profileId)
      );

      const completedAttempts = cohortAttempts.filter((attempt) => {
        const attemptChats = chats?.filter(
          (chat) => chat.attemptId === attempt.id
        );
        return attemptChats?.some((chat) => chat.completed);
      });

      const progressPercentage =
        cohortAttempts.length > 0
          ? Math.round((completedAttempts.length / cohortAttempts.length) * 100)
          : 0;

      return {
        name: cohort.title,
        progress: progressPercentage,
        completed: completedAttempts.length,
        total: cohortAttempts.length,
        fill: `var(--chart-${(cohorts.indexOf(cohort) % 5) + 1})`,
      };
    });
  }, [cohorts, profiles, attempts, chats]);

  // Calculate key metrics
  const analytics = useMemo(() => {
    if (!profiles || !chats || !grades) return null;

    const tas = profiles.filter((profile) => profile.role === "ta");
    const completedChats = chats.filter((chat) => chat.completed);
    const totalSessions = chats.length;
    const completionRate =
      totalSessions > 0 ? (completedChats.length / totalSessions) * 100 : 0;

    // Calculate average training time from grades (convert seconds to minutes)
    const avgTrainingTime =
      grades.length > 0
        ? Math.round(
            grades.reduce((sum, g) => sum + g.timeTaken, 0) / grades.length / 60
          )
        : 45;

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

    // Struggling TAs (score < 70)
    const strugglingTAs = taPerformance.filter((ta) => ta.avgScore < 70);

    return {
      totalTAs: tas.length,
      totalSessions,
      completionRate,
      avgTrainingTime,
      strugglingTAs,
    };
  }, [profiles, chats, grades, attempts]);

  // Calculate growth trend
  const growthTrend = useMemo(() => {
    if (!grades || grades.length < 2 || !rubrics || !standardGroups)
      return { value: 0, isPositive: true };

    // Get the rubric total points dynamically
    const rubric = rubrics?.find((r) =>
      standardGroups?.some((sg) => sg.rubricId === r.id)
    );
    const rubricTotalPoints = rubric?.points || 20;

    // Sort grades by creation date
    const sortedGrades = [...grades].sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    const recentCount = Math.min(5, Math.floor(sortedGrades.length / 2));
    const recent = sortedGrades.slice(-recentCount);
    const previous = sortedGrades.slice(0, recentCount);

    if (previous.length === 0) return { value: 0, isPositive: true };

    // Normalize scores to percentage based on rubric total points
    const recentAvg =
      (recent.reduce((sum, g) => sum + g.score, 0) /
        recent.length /
        rubricTotalPoints) *
      100;
    const previousAvg =
      (previous.reduce((sum, g) => sum + g.score, 0) /
        previous.length /
        rubricTotalPoints) *
      100;

    const change = Math.round(((recentAvg - previousAvg) / previousAvg) * 100);
    return { value: Math.abs(change), isPositive: change >= 0 };
  }, [grades, rubrics, standardGroups]);

  // Loading state
  if (
    isLoadingProfiles ||
    isLoadingCohorts ||
    isLoadingAttempts ||
    isLoadingChats ||
    isLoadingGrades ||
    isLoadingFeedbacks ||
    isLoadingStandards ||
    isLoadingStandardGroups ||
    isLoadingRubrics
  ) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!analytics) return null;

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
            <p className="text-xs text-green-600 mt-1">Total completed</p>
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
              Average session duration
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

      {/* Main Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Radar Chart - Skill Development */}
        <Card>
          <CardHeader className="items-center">
            <CardTitle>Skill Development</CardTitle>
            <CardDescription>
              Performance across key teaching competencies
            </CardDescription>
          </CardHeader>
          <CardContent className="pb-0">
            <ChartContainer
              config={radarChartConfig}
              className="mx-auto aspect-square max-h-[400px]"
            >
              <RadarChart data={radarData}>
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent />}
                />
                <PolarAngleAxis dataKey="metric" />
                <PolarGrid />
                <Radar
                  dataKey="value"
                  fill="var(--color-score)"
                  fillOpacity={0.6}
                  dot={{
                    r: 4,
                    fillOpacity: 1,
                  }}
                />
              </RadarChart>
            </ChartContainer>
          </CardContent>
          {radarData.length > 0 && (
            <CardContent className="flex-col gap-2 text-sm">
              <div className="flex items-center gap-2 leading-none font-medium">
                {growthTrend.isPositive ? "Trending up" : "Needs attention"}
                {growthTrend.value > 0 && ` by ${growthTrend.value}%`}
                <TrendingUp
                  className={`h-4 w-4 ${growthTrend.isPositive ? "" : "rotate-180"}`}
                />
              </div>
              <div className="text-muted-foreground flex items-center gap-2 leading-none">
                Based on recent training sessions
              </div>
            </CardContent>
          )}
        </Card>

        {/* Radial Chart - Cohort Progress */}
        <Card>
          <CardHeader className="items-center">
            <CardTitle>Cohort Progress</CardTitle>
            <CardDescription>
              Training completion rates across different cohorts
            </CardDescription>
          </CardHeader>
          <CardContent className="pb-0">
            <ChartContainer
              config={radialChartConfig}
              className="mx-auto aspect-square max-h-[400px]"
            >
              <RadialBarChart
                data={radialData}
                startAngle={-90}
                endAngle={270}
                innerRadius={30}
                outerRadius={110}
              >
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent hideLabel nameKey="name" />}
                />
                <PolarRadiusAxis tick={false} tickLine={false} axisLine={false}>
                  {/* <Label
                    content={({ viewBox }) => {
                      if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                        return (
                          <text
                            x={viewBox.cx}
                            y={viewBox.cy}
                            textAnchor="middle"
                            dominantBaseline="middle"
                          >
                            <tspan
                              x={viewBox.cx}
                              y={viewBox.cy}
                              className="fill-foreground text-4xl font-bold"
                            >
                              {radialData.reduce((acc, curr) => acc + curr.completed, 0)}
                            </tspan>
                            <tspan
                              x={viewBox.cx}
                              y={(viewBox.cy || 0) + 24}
                              className="fill-muted-foreground"
                            >
                              Completed
                            </tspan>
                          </text>
                        );
                      }
                    }}
                  /> */}
                </PolarRadiusAxis>
                <RadialBar
                  dataKey="progress"
                  background
                  cornerRadius={10}
                  fill="var(--color-progress)"
                />
              </RadialBarChart>
            </ChartContainer>
          </CardContent>
          {radialData.length > 0 && (
            <CardContent className="space-y-3">
              {radialData.map((cohort) => (
                <div
                  key={cohort.name}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: cohort.fill }}
                    />
                    <span className="text-sm font-medium">{cohort.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Progress value={cohort.progress} className="w-16 h-2" />
                    <span className="text-sm text-muted-foreground w-12">
                      {cohort.progress}%
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {cohort.completed}/{cohort.total}
                    </Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}
