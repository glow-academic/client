/**
 * ClassPerformance.tsx
 * This component displays class performance as a bar chart for the analytics page.
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
import { getAllClasses } from "@/utils/queries/classes/get-all-classes";
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

interface ClassMetric {
  classCode: string;
  className: string;
  avgScore: number;
  totalGrades: number;
  students: StudentData[];
  scoreDistribution: ScoreDistribution[];
  recentActivity: RecentActivity[];
  passRate: number;
  avgTime: number;
}

export interface ClassPerformanceProps {
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

export default function ClassPerformance({
  className,
  color = "blue",
  maxItems = 5,
  title = "Class Performance",
  layout: _layout = "vertical",
}: ClassPerformanceProps) {
  const colorConfig = COLOR_CONFIGS[color];

  const { data: classes } = useQuery({
    queryKey: ["classes"],
    queryFn: getAllClasses,
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

  // Calculate class performance metrics with detailed data
  const classMetrics = useMemo((): ClassMetric[] => {
    if (
      !classes ||
      !profiles ||
      !attempts ||
      !chats ||
      !grades ||
      !simulations ||
      !rubrics
    )
      return [];

    // Create a map of class ID to class data
    const classMap = new Map<string, ClassMetric>();
    classes.forEach((cls) => {
      classMap.set(cls.id, {
        ...cls,
        className: cls.name,
        totalGrades: 0,
        avgScore: 0,
        students: [] as StudentData[],
        scoreDistribution: [] as ScoreDistribution[],
        recentActivity: [] as RecentActivity[],
        passRate: 0,
        avgTime: 0,
      });
    });

    // For each grade, find the associated class through the profile
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

      // Find the class that contains this profile
      const classWithProfile = classes.find(
        (cls) => cls.profileIds && cls.profileIds.includes(profile.id)
      );
      if (!classWithProfile) return;

      const classData = classMap.get(classWithProfile.id);
      if (!classData) return;

      // Find the simulation and rubric to get total points
      const simulation = simulations.find((s) => s.id === attempt.simulationId);
      const rubric = rubrics?.find((r) => r.id === simulation?.rubricId);
      const rubricTotalPoints = rubric?.points || 100;

      // Convert grade score to percentage using rubric points
      const scorePercent = Math.round((grade.score / rubricTotalPoints) * 100);

      // Update the class metrics
      classData.totalGrades += 1;
      classData.avgScore = Math.round(
        classData.scoreDistribution.reduce(
          (sum: number, item: ScoreDistribution) => sum + item.score,
          0
        ) / classData.totalGrades
      );

      // Add to score distribution
      classData.scoreDistribution.push({
        score: scorePercent,
        studentName: profile.firstName + " " + profile.lastName,
        timeTaken: Math.round(grade.timeTaken / 60), // Convert to minutes
        passed: grade.passed,
        createdAt: grade.createdAt,
      });

      // Add unique students
      const existingStudent = classData.students.find(
        (s: StudentData) => s.id === profile.id
      );
      if (!existingStudent) {
        classData.students.push({
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
        classData.recentActivity.push({
          studentName: profile.firstName + " " + profile.lastName,
          score: scorePercent,
          date: grade.createdAt,
        });
      }
    });

    // Calculate additional metrics for each class
    Array.from(classMap.values()).forEach((classData: ClassMetric) => {
      if (classData.scoreDistribution.length > 0) {
        // Calculate pass rate
        classData.passRate = Math.round(
          (classData.scoreDistribution.filter(
            (s: ScoreDistribution) => s.passed
          ).length /
            classData.scoreDistribution.length) *
            100
        );

        // Calculate average time
        classData.avgTime = Math.round(
          classData.scoreDistribution.reduce(
            (sum: number, item: ScoreDistribution) => sum + item.timeTaken,
            0
          ) / classData.scoreDistribution.length
        );

        // Sort students by average score
        classData.students.sort(
          (a: StudentData, b: StudentData) => b.avgScore - a.avgScore
        );

        // Sort recent activity by date
        classData.recentActivity.sort(
          (a: RecentActivity, b: RecentActivity) =>
            new Date(b.date).getTime() - new Date(a.date).getTime()
        );
      }
    });

    // Convert to array and filter out classes with no data
    return Array.from(classMap.values())
      .filter((cls: ClassMetric) => cls.totalGrades > 0)
      .map((cls: ClassMetric) => ({
        classCode: cls.classCode || cls.className || "Unknown",
        className: cls.className || cls.classCode || "Unknown",
        avgScore: cls.avgScore,
        totalGrades: cls.totalGrades,
        students: cls.students,
        scoreDistribution: cls.scoreDistribution,
        recentActivity: cls.recentActivity,
        passRate: cls.passRate,
        avgTime: cls.avgTime,
      }))
      .sort((a, b) => b.avgScore - a.avgScore)
      .slice(0, maxItems);
  }, [
    classes,
    profiles,
    attempts,
    chats,
    grades,
    simulations,
    rubrics,
    maxItems,
  ]);

  if (!classMetrics || classMetrics.length === 0) {
    return (
      <Card className={cn("w-full h-full flex flex-col", className)}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            {title}
          </CardTitle>
          <CardDescription>Average performance by class</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center flex-1">
          <p className="text-muted-foreground">
            No class performance data available
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
        <CardDescription>Average performance by class</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto">
        <div className="space-y-4">
          {classMetrics.map((classData) => (
            <Dialog key={classData.classCode}>
              <DialogTrigger asChild>
                <div className="space-y-6 cursor-pointer hover:bg-muted/50 p-3 rounded-lg transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">
                        {classData.classCode}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        ({classData.totalGrades} sessions)
                      </span>
                      <Info className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <span
                      className={`text-sm font-semibold ${colorConfig.accent}`}
                    >
                      {classData.avgScore}%
                    </span>
                  </div>
                  <Progress value={classData.avgScore} className="h-2" />
                </div>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5" />
                    {classData.className} Performance
                  </DialogTitle>
                  <DialogDescription>
                    Detailed performance analysis for {classData.classCode}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-6">
                  {/* Key Metrics */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-3 bg-muted rounded-lg">
                      <div className="text-2xl font-bold text-primary">
                        {classData.avgScore}%
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Class Average
                      </div>
                    </div>
                    <div className="text-center p-3 bg-muted rounded-lg">
                      <div className="text-2xl font-bold text-primary">
                        {classData.students.length}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Students
                      </div>
                    </div>
                    <div className="text-center p-3 bg-muted rounded-lg">
                      <div className="text-2xl font-bold text-primary">
                        {classData.passRate}%
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Pass Rate
                      </div>
                    </div>
                    <div className="text-center p-3 bg-muted rounded-lg">
                      <div className="text-2xl font-bold text-primary">
                        {classData.avgTime}m
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
                          count: classData.scoreDistribution.filter(
                            (s: ScoreDistribution) => s.score >= 90
                          ).length,
                          color: "bg-green-500",
                        },
                        {
                          range: "80-89%",
                          count: classData.scoreDistribution.filter(
                            (s: ScoreDistribution) =>
                              s.score >= 80 && s.score < 90
                          ).length,
                          color: "bg-blue-500",
                        },
                        {
                          range: "70-79%",
                          count: classData.scoreDistribution.filter(
                            (s: ScoreDistribution) =>
                              s.score >= 70 && s.score < 80
                          ).length,
                          color: "bg-yellow-500",
                        },
                        {
                          range: "60-69%",
                          count: classData.scoreDistribution.filter(
                            (s: ScoreDistribution) =>
                              s.score >= 60 && s.score < 70
                          ).length,
                          color: "bg-orange-500",
                        },
                        {
                          range: "Below 60%",
                          count: classData.scoreDistribution.filter(
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
                                classData.scoreDistribution.length > 0
                                  ? (item.count /
                                      classData.scoreDistribution.length) *
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
                      {classData.students.map((student: StudentData) => (
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
                    {classData.recentActivity.length > 0 ? (
                      <div className="space-y-2 max-h-40 overflow-y-auto">
                        {classData.recentActivity
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
                      {classData.avgScore < 70 && (
                        <p>
                          • Class average below 70% - consider additional
                          support sessions
                        </p>
                      )}
                      {classData.passRate < 80 && (
                        <p>
                          • Low pass rate - review common areas of difficulty
                        </p>
                      )}
                      {classData.avgTime > 45 && (
                        <p>
                          • Sessions taking longer than average - consider time
                          management training
                        </p>
                      )}
                      {classData.students.filter(
                        (s: StudentData) => s.avgScore < 60
                      ).length > 0 && (
                        <p>
                          •{" "}
                          {
                            classData.students.filter(
                              (s: StudentData) => s.avgScore < 60
                            ).length
                          }{" "}
                          students need additional support
                        </p>
                      )}
                      {classData.avgScore >= 85 && classData.passRate >= 90 && (
                        <p>
                          • Excellent class performance! Consider advanced
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
