/**
 * app/dashboard/growth/page.tsx
 * Student growth tracking page with radar chart visualization
 * @AshokSaravanan222 & @siladiea
 * 05/20/2025
 */
"use client";

import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { TrendingUp, Brain, Target, Clock, MessageSquare } from "lucide-react";
import { PolarAngleAxis, PolarGrid, Radar, RadarChart } from "recharts";

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
import { Badge } from "@/components/ui/badge";

import { getRubrics } from "@/utils/queries/get-rubrics";
import { getAttempts } from "@/utils/queries/get-attempts";
import { getAttemptChats } from "@/utils/queries/get-attempt-chats";
import { getUser } from "@/utils/queries/get-user";

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

export default function GrowthPage() {
  // Fetch current user
  const { data: user } = useQuery({
    queryKey: ["user"],
    queryFn: () => getUser(),
  });

  // Fetch all necessary data
  const { data: attempts, isLoading: isLoadingAttempts } = useQuery({
    queryKey: ["attempts"],
    queryFn: () => getAttempts(),
  });

  const { data: chats, isLoading: isLoadingChats } = useQuery({
    queryKey: ["chats", attempts?.map((attempt) => attempt.id)],
    queryFn: () => getAttemptChats(attempts!.map((attempt) => attempt.id)),
    enabled: !!attempts && attempts.length > 0,
  });

  const { data: rubrics, isLoading: isLoadingRubrics } = useQuery({
    queryKey: ["all-rubrics-growth"],
    queryFn: () => getRubrics(chats!.map((chat) => chat.id)),
    enabled: !!chats && chats.length > 0,
  });

  // Calculate growth metrics for the current user or overall if admin
  const growthData = useMemo(() => {
    if (!chats || !rubrics || !user) return [];

    // Filter data based on user role
    let relevantRubrics = rubrics;
    
    if (user.role === 'ta') {
      // For TAs, show only their own performance
      const userAttempts = attempts?.filter(attempt => attempt.userId === user.id) || [];
      const userAttemptIds = userAttempts.map(attempt => attempt.id);
      const userChats = chats.filter(chat => userAttemptIds.includes(chat.attemptId));
      const userChatIds = userChats.map(chat => chat.id);
      relevantRubrics = rubrics.filter(rubric => userChatIds.includes(rubric.chatId));
    }

    if (relevantRubrics.length === 0) return [];

    // Calculate averages for each metric
    const totalRubrics = relevantRubrics.length;
    
    const avgScore = Math.round(
      relevantRubrics.reduce((sum, rubric) => sum + rubric.score, 0) / totalRubrics
    );
    
    const avgAdaptability = Math.round(
      (relevantRubrics.reduce((sum, rubric) => sum + rubric.adaptability, 0) / totalRubrics) * 20
    ); // Convert to 0-100 scale
    
    const avgListening = Math.round(
      (relevantRubrics.reduce((sum, rubric) => sum + rubric.listening, 0) / totalRubrics) * 20
    ); // Convert to 0-100 scale
    
    // Calculate time management score (inverse of time taken, normalized)
    const avgTimeTaken = relevantRubrics.reduce((sum, rubric) => sum + rubric.timeTaken, 0) / totalRubrics;
    const timeManagementScore = Math.max(0, Math.min(100, 100 - (avgTimeTaken / 60))); // Normalize based on minutes
    
    // Calculate engagement score based on interaction frequency
    const engagementScore = Math.min(100, (totalRubrics / 10) * 100); // Scale based on number of interactions

    return [
      {
        metric: "Overall Score",
        value: avgScore,
        fullMark: 100,
      },
      {
        metric: "Adaptability",
        value: avgAdaptability,
        fullMark: 100,
      },
      {
        metric: "Listening Skills",
        value: avgListening,
        fullMark: 100,
      },
      {
        metric: "Time Management",
        value: Math.round(timeManagementScore),
        fullMark: 100,
      },
      {
        metric: "Engagement",
        value: Math.round(engagementScore),
        fullMark: 100,
      },
    ];
  }, [chats, rubrics, user, attempts]);

  // Calculate growth trend
  const growthTrend = useMemo(() => {
    if (!rubrics || rubrics.length < 2) return { value: 0, isPositive: true };

    // Sort rubrics by creation date
    const sortedRubrics = [...rubrics].sort((a, b) => 
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    const recentCount = Math.min(5, Math.floor(sortedRubrics.length / 2));
    const recent = sortedRubrics.slice(-recentCount);
    const previous = sortedRubrics.slice(0, recentCount);

    if (previous.length === 0) return { value: 0, isPositive: true };

    const recentAvg = recent.reduce((sum, r) => sum + r.score, 0) / recent.length;
    const previousAvg = previous.reduce((sum, r) => sum + r.score, 0) / previous.length;

    const change = Math.round(((recentAvg - previousAvg) / previousAvg) * 100);
    return { value: Math.abs(change), isPositive: change >= 0 };
  }, [rubrics]);

  // Get performance insights
  const insights = useMemo(() => {
    if (!growthData || growthData.length === 0) return [];

    const insights = [];
    
    const overallScore = growthData.find(d => d.metric === "Overall Score")?.value || 0;
    const adaptability = growthData.find(d => d.metric === "Adaptability")?.value || 0;
    const listening = growthData.find(d => d.metric === "Listening Skills")?.value || 0;
    const timeManagement = growthData.find(d => d.metric === "Time Management")?.value || 0;
    const engagement = growthData.find(d => d.metric === "Engagement")?.value || 0;

    if (overallScore >= 80) {
      insights.push({ type: "success", message: "Excellent overall performance!" });
    } else if (overallScore < 60) {
      insights.push({ type: "warning", message: "Overall performance needs improvement" });
    }

    if (adaptability < 60) {
      insights.push({ type: "improvement", message: "Focus on adapting to different student needs" });
    }

    if (listening < 60) {
      insights.push({ type: "improvement", message: "Work on active listening skills" });
    }

    if (timeManagement < 60) {
      insights.push({ type: "improvement", message: "Improve time management during sessions" });
    }

    if (engagement >= 80) {
      insights.push({ type: "success", message: "Great student engagement levels!" });
    }

    return insights;
  }, [growthData]);

  const isLoading = isLoadingAttempts || isLoadingChats || isLoadingRubrics;

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

  if (!growthData || growthData.length === 0) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="p-8 text-center">
            <Brain className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No Data Available</h3>
            <p className="text-muted-foreground">
              Complete some teaching sessions to see your growth metrics.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Key Metrics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overall Score</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center">
              <div className={`text-2xl font-bold ${
                (growthData.find(d => d.metric === "Overall Score")?.value ?? 0) >= 80 
                  ? "text-green-600" 
                  : (growthData.find(d => d.metric === "Overall Score")?.value ?? 0) >= 60
                  ? "text-amber-600"
                  : "text-red-600"
              }`}>
                {growthData.find(d => d.metric === "Overall Score")?.value ?? 0}%
              </div>
              {growthTrend.value > 0 && (
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
              Average performance score
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Adaptability</CardTitle>
            <Brain className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {growthData.find(d => d.metric === "Adaptability")?.value || 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              Adapting to student needs
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Listening Skills</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {growthData.find(d => d.metric === "Listening Skills")?.value || 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              Active listening ability
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Time Management</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {growthData.find(d => d.metric === "Time Management")?.value || 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              Session time efficiency
            </p>
          </CardContent>
        </Card>
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
        <CardFooter className="flex-col gap-2 text-sm">
          <div className="flex items-center gap-2 leading-none font-medium">
            {growthTrend.isPositive ? "Trending up" : "Needs attention"} 
            {growthTrend.value > 0 && ` by ${growthTrend.value}%`}
            <TrendingUp className={`h-4 w-4 ${growthTrend.isPositive ? "" : "rotate-180"}`} />
          </div>
          <div className="text-muted-foreground flex items-center gap-2 leading-none">
            Based on recent teaching sessions
          </div>
        </CardFooter>
      </Card>

      {/* Insights */}
      {insights.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Performance Insights</CardTitle>
            <CardDescription>
              Personalized recommendations for improvement
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {insights.map((insight, index) => (
                <div key={index} className="flex items-start gap-3">
                  <div className={`h-2 w-2 rounded-full mt-2 ${
                    insight.type === 'success' 
                      ? 'bg-green-500' 
                      : insight.type === 'warning'
                      ? 'bg-amber-500'
                      : 'bg-blue-500'
                  }`} />
                  <p className="text-sm">{insight.message}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
