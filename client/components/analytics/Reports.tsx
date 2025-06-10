/**
 * Reports.tsx
 * Used to display the reports for the analytics page.
 * @AshokSaravanan222 & @siladiea
 * 06/07/2025
 */
"use client";
import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Award, AlertTriangle, ChevronRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { getAllUsers } from "@/utils/queries/users/get-all-users";
import { getAllAgents } from "@/utils/queries/agents/get-all-agents";
import { getAllScenarios } from "@/utils/queries/scenarios/get-all-scenarios";
import { getAllRubrics } from "@/utils/queries/rubrics/get-all-rubrics";
import { getStandardGroupsByRubrics } from "@/utils/queries/standard_groups/get-standard-groups-by-rubrics";
import { getStandardsByStandardGroups } from "@/utils/queries/standards/get-standards-by-standardgroups";
import { getSimulationAttemptsByUsers } from "@/utils/queries/simulation_attempts/get-simulation-attempts-by-users";
import { getSimulationChatsByAttempts } from "@/utils/queries/simulation_chats/get-simulation-chats-by-attempts";
import { getSimulationChatGradesBySimulationChats } from "@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-simulationchats";
import { getSimulationChatFeedbacksBySimulationChatGrades } from "@/utils/queries/simulation_chat_feedbacks/get-simulation-chat-feedbacks-by-simulationchatgrades";

