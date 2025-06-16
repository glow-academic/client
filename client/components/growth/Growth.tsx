/**
 * Growth.tsx
 * Used to display the growth page.
 * @AshokSaravanan222 & @siladiea
 * 06/07/2025
 */
"use client";
import { useQuery } from "@tanstack/react-query";
import {
  Brain,
  Clock,
  MessageSquare,
  Target,
  TrendingUp,
  User,
} from "lucide-react";
import { useMemo } from "react";
import { PolarAngleAxis, PolarGrid, Radar, RadarChart } from "recharts";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { getProfilesByUser } from "@/utils/queries/profiles/get-profiles-by-user";
import { getAllRubrics } from "@/utils/queries/rubrics/get-all-rubrics";
import { getSimulationAttemptsByProfile } from "@/utils/queries/simulation_attempts/get-simulation-attempts-by-profile";
import { getSimulationChatFeedbacksBySimulationChatGrades } from "@/utils/queries/simulation_chat_feedbacks/get-simulation-chat-feedbacks-by-simulationchatgrades";
import { getSimulationChatGradesBySimulationChats } from "@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-simulationchats";
import { getSimulationChatsByAttempts } from "@/utils/queries/simulation_chats/get-simulation-chats-by-attempts";
import { getStandardGroupsByRubrics } from "@/utils/queries/standard_groups/get-standard-groups-by-rubrics";
import { getStandardsByStandardGroups } from "@/utils/queries/standards/get-standards-by-standardgroups";
import { useAuth } from "@/hooks/use-auth";

const chartConfig = {
  score: {
    label: "Performance Score",
    color: "var(--chart-1)",
  },
  adaptability: {
    label: "Adaptability",
    color: "var(--chart-2)",
  },
  listening: {
    label: "Listening Skills",
    color: "var(--chart-3)",
  },
  timeManagement: {
    label: "Time Management",
    color: "var(--chart-4)",
  },
  engagement: {
    label: "Student Engagement",
    color: "var(--chart-5)",
  },
} satisfies ChartConfig;

export default function Growth() {
  const auth = useAuth();
  const userId = auth.session.data?.user?.id;

  const { data: profile } = useQuery({
    queryKey: ["profile", userId],
    queryFn: () => getProfilesByUser(parseInt(userId!)),
    select: (data) => data[0],
    enabled: !!userId,
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
    queryKey: ["simulationAttempts", profile?.id],
    queryFn: () => getSimulationAttemptsByProfile(profile!.id),
    enabled: !!profile?.id,
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

  // Calculate growth metrics for the current user
  const growthData = useMemo(() => {
    if (
      !grades ||
      !feedbacks ||
      !standards ||
      !standardGroups ||
      !profile ||
      !rubrics
    )
      return [];

    // For TAs, show only their own performance
    // For admins/instructors, this could show aggregated data, but for now we'll focus on user-specific data
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
          // Use the rubric's total points instead of max standard points
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
  }, [grades, feedbacks, standards, standardGroups, profile, chats, rubrics]);

  // Calculate growth trend based on grades over time
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

  const isLoading =
    isLoadingAttempts ||
    isLoadingChats ||
    isLoadingGrades ||
    isLoadingFeedbacks ||
    isLoadingRubrics ||
    isLoadingStandardGroups ||
    isLoadingStandards;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[300px] w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Key Metrics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {growthData.slice(0, 4).map((metric) => {
          // Get appropriate icon for each metric
          const getIcon = (metricName: string) => {
            const name = metricName.toLowerCase();
            if (name.includes("overall") || name.includes("score"))
              return Target;
            if (name.includes("adapt") || name.includes("flexibility"))
              return Brain;
            if (name.includes("listen") || name.includes("communication"))
              return MessageSquare;
            if (name.includes("time") || name.includes("management"))
              return Clock;
            return User; // Default icon
          };

          // Get appropriate description for each metric
          const getDescription = (metricName: string) => {
            const name = metricName.toLowerCase();
            if (name.includes("overall") || name.includes("score"))
              return "Average performance score";
            if (name.includes("adapt") || name.includes("flexibility"))
              return "Adapting to student needs";
            if (name.includes("listen") || name.includes("communication"))
              return "Active listening ability";
            if (name.includes("time") || name.includes("management"))
              return "Session time efficiency";
            return "Performance metric";
          };

          const IconComponent = getIcon(metric.metric);
          const isOverallScore = metric.metric === "Overall Score";

          return (
            <Card key={metric.metric}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {metric.metric}
                </CardTitle>
                <IconComponent className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="flex items-center">
                  <div
                    className={`text-2xl font-bold ${
                      isOverallScore
                        ? metric.value >= 80
                          ? "text-green-600"
                          : metric.value >= 60
                            ? "text-amber-600"
                            : "text-red-600"
                        : "text-gray-900 dark:text-white"
                    }`}
                  >
                    {metric.value}%
                  </div>
                  {isOverallScore && growthTrend.value > 0 && (
                    <Badge
                      variant="outline"
                      className={
                        growthTrend.isPositive
                          ? "ml-2 bg-green-50 text-green-700 border-green-200"
                          : "ml-2 bg-red-50 text-red-700 border-red-200"
                      }
                    >
                      {growthTrend.isPositive ? (
                        <TrendingUp className="h-3 w-3 mr-1" />
                      ) : (
                        <TrendingUp className="h-3 w-3 mr-1 rotate-180" />
                      )}
                      {growthTrend.value}%
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {getDescription(metric.metric)}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Radar Chart */}
      <Card>
        <CardHeader className="items-center">
          <CardTitle>Performance Radar</CardTitle>
          <CardDescription>
            Comprehensive view of teaching skills and performance metrics
          </CardDescription>
        </CardHeader>
        <CardContent className="pb-0">
          <ChartContainer
            config={chartConfig}
            className="mx-auto aspect-square max-h-[400px]"
          >
            <RadarChart data={growthData}>
              <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
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
        {growthData.length > 0 && (
          <CardFooter className="flex-col gap-2 text-sm">
            <div className="flex items-center gap-2 leading-none font-medium">
              {growthTrend.isPositive ? "Trending up" : "Needs attention"}
              {growthTrend.value > 0 && ` by ${growthTrend.value}%`}
              <TrendingUp
                className={`h-4 w-4 ${growthTrend.isPositive ? "" : "rotate-180"}`}
              />
            </div>
            <div className="text-muted-foreground flex items-center gap-2 leading-none">
              Based on recent teaching sessions
            </div>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}
