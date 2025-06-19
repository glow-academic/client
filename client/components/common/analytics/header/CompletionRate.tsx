/**
 * CompletionRate.tsx
 * This is used to show the completion rate.
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
import { getSimulationChatsByAttempts } from "@/utils/queries/simulation_chats/get-simulation-chats-by-attempts";
import { useQuery } from "@tanstack/react-query";
import { format, subDays } from "date-fns";
import { Target } from "lucide-react";
import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const COLORS = {
  success: "#10b981",
};

export default function CompletionRate() {
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

  // Calculate completion rate
  const completionRate = useMemo(() => {
    if (!chats) return 0;
    const completedChats = chats.filter((chat) => chat.completed);
    return chats.length > 0
      ? Math.round((completedChats.length / chats.length) * 100)
      : 0;
  }, [chats]);

  // Completion trend data
  const completionTrend = useMemo(() => {
    if (!chats) return [];

    return Array.from({ length: 7 }, (_, i) => {
      const date = subDays(new Date(), 6 - i);
      const dateStr = format(date, "yyyy-MM-dd");

      const dayChats = chats.filter((chat) => {
        const chatDate = format(new Date(chat.createdAt), "yyyy-MM-dd");
        return chatDate === dateStr;
      });

      const completionRate =
        dayChats.length > 0
          ? Math.round(
              (dayChats.filter((chat) => chat.completed).length /
                dayChats.length) *
                100
            )
          : 0;

      return {
        date: format(date, "MM/dd"),
        rate: completionRate,
        total: dayChats.length,
      };
    });
  }, [chats]);

  return (
    <>
      <Card
        className="bg-gradient-to-br from-teal-50 to-teal-100 dark:from-teal-950 dark:to-teal-900 border-teal-200 cursor-pointer hover:shadow-md transition-shadow"
        onClick={() => setIsDialogOpen(true)}
      >
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
          <Target className="h-4 w-4 text-teal-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-teal-700">
            {completionRate}%
          </div>
          <p className="text-xs text-teal-600 mt-1">
            Sessions completed successfully
          </p>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Completion Rate Trend</DialogTitle>
          </DialogHeader>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={completionTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis domain={[0, 100]} />
                <Tooltip
                  formatter={(value: number) => [
                    `${value}%`,
                    "Completion Rate",
                  ]}
                />
                <Line
                  type="monotone"
                  dataKey="rate"
                  stroke={COLORS.success}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
