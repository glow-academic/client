/**
 * CohortPerformance.tsx
 * This component displays cohort performance as a bar chart for the analytics page.
 * @AshokSaravanan222 & @siladiea
 * 06/19/2025
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { getAllCohorts } from "@/utils/queries/cohorts/get-all-cohorts";
import { getAllProfiles } from "@/utils/queries/profiles/get-all-profiles";
import { getAllRubrics } from "@/utils/queries/rubrics/get-all-rubrics";
import { getAllSimulationAttempts } from "@/utils/queries/simulation_attempts/get-all-simulation-attempts";
import { getAllSimulationChatGrades } from "@/utils/queries/simulation_chat_grades/get-all-simulation-chat-grades";
import { getAllSimulationChats } from "@/utils/queries/simulation_chats/get-all-simulation-chats";
import { getAllSimulations } from "@/utils/queries/simulations/get-all-simulations";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Clock, Info, Target, TrendingUp, Users } from "lucide-react";
import { useMemo } from "react";

type ColorTheme =
  | "blue"
  | "green"
  | "purple"
  | "orange"
  | "teal"
  | "red"
  | "emerald"
  | "indigo";
type Layout = "vertical" | "horizontal";

interface StudentData {
  id: string;
  name: string;
  scores: number[];
  avgScore: number;
  sessions: number;
}

interface ScoreDistribution {
  score: number;
  studentName: string;
  timeTaken: number;
  passed: boolean;
  createdAt: string;
}

interface RecentActivity {
  studentName: string;
  score: number;
  date: string;
}

interface CohortMetric {
  cohortId: string;
  cohortTitle: string;
  cohortDescription: string;
  avgScore: number;
  totalGrades: number;
  students: StudentData[];
  scoreDistribution: ScoreDistribution[];
  recentActivity: RecentActivity[];
  passRate: number;
  avgTime: number;
  memberCount: number;
}

export interface CohortPerformanceProps {
  className?: string;
  color?: ColorTheme;
  maxItems?: number;
  title?: string;
  layout?: Layout;
}

const COLOR_CONFIGS = {
  blue: {
    primary: "#3b82f6",
    accent: "text-blue-600",
  },
  green: {
    primary: "#10b981",
    accent: "text-green-600",
  },
  purple: {
    primary: "#8b5cf6",
    accent: "text-purple-600",
  },
  orange: {
    primary: "#f97316",
    accent: "text-orange-600",
  },
  teal: {
    primary: "#14b8a6",
    accent: "text-teal-600",
  },
  red: {
    primary: "#ef4444",
    accent: "text-red-600",
  },
  emerald: {
    primary: "#10b981",
    accent: "text-emerald-600",
  },
  indigo: {
    primary: "#6366f1",
    accent: "text-indigo-600",
  },
};

export default function CohortPerformance({
  className,
  color = "blue",
  maxItems = 5,
  title = "Cohort Performance",
  layout: _layout = "vertical",
}: CohortPerformanceProps) {
  const colorConfig = COLOR_CONFIGS[color];

  const { data: cohorts } = useQuery({
    queryKey: ["cohorts"],
    queryFn: getAllCohorts,
  });

  const { data: profiles } = useQuery({
    queryKey: ["profiles"],
    queryFn: getAllProfiles,
  });

  const { data: attempts } = useQuery({
    queryKey: ["attempts"],
    queryFn: getAllSimulationAttempts,
  });

  const { data: chats } = useQuery({
    queryKey: ["chats"],
    queryFn: getAllSimulationChats,
  });

  const { data: grades } = useQuery({
    queryKey: ["grades"],
    queryFn: getAllSimulationChatGrades,
  });

  const { data: simulations } = useQuery({
    queryKey: ["simulations"],
    queryFn: getAllSimulations,
  });

  const { data: rubrics } = useQuery({
    queryKey: ["rubrics"],
    queryFn: getAllRubrics,
  });

  // Calculate cohort performance metrics with detailed data
  const cohortMetrics = useMemo((): CohortMetric[] => {
    if (
      !cohorts ||
      !profiles ||
      !attempts ||
      !chats ||
      !grades ||
      !simulations ||
      !rubrics
    )
      return [];

    // Create a map of cohort ID to cohort data
    const cohortMap = new Map<string, CohortMetric>();
    cohorts.forEach((cohort) => {
      cohortMap.set(cohort.id, {
        cohortId: cohort.id,
        cohortTitle: cohort.title,
        cohortDescription: cohort.description || "",
        totalGrades: 0,
        avgScore: 0,
        students: [] as StudentData[],
        scoreDistribution: [] as ScoreDistribution[],
        recentActivity: [] as RecentActivity[],
        passRate: 0,
        avgTime: 0,
        memberCount: cohort.profileIds?.length || 0,
      });
    });

    // For each grade, find the associated cohort through the profile
    grades.forEach((grade) => {
      // Find the chat
      const chat = chats.find((c) => c.id === grade.simulationChatId);
      if (!chat) return;

      // Find the attempt
      const attempt = attempts.find((a) => a.id === chat.attemptId);
      if (!attempt) return;

      // Find the profile
      const profile = profiles.find((p) => p.id === attempt.profileId);
      if (!profile) return;

      // Find the cohort that contains this profile
      const cohortWithProfile = cohorts.find(
        (cohort) => cohort.profileIds && cohort.profileIds.includes(profile.id)
      );
      if (!cohortWithProfile) return;

      const cohortData = cohortMap.get(cohortWithProfile.id);
      if (!cohortData) return;

      // Find the simulation and rubric to get total points
      const simulation = simulations.find((s) => s.id === attempt.simulationId);
      const rubric = rubrics?.find((r) => r.id === simulation?.rubricId);
      const rubricTotalPoints = rubric?.points || 100;

      // Convert grade score to percentage using rubric points
      const scorePercent = Math.round((grade.score / rubricTotalPoints) * 100);

      // Update the cohort metrics
      cohortData.totalGrades += 1;
      cohortData.avgScore = Math.round(
        cohortData.scoreDistribution.reduce(
          (sum: number, item: ScoreDistribution) => sum + item.score,
          0
        ) / cohortData.totalGrades
      );

      // Add to score distribution
      cohortData.scoreDistribution.push({
        score: scorePercent,
        studentName: profile.firstName + " " + profile.lastName,
        timeTaken: Math.round(grade.timeTaken / 60), // Convert to minutes
        passed: grade.passed,
        createdAt: grade.createdAt,
      });

      // Add unique students
      const existingStudent = cohortData.students.find(
        (s: StudentData) => s.id === profile.id
      );
      if (!existingStudent) {
        cohortData.students.push({
          id: profile.id,
          name: profile.firstName + " " + profile.lastName,
          scores: [scorePercent],
          avgScore: scorePercent,
          sessions: 1,
        });
      } else {
        existingStudent.scores.push(scorePercent);
        existingStudent.avgScore = Math.round(
          existingStudent.scores.reduce(
            (sum: number, score: number) => sum + score,
            0
          ) / existingStudent.scores.length
        );
        existingStudent.sessions += 1;
      }

      // Add to recent activity (last 7 days)
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      if (new Date(grade.createdAt) > weekAgo) {
        cohortData.recentActivity.push({
          studentName: profile.firstName + " " + profile.lastName,
          score: scorePercent,
          date: grade.createdAt,
        });
      }
    });

    // Calculate additional metrics for each cohort
    Array.from(cohortMap.values()).forEach((cohortData: CohortMetric) => {
      if (cohortData.scoreDistribution.length > 0) {
        // Calculate pass rate
        cohortData.passRate = Math.round(
          (cohortData.scoreDistribution.filter(
            (s: ScoreDistribution) => s.passed
          ).length /
            cohortData.scoreDistribution.length) *
            100
        );

        // Calculate average time
        cohortData.avgTime = Math.round(
          cohortData.scoreDistribution.reduce(
            (sum: number, item: ScoreDistribution) => sum + item.timeTaken,
            0
          ) / cohortData.scoreDistribution.length
        );

        // Sort students by average score
        cohortData.students.sort(
          (a: StudentData, b: StudentData) => b.avgScore - a.avgScore
        );

        // Sort recent activity by date
        cohortData.recentActivity.sort(
          (a: RecentActivity, b: RecentActivity) =>
            new Date(b.date).getTime() - new Date(a.date).getTime()
        );
      }
    });

    // Convert to array and filter out cohorts with no data
    return Array.from(cohortMap.values())
      .filter((cohort: CohortMetric) => cohort.totalGrades > 0)
      .map((cohort: CohortMetric) => ({
        cohortId: cohort.cohortId,
        cohortTitle: cohort.cohortTitle,
        cohortDescription: cohort.cohortDescription,
        avgScore: cohort.avgScore,
        totalGrades: cohort.totalGrades,
        students: cohort.students,
        scoreDistribution: cohort.scoreDistribution,
        recentActivity: cohort.recentActivity,
        passRate: cohort.passRate,
        avgTime: cohort.avgTime,
        memberCount: cohort.memberCount,
      }))
      .sort((a, b) => b.avgScore - a.avgScore)
      .slice(0, maxItems);
  }, [
    cohorts,
    profiles,
    attempts,
    chats,
    grades,
    simulations,
    rubrics,
    maxItems,
  ]);

  if (!cohortMetrics || cohortMetrics.length === 0) {
    return (
      <Card className={cn("w-full h-full flex flex-col", className)}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            {title}
          </CardTitle>
          <CardDescription>Average performance by cohort</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center flex-1">
          <p className="text-muted-foreground">
            No cohort performance data available
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("w-full h-full flex flex-col", className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BookOpen className="h-5 w-5" />
          {title}
        </CardTitle>
        <CardDescription>Average performance by cohort</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto">
        <div className="space-y-4">
          {cohortMetrics.map((cohortData) => (
            <Dialog key={cohortData.cohortId}>
              <DialogTrigger asChild>
                <div className="space-y-6 cursor-pointer hover:bg-muted/50 p-3 rounded-lg transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">
                        {cohortData.cohortTitle}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        ({cohortData.totalGrades} sessions,{" "}
                        {cohortData.memberCount} members)
                      </span>
                      <Info className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <span
                      className={`text-sm font-semibold ${colorConfig.accent}`}
                    >
                      {cohortData.avgScore}%
                    </span>
                  </div>
                  <Progress value={cohortData.avgScore} className="h-2" />
                </div>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5" />
                    {cohortData.cohortTitle} Performance
                  </DialogTitle>
                  <DialogDescription>
                    Detailed performance analysis for {cohortData.cohortTitle}
                    {cohortData.cohortDescription && (
                      <span className="block text-sm mt-1">
                        {cohortData.cohortDescription}
                      </span>
                    )}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-6">
                  {/* Key Metrics */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-3 bg-muted rounded-lg">
                      <div className="text-2xl font-bold text-primary">
                        {cohortData.avgScore}%
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Cohort Average
                      </div>
                    </div>
                    <div className="text-center p-3 bg-muted rounded-lg">
                      <div className="text-2xl font-bold text-primary">
                        {cohortData.students.length}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Active Students
                      </div>
                    </div>
                    <div className="text-center p-3 bg-muted rounded-lg">
                      <div className="text-2xl font-bold text-primary">
                        {cohortData.passRate}%
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Pass Rate
                      </div>
                    </div>
                    <div className="text-center p-3 bg-muted rounded-lg">
                      <div className="text-2xl font-bold text-primary">
                        {cohortData.avgTime}m
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Avg Time
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Score Distribution */}
                  <div>
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <Target className="h-4 w-4" />
                      Score Distribution
                    </h4>
                    <div className="space-y-2">
                      {[
                        {
                          range: "90-100%",
                          count: cohortData.scoreDistribution.filter(
                            (s: ScoreDistribution) => s.score >= 90
                          ).length,
                          color: "bg-green-500",
                        },
                        {
                          range: "80-89%",
                          count: cohortData.scoreDistribution.filter(
                            (s: ScoreDistribution) =>
                              s.score >= 80 && s.score < 90
                          ).length,
                          color: "bg-blue-500",
                        },
                        {
                          range: "70-79%",
                          count: cohortData.scoreDistribution.filter(
                            (s: ScoreDistribution) =>
                              s.score >= 70 && s.score < 80
                          ).length,
                          color: "bg-yellow-500",
                        },
                        {
                          range: "60-69%",
                          count: cohortData.scoreDistribution.filter(
                            (s: ScoreDistribution) =>
                              s.score >= 60 && s.score < 70
                          ).length,
                          color: "bg-orange-500",
                        },
                        {
                          range: "Below 60%",
                          count: cohortData.scoreDistribution.filter(
                            (s: ScoreDistribution) => s.score < 60
                          ).length,
                          color: "bg-red-500",
                        },
                      ].map((item) => (
                        <div
                          key={item.range}
                          className="flex items-center gap-3"
                        >
                          <div className="w-16 text-sm text-muted-foreground">
                            {item.range}
                          </div>
                          <div className="flex-1">
                            <Progress
                              value={
                                cohortData.scoreDistribution.length > 0
                                  ? (item.count /
                                      cohortData.scoreDistribution.length) *
                                    100
                                  : 0
                              }
                              className="h-2"
                            />
                          </div>
                          <div className="w-8 text-sm text-right">
                            {item.count}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <Separator />

                  {/* Student Performance */}
                  <div>
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Student Performance
                    </h4>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {cohortData.students.map((student: StudentData) => (
                        <div
                          key={student.id}
                          className="flex items-center justify-between p-3 bg-muted rounded-lg"
                        >
                          <div>
                            <div className="font-medium text-sm">
                              {student.name}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {student.sessions} sessions
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-bold">
                              {student.avgScore}%
                            </div>
                            <Badge
                              variant={
                                student.avgScore >= 80
                                  ? "default"
                                  : student.avgScore >= 70
                                    ? "secondary"
                                    : "destructive"
                              }
                              className="text-xs"
                            >
                              {student.avgScore >= 80
                                ? "Excellent"
                                : student.avgScore >= 70
                                  ? "Good"
                                  : "Needs Work"}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <Separator />

                  {/* Recent Activity */}
                  <div>
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Recent Activity (Last 7 Days)
                    </h4>
                    {cohortData.recentActivity.length > 0 ? (
                      <div className="space-y-2 max-h-40 overflow-y-auto">
                        {cohortData.recentActivity
                          .slice(0, 10)
                          .map((activity: RecentActivity, index: number) => (
                            <div
                              key={index}
                              className="flex items-center justify-between text-sm"
                            >
                              <span>{activity.studentName}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-muted-foreground">
                                  {new Date(activity.date).toLocaleDateString()}
                                </span>
                                <Badge
                                  variant={
                                    activity.score >= 80
                                      ? "default"
                                      : activity.score >= 70
                                        ? "secondary"
                                        : "destructive"
                                  }
                                >
                                  {activity.score}%
                                </Badge>
                              </div>
                            </div>
                          ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        No recent activity
                      </p>
                    )}
                  </div>

                  {/* Recommendations */}
                  <div>
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" />
                      Recommendations
                    </h4>
                    <div className="text-sm text-muted-foreground space-y-1">
                      {cohortData.avgScore < 70 && (
                        <p>
                          • Cohort average below 70% - consider additional
                          support sessions
                        </p>
                      )}
                      {cohortData.passRate < 80 && (
                        <p>
                          • Low pass rate - review common areas of difficulty
                        </p>
                      )}
                      {cohortData.avgTime > 45 && (
                        <p>
                          • Sessions taking longer than average - consider time
                          management training
                        </p>
                      )}
                      {cohortData.students.filter(
                        (s: StudentData) => s.avgScore < 60
                      ).length > 0 && (
                        <p>
                          •{" "}
                          {
                            cohortData.students.filter(
                              (s: StudentData) => s.avgScore < 60
                            ).length
                          }{" "}
                          students need additional support
                        </p>
                      )}
                      {cohortData.avgScore >= 85 &&
                        cohortData.passRate >= 90 && (
                          <p>
                            • Excellent cohort performance! Consider advanced
                            scenarios
                          </p>
                        )}
                    </div>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
