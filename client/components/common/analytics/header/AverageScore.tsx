/**
 * AverageScore.tsx
 * This is used to show the average score.
 * @AshokSaravanan222 & @siladiea
 * 06/18/2025
 */
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getAllProfiles } from "@/utils/queries/profiles/get-all-profiles";
import { getSimulationAttemptsByProfiles } from "@/utils/queries/simulation_attempts/get-simulation-attempts-by-profiles";
import { getSimulationChatGradesBySimulationChats } from "@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-simulationchats";
import { getSimulationChatsByAttempts } from "@/utils/queries/simulation_chats/get-simulation-chats-by-attempts";
import { useQuery } from "@tanstack/react-query";
import { TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

const COLORS = {
  success: "#10b981",
  primary: "#3b82f6",
  warning: "#f59e0b",
  orange: "#f97316",
  danger: "#ef4444",
};

export default function AverageScore() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Fetch data
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

  // Calculate average score
  const avgScore = useMemo(() => {
    if (!grades) return 0;
    return grades.length > 0
      ? Math.round(grades.reduce((sum, g) => sum + g.score, 0) / grades.length)
      : 0;
  }, [grades]);

  // Score distribution data
  const scoreDistribution = useMemo(() => {
    if (!grades) return [];

    return [
      {
        range: "90-100%",
        count: grades.filter((g) => g.score >= 90).length,
        fill: COLORS.success,
      },
      {
        range: "80-89%",
        count: grades.filter((g) => g.score >= 80 && g.score < 90).length,
        fill: COLORS.primary,
      },
      {
        range: "70-79%",
        count: grades.filter((g) => g.score >= 70 && g.score < 80).length,
        fill: COLORS.warning,
      },
      {
        range: "60-69%",
        count: grades.filter((g) => g.score >= 60 && g.score < 70).length,
        fill: COLORS.orange,
      },
      {
        range: "<60%",
        count: grades.filter((g) => g.score < 60).length,
        fill: COLORS.danger,
      },
    ].filter((item) => item.count > 0);
  }, [grades]);

  return (
    <>
      <Card
        className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 border-purple-200 cursor-pointer hover:shadow-md transition-shadow"
        onClick={() => setIsDialogOpen(true)}
      >
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Average Score</CardTitle>
          <TrendingUp className="h-4 w-4 text-purple-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-purple-700">{avgScore}%</div>
          <p className="text-xs text-purple-600 mt-1">Overall TA performance</p>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Score Distribution</DialogTitle>
          </DialogHeader>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={scoreDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ range, percent }) =>
                    `${range}: ${(percent * 100).toFixed(0)}%`
                  }
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="count"
                >
                  {scoreDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => [value, "Sessions"]} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
