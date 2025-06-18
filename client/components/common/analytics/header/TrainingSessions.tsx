/**
 * TrainingSessions.tsx
 * This is used to show the training sessions.
 * @AshokSaravanan222 & @siladiea
 * 06/18/2025
 */
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAllProfiles } from "@/utils/queries/profiles/get-all-profiles";
import { getSimulationAttemptsByProfiles } from "@/utils/queries/simulation_attempts/get-simulation-attempts-by-profiles";
import { getSimulationChatsByAttempts } from "@/utils/queries/simulation_chats/get-simulation-chats-by-attempts";
import { useQuery } from "@tanstack/react-query";
import { subDays } from "date-fns";
import { MessageSquare } from "lucide-react";
import { useMemo } from "react";

export default function TrainingSessions() {
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

  // Calculate total sessions this week
  const totalSessions = useMemo(() => {
    if (!chats) return 0;

    const isWithinLastWeek = (date: string) => {
      const oneWeekAgo = subDays(new Date(), 7);
      const chatDate = new Date(date);
      return chatDate >= oneWeekAgo;
    };

    return chats.filter((chat) => isWithinLastWeek(chat.createdAt)).length;
  }, [chats]);

  return (
    <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Training Sessions</CardTitle>
        <MessageSquare className="h-4 w-4 text-green-600" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-green-700">{totalSessions}</div>
        <p className="text-xs text-green-600 mt-1">This week</p>
      </CardContent>
    </Card>
  );
}
