"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useProfile } from "@/contexts/profile-context";
import { useWebSocket } from "@/contexts/websocket-context";
import { log } from "@/utils/logger";
import { updateSimulationAttempt } from "@/utils/mutations/simulation_attempts/update-simulation-attempt";
import { useQueryClient } from "@tanstack/react-query";
import { Archive, RotateCcw, Unlock } from "lucide-react";
import Link from "next/link";
import React from "react";
import { toast } from "sonner";

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
  archived?: boolean;
  showArchive?: boolean;
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
  archived = false,
  showArchive = false,
}: DataTableRowActionsProps) {
  const { effectiveProfile, activeProfile } = useProfile();
  const { isConnected, emitStartSimulation } = useWebSocket();
  const [isRetrying, setIsRetrying] = React.useState(false);
  const [isArchiving, setIsArchiving] = React.useState(false);
  const queryClient = useQueryClient();

  // Check if this is the current user's attempt
  const isCurrentUser = effectiveProfile?.id === profileId;

  // Check if user has permission to archive (now controlled by prop)
  const canArchive = showArchive;

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

  const disabledForEmulation = effectiveProfile?.id !== activeProfile?.id;
  const buttonEl = (
    <Button
      variant="outline"
      size="sm"
      className={`h-8${buttonText === "Continue" ? " min-w-[96px]" : ""}`}
    >
      {buttonText}
    </Button>
  );

  const linkHref = `/${isPractice ? "practice" : "home"}/a/${id}`;

  const handleArchiveToggle = async () => {
    setIsArchiving(true);
    try {
      await updateSimulationAttempt(id, { archived: !archived });
      toast.success(
        archived
          ? "Simulation unarchived successfully"
          : "Simulation archived successfully"
      );

      // Invalidate relevant queries to refresh the data
      queryClient.invalidateQueries({ queryKey: ["simulationAttempts"] });
      queryClient.invalidateQueries({ queryKey: ["attempt", id] });
    } catch (error) {
      await log.error("simulation_attempt.archive_toggle.failed", {
        message: "Error updating simulation archive status",
        subject: { entityType: "simulation_attempt", entityId: id },
        context: {
          component: "DataTableRowActions",
          function: "handleArchiveToggle",
        },
        error,
      });
      toast.error("Failed to update simulation archive status");
    } finally {
      setIsArchiving(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Link href={linkHref}>{buttonEl}</Link>
      {/* Retry icon appears only when it would otherwise say View (completed) */}
      {buttonText === "View" && isPractice && (simulationId ?? "") !== "" && (
        <Tooltip>
          <TooltipTrigger>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Retry"
              className={`h-8 w-8 inline-flex items-center justify-center border-input bg-background hover:bg-accent hover:text-accent-foreground ${
                disabledForEmulation ? "opacity-50 cursor-not-allowed" : ""
              }`}
              disabled={isRetrying || disabledForEmulation}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (disabledForEmulation) {
                  return;
                }
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
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {disabledForEmulation ? (
              <p>You can't start a simulation on behalf of another user.</p>
            ) : (
              <p>Retry</p>
            )}
          </TooltipContent>
        </Tooltip>
      )}

      {/* Archive/Unarchive button - only show for instructional, admin, superadmin */}
      {canArchive && (
        <AlertDialog>
          <Tooltip>
            <TooltipTrigger asChild>
              <AlertDialogTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label={archived ? "Unarchive" : "Archive"}
                  className={`h-8 w-8 inline-flex items-center justify-center border-input bg-background hover:bg-accent hover:text-accent-foreground ${
                    isArchiving ? "opacity-50 cursor-not-allowed" : ""
                  }`}
                  disabled={isArchiving}
                >
                  {archived ? (
                    <Unlock
                      className={`h-4 w-4 ${isArchiving ? "animate-spin" : ""}`}
                    />
                  ) : (
                    <Archive
                      className={`h-4 w-4 ${isArchiving ? "animate-spin" : ""}`}
                    />
                  )}
                </Button>
              </AlertDialogTrigger>
            </TooltipTrigger>
            <TooltipContent>
              <p>{archived ? "Unarchive" : "Archive"}</p>
            </TooltipContent>
          </Tooltip>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {archived ? "Unarchive Simulation" : "Archive Simulation"}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {archived
                  ? "Are you sure you want to unarchive this simulation? It will be visible again in the main simulation list."
                  : "Are you sure you want to archive this simulation? It will be hidden from the main simulation list but can be accessed through archived filters."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleArchiveToggle}
                disabled={isArchiving}
              >
                {isArchiving
                  ? "Processing..."
                  : archived
                    ? "Unarchive"
                    : "Archive"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
