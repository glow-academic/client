/**
 * NeedSupport.tsx
 * This is used to show the need for support.
 * @AshokSaravanan222 & @siladiea
 * 06/18/2025
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getAllProfiles } from "@/utils/queries/profiles/get-all-profiles";
import { getAllSimulationAttempts } from "@/utils/queries/simulation_attempts/get-all-simulation-attempts";
import { getAllSimulationChatGrades } from "@/utils/queries/simulation_chat_grades/get-all-simulation-chat-grades";
import { getAllSimulationChats } from "@/utils/queries/simulation_chats/get-all-simulation-chats";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { useMemo, useState } from "react";
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
  danger: "#ef4444",
  warning: "#f59e0b",
  success: "#10b981",
};

export default function NeedSupport() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const { data: profiles } = useQuery({
    queryKey: ["profiles"],
    queryFn: () => getAllProfiles(),
  });

  const { data: attempts } = useQuery({
    queryKey: ["attempts"],
    queryFn: () => getAllSimulationAttempts(),
  });

  const { data: chats } = useQuery({
    queryKey: ["chats"],
    queryFn: () => getAllSimulationChats(),
  });

  const { data: grades } = useQuery({
    queryKey: ["grades"],
    queryFn: () => getAllSimulationChatGrades(),
  });

  // Calculate metrics for struggling TAs
  const strugglingTAs = useMemo(() => {
    if (!profiles || !attempts || !chats || !grades) return 0;

    const tas = profiles.filter((profile) => profile.role === "ta");
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

    return taPerformance.filter((ta) => ta.avgScore < 70).length;
  }, [profiles, attempts, chats, grades]);

  // Score distribution for struggling TAs
  const scoreDistribution = useMemo(() => {
    if (!profiles || !attempts || !chats || !grades) return [];

    const tas = profiles.filter((profile) => profile.role === "ta");
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

      return avgScore;
    });

    return [
      {
        range: "0-30%",
        count: taPerformance.filter((score) => score < 30).length,
        fill: COLORS.danger,
      },
      {
        range: "30-50%",
        count: taPerformance.filter((score) => score >= 30 && score < 50)
          .length,
        fill: COLORS.danger,
      },
      {
        range: "50-70%",
        count: taPerformance.filter((score) => score >= 50 && score < 70)
          .length,
        fill: COLORS.warning,
      },
      {
        range: "70-90%",
        count: taPerformance.filter((score) => score >= 70 && score < 90)
          .length,
        fill: COLORS.success,
      },
      {
        range: "90-100%",
        count: taPerformance.filter((score) => score >= 90).length,
        fill: COLORS.success,
      },
    ];
  }, [profiles, attempts, chats, grades]);

  return (
    <>
      <Card
        className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900 border-orange-200 cursor-pointer hover:shadow-md transition-shadow"
        onClick={() => setIsDialogOpen(true)}
      >
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Need Support</CardTitle>
          <AlertTriangle className="h-4 w-4 text-orange-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-orange-700">
            {strugglingTAs}
          </div>
          <p className="text-xs text-orange-600 mt-1">TAs scoring below 70%</p>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>TA Performance Distribution</DialogTitle>
          </DialogHeader>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={scoreDistribution}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="range" />
                <YAxis />
                <Tooltip formatter={(value: number) => [value, "TAs"]} />
                <Bar dataKey="count" fill="#f97316" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
