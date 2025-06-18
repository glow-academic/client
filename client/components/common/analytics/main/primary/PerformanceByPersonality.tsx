/**
 * PerformanceByPersonality.tsx
 * This is used to show the horizontal bar chart of performance by personality.
 * @AshokSaravanan222 & @siladiea
 * 06/18/2025
 */
"use client";

import { Badge } from "@/components/ui/badge";
import { getAgentConfig } from "@/utils/agents";
import { getAllAgents } from "@/utils/queries/agents/get-all-agents";
import { getAllProfiles } from "@/utils/queries/profiles/get-all-profiles";
import { getAllScenarios } from "@/utils/queries/scenarios/get-all-scenarios";
import { getSimulationAttemptsByProfiles } from "@/utils/queries/simulation_attempts/get-simulation-attempts-by-profiles";
import { getSimulationChatGradesBySimulationChats } from "@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-simulationchats";
import { getSimulationChatsByAttempts } from "@/utils/queries/simulation_chats/get-simulation-chats-by-attempts";
import { useQuery } from "@tanstack/react-query";
import { isAfter, subHours } from "date-fns";
import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const COLORS = {
  primary: "#3b82f6",
};

interface PerformanceByPersonalityProps {
  timeRange: "12h" | "1d" | "1w";
}

export default function PerformanceByPersonality({
  timeRange,
}: PerformanceByPersonalityProps) {
  // Fetch data
  const { data: profiles } = useQuery({
    queryKey: ["profiles"],
    queryFn: () => getAllProfiles(),
  });

  const { data: agents } = useQuery({
    queryKey: ["agents"],
    queryFn: () => getAllAgents(),
  });

  const { data: scenarios } = useQuery({
    queryKey: ["scenarios"],
    queryFn: () => getAllScenarios(),
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

  // Calculate performance by personality
  const performanceData = useMemo(() => {
    if (!agents || !scenarios || !chats || !grades) return [];

    // Filter data by time range
    const hours = timeRange === "12h" ? 12 : timeRange === "1d" ? 24 : 168; // 1 week = 7 * 24 hours
    const cutoff = subHours(new Date(), hours);
    const filteredGrades = grades.filter((grade) =>
      isAfter(new Date(grade.createdAt), cutoff)
    );

    // Performance by student type (scenario-based)
    const performanceByType = agents
      .filter((agent) => agent.name) // Filter for student agents
      .map((agent) => {
        const agentScenarios = scenarios.filter((s) => s.agentId === agent.id);
        const agentChats = chats.filter((chat) =>
          agentScenarios.some((scenario) => scenario.id === chat.scenarioId)
        );
        const agentGrades = filteredGrades.filter((grade) =>
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
      })
      .filter((agent) => agent.sessions > 0); // Only show agents with sessions

    return performanceByType;
  }, [agents, scenarios, chats, grades, timeRange]);

  if (!performanceData.length) {
    return (
      <div className="flex items-center justify-center h-[300px]">
        <p className="text-muted-foreground">No performance data available</p>
      </div>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-2 h-full">
      <div className="h-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={performanceData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" domain={[0, 100]} />
            <YAxis dataKey="name" type="category" width={80} />
            <Tooltip
              formatter={(value: number) => [`${value}%`, "Average Score"]}
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
        {performanceData.map((type) => (
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
  );
}