export default function Reports() {
  // Fetch data
  const { data: users, isLoading: isLoadingUsers } = useQuery({
    queryKey: ["users"],
    queryFn: () => getAllUsers(),
  });

  const { data: agents, isLoading: isLoadingAgents } = useQuery({
    queryKey: ["agents"],
    queryFn: () => getAllAgents(),
  });

  const { data: scenarios, isLoading: isLoadingScenarios } = useQuery({
    queryKey: ["scenarios"],
    queryFn: () => getAllScenarios(),
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
    },
  );

  const { data: standards, isLoading: isLoadingStandards } = useQuery({
    queryKey: ["standards", standardGroups?.map((group) => group.id)],
    queryFn: () =>
      getStandardsByStandardGroups(standardGroups!.map((group) => group.id)),
    enabled: !!standardGroups && standardGroups.length > 0,
  });

  const { data: attempts, isLoading: isLoadingAttempts } = useQuery({
    queryKey: ["simulationAttempts", users?.map((user) => user.id)],
    queryFn: () => getSimulationAttemptsByUsers(users!.map((user) => user.id)),
    enabled: !!users && users.length > 0,
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
      !users ||
      !chats ||
      !grades ||
      !feedbacks ||
      !standards ||
      !standardGroups
    )
      return null;

    const tas = users.filter((user) => user.role === "ta");

    // TA leaderboard based on actual grades
    const taPerformance = tas
      .map((ta) => {
        const taAttempts =
          attempts?.filter((attempt) => attempt.userId === ta.id) || [];
        const taChats = chats.filter((chat) =>
          taAttempts.some((attempt) => attempt.id === chat.attemptId),
        );
        const taGrades = grades.filter((grade) =>
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

        // Calculate skill breakdown for this TA
        const taFeedbacks = feedbacks.filter((f) =>
          taGrades.some((g) => g.id === f.simulationChatGradeId),
        );

        const skillBreakdown = standardGroups.map((group) => {
          const groupStandards = standards.filter(
            (s) => s.standardGroupId === group.id,
          );
          const groupFeedbacks = taFeedbacks.filter((f) =>
            groupStandards.some((s) => s.id === f.standardId),
          );

          const avgSkillScore =
            groupFeedbacks.length > 0
              ? Math.round(
                  (groupFeedbacks.reduce((sum, f) => sum + f.total, 0) /
                    groupFeedbacks.length /
                    groupStandards[0]?.points || 1) * 100,
                )
              : 0;

          return {
            skill: group.name,
            score: avgSkillScore,
          };
        });

        // Find weakest skill
        const weakestSkill = skillBreakdown.reduce(
          (min, skill) => (skill.score < min.score ? skill : min),
          skillBreakdown[0] || { skill: "Unknown", score: 100 },
        );

        return {
          id: ta.id,
          name: ta.name,
          username: ta.username,
          avgScore,
          completedSessions,
          totalSessions,
          completionRate:
            totalSessions > 0
              ? Math.round((completedSessions / totalSessions) * 100)
              : 0,
          initials: ta.name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase(),
          skillBreakdown,
          weakestSkill,
        };
      })
      .sort((a, b) => b.avgScore - a.avgScore);

    // Struggling TAs (score < 70)
    const strugglingTAs = taPerformance.filter(
      (ta) => ta.avgScore < 70 && ta.totalSessions > 0,
    );

    return {
      taPerformance,
      strugglingTAs,
    };
  }, [users, chats, grades, feedbacks, standards, standardGroups, attempts]);

  // Loading state
  if (
    isLoadingUsers ||
    isLoadingAttempts ||
    isLoadingChats ||
    isLoadingGrades ||
    isLoadingFeedbacks ||
    isLoadingStandards ||
    isLoadingStandardGroups ||
    isLoadingRubrics ||
    isLoadingAgents ||
    isLoadingScenarios
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
      {/* TA Leaderboard */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5" />
              TA Performance Leaderboard
            </CardTitle>
            <CardDescription>
              Ranked by overall training performance based on actual feedback
              scores
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analytics.taPerformance.slice(0, 10).map((ta, index) => (
                <div
                  key={ta.id}
                  className="flex items-center gap-4 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-sm">
                      #{index + 1}
                    </div>
                    <Avatar className="h-10 w-10">
                      <AvatarFallback>{ta.initials}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{ta.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {ta.username}@purdue.edu
                      </p>
                    </div>
                  </div>
                  <div className="text-right space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          ta.avgScore >= 80
                            ? "default"
                            : ta.avgScore >= 70
                              ? "secondary"
                              : "destructive"
                        }
                      >
                        {ta.avgScore}%
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {ta.completedSessions}/{ta.totalSessions} sessions
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* TAs Needing Support */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              Need Support
            </CardTitle>
            <CardDescription>
              TAs who may need additional training based on performance data
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analytics.strugglingTAs.length > 0 ? (
                analytics.strugglingTAs.map((ta) => (
                  <Dialog key={ta.id}>
                    <DialogTrigger asChild>
                      <div className="flex items-center gap-3 p-3 rounded-lg border border-orange-200 hover:bg-orange-50 transition-colors cursor-pointer">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-orange-100 text-orange-800">
                            {ta.initials}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <p className="font-medium text-sm">{ta.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {ta.avgScore}% avg score
                          </p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>
                          Support Recommendations for {ta.name}
                        </DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="p-4 rounded-lg bg-orange-50 border border-orange-200">
                          <h4 className="font-medium text-orange-800 mb-2">
                            Current Performance
                          </h4>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="text-muted-foreground">
                                Average Score:
                              </span>
                              <span className="font-medium ml-2">
                                {ta.avgScore}%
                              </span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">
                                Completion Rate:
                              </span>
                              <span className="font-medium ml-2">
                                {ta.completionRate}%
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Skill Breakdown */}
                        <div className="p-4 rounded-lg bg-blue-50 border border-blue-200">
                          <h4 className="font-medium text-blue-800 mb-2">
                            Skill Performance
                          </h4>
                          <div className="space-y-2">
                            {ta.skillBreakdown.map((skill, index) => (
                              <div
                                key={index}
                                className="flex items-center justify-between text-sm"
                              >
                                <span className="text-muted-foreground">
                                  {skill.skill}:
                                </span>
                                <span
                                  className={`font-medium ${skill.score < 70 ? "text-red-600" : skill.score < 80 ? "text-yellow-600" : "text-green-600"}`}
                                >
                                  {skill.score}%
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <h4 className="font-medium">Recommended Actions:</h4>
                          <ul className="text-sm space-y-1 text-muted-foreground">
                            <li>• Schedule one-on-one mentoring session</li>
                            <li>
                              • Focus on {ta.weakestSkill.skill.toLowerCase()}{" "}
                              improvement
                            </li>
                            <li>• Review specific feedback patterns</li>
                            <li>• Practice with similar student scenarios</li>
                            <li>
                              • Pair with high-performing TA for shadowing
                            </li>
                          </ul>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                ))
              ) : (
                <div className="text-center py-6">
                  <Award className="h-12 w-12 text-green-500 mx-auto mb-2" />
                  <p className="text-sm font-medium text-green-700">
                    All TAs are performing well!
                  </p>
                  <p className="text-xs text-muted-foreground">
                    No additional support needed
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
