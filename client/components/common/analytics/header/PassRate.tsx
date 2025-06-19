/**
 * PassRate.tsx
 * This is used to show the pass rate.
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
import { format, subDays } from "date-fns";
import { Award } from "lucide-react";
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
  success: "#10b981",
  danger: "#ef4444",
};

export default function PassRate() {
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

  // Calculate pass rate
  const passRate = useMemo(() => {
    if (!grades) return 0;
    return grades.length > 0
      ? Math.round(
          (grades.filter((g) => g.passed).length / grades.length) * 100
        )
      : 0;
  }, [grades]);

  // Pass/fail trend data
  const passFailTrend = useMemo(() => {
    if (!grades) return [];

    return Array.from({ length: 7 }, (_, i) => {
      const date = subDays(new Date(), 6 - i);
      const dateStr = format(date, "yyyy-MM-dd");

      const dayGrades = grades.filter((grade) => {
        const gradeDate = format(new Date(grade.createdAt), "yyyy-MM-dd");
        return gradeDate === dateStr;
      });

      const passRate =
        dayGrades.length > 0
          ? Math.round(
              (dayGrades.filter((g) => g.passed).length / dayGrades.length) *
                100
            )
          : 0;

      return {
        date: format(date, "MM/dd"),
        passRate,
        passed: dayGrades.filter((g) => g.passed).length,
        failed: dayGrades.filter((g) => !g.passed).length,
      };
    });
  }, [grades]);

  return (
    <>
      <Card
        className="bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950 dark:to-emerald-900 border-emerald-200 cursor-pointer hover:shadow-md transition-shadow"
        onClick={() => setIsDialogOpen(true)}
      >
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Pass Rate</CardTitle>
          <Award className="h-4 w-4 text-emerald-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-emerald-700">{passRate}%</div>
          <p className="text-xs text-emerald-600 mt-1">
            Sessions meeting criteria
          </p>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Pass/Fail Trend</DialogTitle>
          </DialogHeader>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={passFailTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Bar
                  dataKey="passed"
                  fill={COLORS.success}
                  name="Passed"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="failed"
                  fill={COLORS.danger}
                  name="Failed"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
