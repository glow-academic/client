"use client";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useProfile } from "@/contexts/profile-context";
import { useWebSocket } from "@/contexts/websocket-context";
import { RotateCcw } from "lucide-react";
import Link from "next/link";
import React from "react";

export interface DataTableRowActionsProps {
  id: string;
  profileId: string;
  simulationId?: string;
  scenarios: Array<{ completed: boolean }>;
  interactionIds: string[];
  isIncomplete?: boolean;
  isPractice?: boolean;
  infiniteMode?: boolean;
  infiniteModeTimeLimit?: number | null;
  attemptCreatedAt?: string;
}

export function DataTableRowActions({
  id,
  profileId,
  simulationId,
  scenarios,
  interactionIds,
  isIncomplete = false,
  isPractice = false,
  infiniteMode = false,
  infiniteModeTimeLimit = null,
  attemptCreatedAt,
}: DataTableRowActionsProps) {
  const { effectiveProfile, activeProfile } = useProfile();
  const { isConnected, emitStartSimulation } = useWebSocket();
  const [isRetrying, setIsRetrying] = React.useState(false);

  // Check if this is the current user's attempt
  const isCurrentUser = effectiveProfile?.id === profileId;

  // Check if simulation is complete (all chats are completed)
  // Ensure scenarios is an array
  const scenariosArray = Array.isArray(scenarios) ? scenarios : [];
  const completedChats = scenariosArray.filter((chat) => chat.completed).length;
  const totalChats = interactionIds?.length || scenariosArray.length;
  const isComplete = completedChats === totalChats && totalChats > 0;

  // Infinite mode: treat as continue if within time window, otherwise view
  let canContinueInfinite = false;
  if (infiniteMode && effectiveProfile?.id === profileId) {
    if (infiniteModeTimeLimit && attemptCreatedAt) {
      const started = new Date(attemptCreatedAt).getTime();
      const now = Date.now();
      const elapsedMinutes = (now - started) / 60000;
      canContinueInfinite = elapsedMinutes <= infiniteModeTimeLimit;
    } else {
      // No limit: always allow continue for owner
      canContinueInfinite = true;
    }
  }

  // Show "View" if simulation is marked as incomplete, otherwise show "Continue" if it's the current user and simulation is not complete
  const buttonText = isIncomplete
    ? "View"
    : isCurrentUser && (!isComplete || canContinueInfinite)
      ? "Continue"
      : "View";

  const disabledForEmulation = effectiveProfile?.id !== activeProfile?.id
  const buttonEl = (
    <Button
      variant="outline"
      size="sm"
      className="h-8"
      disabled={disabledForEmulation}
    >
      {buttonText}
    </Button>
  );

  const linkHref = `/${isPractice ? "practice" : "home"}/a/${id}`;

  return (
    <div className="flex items-center gap-2">
      {disabledForEmulation ? (
        <Tooltip>
          <TooltipTrigger asChild>{buttonEl}</TooltipTrigger>
          <TooltipContent>
            <p>You cannot open simulations on behalf of another user.</p>
          </TooltipContent>
        </Tooltip>
      ) : (
        <Link href={linkHref}>{buttonEl}</Link>
      )}
      {/* Retry icon appears only when it would otherwise say View (completed) */}
      {buttonText === "View" &&
        !disabledForEmulation &&
        isPractice &&
        (simulationId ?? "") !== "" && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label="Retry"
                className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-input bg-background hover:bg-accent hover:text-accent-foreground"
                disabled={isRetrying}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (!isConnected) {
                    return;
                  }
                  setIsRetrying(true);
                  try {
                    const profileIdForEmit =
                      effectiveProfile?.role === "guest"
                        ? ""
                        : String(effectiveProfile?.id || "");
                    emitStartSimulation({
                      simulation_id: String(simulationId),
                      profile_id: profileIdForEmit,
                      scenario_id:
                        scenariosArray.length > 0
                          ? String(
                              (
                                scenariosArray[0] as unknown as {
                                  scenarioId?: string;
                                }
                              ).scenarioId || ""
                            )
                          : null,
                    });
                  } finally {
                    // Leave loading state; navigation will occur via global event listener
                    setTimeout(() => setIsRetrying(false), 2000);
                  }
                }}
              >
                <RotateCcw
                  className={`h-4 w-4 ${isRetrying ? "animate-spin" : ""}`}
                />
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Retry</p>
            </TooltipContent>
          </Tooltip>
        )}
    </div>
  );
}
