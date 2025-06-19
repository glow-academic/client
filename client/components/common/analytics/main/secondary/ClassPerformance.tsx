/**
 * ClassPerformance.tsx
 * This component is used to display the class performance for the analytics page.
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
import { getAllClasses } from "@/utils/queries/classes/get-all-classes";
import { getAllProfiles } from "@/utils/queries/profiles/get-all-profiles";
import { getSimulationAttemptsByProfiles } from "@/utils/queries/simulation_attempts/get-simulation-attempts-by-profiles";
import { getSimulationChatGradesBySimulationChats } from "@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-simulationchats";
import { getSimulationChatsByAttempts } from "@/utils/queries/simulation_chats/get-simulation-chats-by-attempts";
import { useQuery } from "@tanstack/react-query";
import { BookOpen } from "lucide-react";
import { useMemo } from "react";

export default function ClassPerformance() {
  const { data: _classes } = useQuery({
    queryKey: ["classes"],
    queryFn: () => getAllClasses(),
  });

  const { data: profiles } = useQuery({
    queryKey: ["profiles"],
    queryFn: () => getAllProfiles(),
  });

  const { data: attempts } = useQuery({
    queryKey: ["simulationAttempts", profiles?.map((profile) => profile.id)],
    queryFn: () =>
      getSimulationAttemptsByProfiles(profiles!.map((profile) => profile.id)),
    enabled: !!profiles && profiles.length > 0,
  });

  const { data: chats } = useQuery({
    queryKey: ["simulationChats", attempts?.map((attempt) => attempt.id)],
    queryFn: () =>
      getSimulationChatsByAttempts(attempts!.map((attempt) => attempt.id)),
    enabled: !!attempts && attempts.length > 0,
  });

  const { data: grades } = useQuery({
    queryKey: ["simulationGrades", chats?.map((chat) => chat.id)],
    queryFn: () =>
      getSimulationChatGradesBySimulationChats(chats!.map((chat) => chat.id)),
    enabled: !!chats && chats.length > 0,
  });

  // Calculate class performance metrics
  const classMetrics = useMemo(() => {
    if (!profiles || !grades) return null;

    // Group profiles by class and calculate metrics
    const classGroups = profiles.reduce(
      (acc, profile) => {
        const className = profile.classIds?.[0] || "Unassigned";
        if (!acc[className]) {
          acc[className] = {
            profiles: [],
            totalSessions: 0,
            totalScore: 0,
            passedSessions: 0,
          };
        }
        acc[className].profiles.push(profile);
        return acc;
      },
      {} as Record<
        string,
        {
          profiles: typeof profiles;
          totalSessions: number;
          totalScore: number;
          passedSessions: number;
        }
      >
    );

    // Calculate performance for each class
    const classPerformance = Object.entries(classGroups).map(
      ([className, classData]) => {
        const classProfileIds = classData.profiles.map((p) => p.id);
        const classAttempts =
          attempts?.filter((attempt) =>
            classProfileIds.includes(attempt.profileId || "")
          ) || [];

        const classChats =
          chats?.filter((chat) =>
            classAttempts.some((attempt) => attempt.id === chat.attemptId)
          ) || [];

        const classChatIds = classChats.map((chat) => chat.id);
        const classGrades = grades.filter((grade) =>
          classChatIds.includes(grade.simulationChatId)
        );

        const avgScore =
          classGrades.length > 0
            ? Math.round(
                classGrades.reduce((sum, grade) => sum + grade.score, 0) /
                  classGrades.length
              )
            : 0;

        const passRate =
          classGrades.length > 0
            ? Math.round(
                (classGrades.filter((grade) => grade.passed).length /
                  classGrades.length) *
                  100
              )
            : 0;

        return {
          className: className === "null" ? "Unassigned" : className,
          studentCount: classData.profiles.length,
          avgScore,
          passRate,
          totalSessions: classGrades.length,
        };
      }
    );

    return classPerformance.sort((a, b) => b.avgScore - a.avgScore);
  }, [profiles, attempts, chats, grades]);

  if (!classMetrics || classMetrics.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Class Performance
          </CardTitle>
          <CardDescription>Performance metrics by class</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[300px]">
            <p className="text-muted-foreground">
              No class performance data available
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BookOpen className="h-5 w-5" />
          Class Performance
        </CardTitle>
        <CardDescription>Performance metrics by class</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4 h-[300px] overflow-y-auto">
          {classMetrics.slice(0, 6).map((classData, index) => (
            <div
              key={classData.className}
              className="flex items-center justify-between p-3 rounded-lg border"
            >
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-semibold text-sm">
                  {index + 1}
                </div>
                <div>
                  <p className="font-medium">{classData.className}</p>
                  <p className="text-sm text-muted-foreground">
                    {classData.studentCount} students •{" "}
                    {classData.totalSessions} sessions
                  </p>
                </div>
              </div>
              <div className="text-right space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold">
                    {classData.avgScore}%
                  </span>
                  <Badge
                    variant={
                      classData.avgScore >= 85
                        ? "default"
                        : classData.avgScore >= 75
                          ? "secondary"
                          : "destructive"
                    }
                  >
                    {classData.avgScore >= 85
                      ? "Excellent"
                      : classData.avgScore >= 75
                        ? "Good"
                        : "Needs Work"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {classData.passRate}% pass rate
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
