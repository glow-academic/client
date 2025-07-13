/**
 * ClassPerformance.tsx
 * This component displays class performance as a bar chart for the analytics page.
 * @AshokSaravanan222 & @siladiea
 * 06/19/2025
 */
"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { getAllClasses } from "@/utils/queries/classes/get-all-classes";
import { getAllProfiles } from "@/utils/queries/profiles/get-all-profiles";
import { getAllRubrics } from "@/utils/queries/rubrics/get-all-rubrics";
import { getAllSimulationAttempts } from "@/utils/queries/simulation_attempts/get-all-simulation-attempts";
import { getAllSimulationChatGrades } from "@/utils/queries/simulation_chat_grades/get-all-simulation-chat-grades";
import { getAllSimulationChats } from "@/utils/queries/simulation_chats/get-all-simulation-chats";
import { getAllSimulations } from "@/utils/queries/simulations/get-all-simulations";
import { useQuery } from "@tanstack/react-query";
import { BookOpen } from "lucide-react";
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

  // Calculate class performance metrics
  const classMetrics = useMemo(() => {
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
    const classMap = new Map();
    classes.forEach((cls) => {
      classMap.set(cls.id, {
        ...cls,
        totalScore: 0,
        totalGrades: 0,
        avgScore: 0,
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
      if (!profile || !profile.classIds || profile.classIds.length === 0)
        return;

      // Get the first class ID (assuming single class per profile for simplicity)
      const classId = profile.classIds[0];
      if (!classId) return;

      const classData = classMap.get(classId);
      if (!classData) return;

      // Find the simulation and rubric to get total points
      const simulation = simulations.find((s) => s.id === attempt.simulationId);
      const rubric = rubrics?.find((r) => r.id === simulation?.rubricId);
      const rubricTotalPoints = rubric?.points || 100;

      // Convert grade score to percentage using rubric points
      const scorePercent = Math.round((grade.score / rubricTotalPoints) * 100);

      // Update the class metrics
      classData.totalScore += scorePercent;
      classData.totalGrades += 1;
      classData.avgScore = Math.round(
        classData.totalScore / classData.totalGrades
      );
    });

    // Convert to array and filter out classes with no data
    return Array.from(classMap.values())
      .filter((cls) => cls.totalGrades > 0)
      .map((cls) => ({
        classCode: cls.classCode || cls.name || "Unknown",
        className: cls.name || cls.classCode || "Unknown",
        avgScore: cls.avgScore,
        totalGrades: cls.totalGrades,
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
            <div key={classData.classCode} className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">
                    {classData.classCode}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    ({classData.totalGrades} sessions)
                  </span>
                </div>
                <span className={`text-sm font-semibold ${colorConfig.accent}`}>
                  {classData.avgScore}%
                </span>
              </div>
              <Progress value={classData.avgScore} className="h-2" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
