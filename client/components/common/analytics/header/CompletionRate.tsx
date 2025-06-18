/**
 * CompletionRate.tsx
 * This is used to show the completion rate.
 * @AshokSaravanan222 & @siladiea
 * 06/18/2025
 */
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAllProfiles } from "@/utils/queries/profiles/get-all-profiles";
import { getSimulationAttemptsByProfiles } from "@/utils/queries/simulation_attempts/get-simulation-attempts-by-profiles";
import { getSimulationChatsByAttempts } from "@/utils/queries/simulation_chats/get-simulation-chats-by-attempts";
import { useQuery } from "@tanstack/react-query";
import { Target } from "lucide-react";
import { useMemo } from "react";

interface CompletionRateProps {
  onClick?: () => void;
}

export default function CompletionRate({ onClick }: CompletionRateProps) {
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

  return (
    <Card
      className={`bg-gradient-to-br from-teal-50 to-teal-100 dark:from-teal-950 dark:to-teal-900 border-teal-200 ${
        onClick ? "cursor-pointer hover:shadow-md transition-shadow" : ""
      }`}
      onClick={onClick}
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
  );
}
