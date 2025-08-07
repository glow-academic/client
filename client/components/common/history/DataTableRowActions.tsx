"use client";

import { Button } from "@/components/ui/button";
import { useProfile } from "@/contexts/profile-context";
import Link from "next/link";

export interface DataTableRowActionsProps {
  id: string;
  profileId: string;
  scenarios: Array<{ completed: boolean }>;
  interactionIds: string[];
  isIncomplete?: boolean;
  isPractice?: boolean;
}

export function DataTableRowActions({
  id,
  profileId,
  scenarios,
  interactionIds,
  isIncomplete = false,
  isPractice = false,
}: DataTableRowActionsProps) {
  const { effectiveProfile } = useProfile();

  // Check if this is the current user's attempt
  const isCurrentUser = effectiveProfile?.id === profileId;

  // Check if simulation is complete (all chats are completed)
  // Ensure scenarios is an array
  const scenariosArray = Array.isArray(scenarios) ? scenarios : [];
  const completedChats = scenariosArray.filter((chat) => chat.completed).length;
  const totalChats = interactionIds?.length || scenariosArray.length;
  const isComplete = completedChats === totalChats && totalChats > 0;

  // Show "View" if simulation is marked as incomplete, otherwise show "Continue" if it's the current user and simulation is not complete
  const buttonText = isIncomplete
    ? "View"
    : isCurrentUser && !isComplete
      ? "Continue"
      : "View";

  return (
    <Link href={`/${isPractice ? "practice" : "home"}/a/${id}`}>
      <Button variant="outline" size="sm" className="h-8">
        {buttonText}
      </Button>
    </Link>
  );
}
