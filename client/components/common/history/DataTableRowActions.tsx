"use client";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useProfile } from "@/contexts/profile-context";
import { ArrowRight, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useEffect, useRef } from "react";
import { toast } from "sonner";

export interface DataTableRowActionsProps {
  id: string;
  profileId: string;
  simulationId?: string;
  departmentId?: string;
  scenarios: Array<{ completed: boolean }>;
  interactionIds: string[];
  isPractice?: boolean;
  infiniteMode?: boolean;
  timeLimit?: number | null; // simulation time limit in seconds (from server)
  attemptCreatedAt?: string;
  archived?: boolean;
  showArchive?: boolean;
  canView?: boolean; // from SQL showView
  canContinue?: boolean; // from SQL showContinue
  practiceScenarioId?: string; // first scenario_id from attempt (for practice retry)
  practiceSimulation?: boolean; // whether this is a practice simulation
  revalidateAttemptAction?: (attemptId: string) => Promise<void>; // Optional: for redirect after retry/continue
}

export function DataTableRowActions({
  id,
  profileId,
  simulationId,
  scenarios: _scenarios,
  interactionIds: _interactionIds,
  isPractice = false,
  infiniteMode = false,
  timeLimit = null,
  attemptCreatedAt,
  archived: _archived = false,
  showArchive: _showArchive = false,
  canView: _canView,
  canContinue,
  practiceScenarioId,
  practiceSimulation = false,
  revalidateAttemptAction,
}: DataTableRowActionsProps) {
  const { effectiveProfile, activeProfile, isConnected, emitStartSimulation } =
    useProfile();
  const router = useRouter();
  const [isRetrying, setIsRetrying] = React.useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const loadingToastIdRef = useRef<string | number | null>(null);

  const isCurrentUser = effectiveProfile?.id === profileId;

  // Infinite-mode window check (owner-only)
  const isInfiniteWindowOpen = React.useMemo(() => {
    if (!infiniteMode) return false;
    if (!timeLimit || !attemptCreatedAt) return true; // no limit => open
    const started = new Date(attemptCreatedAt).getTime();
    if (Number.isNaN(started)) return false;
    const elapsedMin = (Date.now() - started) / 60000;
    const timeLimitMinutes = timeLimit / 60; // Convert from seconds to minutes
    return elapsedMin <= timeLimitMinutes;
  }, [infiniteMode, timeLimit, attemptCreatedAt]);

  // Final decision:
  // - Continue only if server says it CAN continue,
  // - and it's the owner,
  // - and (if infinite mode) the time window is still open.
  const wantContinue =
    Boolean(canContinue) &&
    isCurrentUser &&
    (!infiniteMode || isInfiniteWindowOpen);

  const buttonText = wantContinue ? "Continue" : "View";
  const disabledForEmulation = effectiveProfile?.id !== activeProfile?.id;
  const linkHref = `/${isPractice ? "practice" : "home"}/a/${id}`;

  // Determine if we should show Retry or Try button
  // Only show if not emulating (effectiveProfile.id === activeProfile.id)
  const isNotEmulating = effectiveProfile?.id === activeProfile?.id;
  const isOwnAttempt = activeProfile?.id === profileId;
  const shouldShowRetry =
    isNotEmulating &&
    isOwnAttempt &&
    (simulationId ?? "") !== "" &&
    !canContinue;
  const shouldShowTry =
    isNotEmulating && !isOwnAttempt && (simulationId ?? "") !== "";

  // Set up redirect listener for simulation started events (only if revalidateAttemptAction is provided)
  useEffect(() => {
    if (!revalidateAttemptAction) return;

    const handleSimulationStarted = async (event: CustomEvent) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (loadingToastIdRef.current) {
        toast.dismiss(loadingToastIdRef.current);
        loadingToastIdRef.current = null;
      }
      setIsRetrying(false);
      const { attemptId } = event.detail;
      // Invalidate cache and refresh current page before navigation to ensure fresh data
      await revalidateAttemptAction(attemptId);
      router.refresh(); // Refresh current page data so it's updated when user returns
      router.push(`/${isPractice ? "practice" : "home"}/a/${attemptId}`);
    };

    const handleSimulationError = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (loadingToastIdRef.current) {
        toast.dismiss(loadingToastIdRef.current);
        loadingToastIdRef.current = null;
      }
      setIsRetrying(false);
      toast.error("Failed to start simulation. Please try again.");
    };

    window.addEventListener(
      "simulationStarted",
      handleSimulationStarted as unknown as EventListener
    );
    window.addEventListener("simulationError", handleSimulationError);

    return () => {
      window.removeEventListener(
        "simulationStarted",
        handleSimulationStarted as unknown as EventListener
      );
      window.removeEventListener("simulationError", handleSimulationError);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [router, revalidateAttemptAction, isPractice]);

  const handleStartSimulation = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabledForEmulation || !isConnected) return;
    setIsRetrying(true);

    // Show loading toast if revalidateAttemptAction is provided (for redirect flow)
    if (revalidateAttemptAction) {
      const toastId = toast.loading("Starting simulation...", {
        dismissible: true,
      });
      loadingToastIdRef.current = toastId;

      // Set timeout for simulation start
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        toast.dismiss(toastId);
        toast.error("Simulation start timed out. Please try again.");
        loadingToastIdRef.current = null;
        setIsRetrying(false);
      }, 30000);
    }

    try {
      const profileIdForEmit =
        effectiveProfile?.role === "guest"
          ? ""
          : String(effectiveProfile?.id || "");
      emitStartSimulation({
        simulation_id: String(simulationId),
        profile_id: profileIdForEmit,
        scenario_id:
          practiceSimulation && practiceScenarioId ? practiceScenarioId : null,
        ...(infiniteMode ? { infinite: true } : {}),
      });
    } catch {
      if (loadingToastIdRef.current) {
        toast.dismiss(loadingToastIdRef.current);
        loadingToastIdRef.current = null;
      }
      setIsRetrying(false);
      toast.error("Failed to start simulation. Please try again.");
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Link href={linkHref}>
        <Button
          variant="outline"
          size="sm"
          className={`h-8${wantContinue ? " min-w-[96px]" : ""}`}
        >
          {buttonText}
        </Button>
      </Link>

      {/* Retry: show when attempt belongs to activeProfile and not emulating */}
      {shouldShowRetry && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Retry"
              className="h-8 w-8 inline-flex items-center justify-center border-input bg-background hover:bg-accent hover:text-accent-foreground"
              disabled={isRetrying}
              onClick={handleStartSimulation}
            >
              <RotateCcw
                className={`h-4 w-4 ${isRetrying ? "animate-spin" : ""}`}
              />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Retry</p>
          </TooltipContent>
        </Tooltip>
      )}

      {/* Start Simulation: show when attempt belongs to different profile and not emulating */}
      {shouldShowTry && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Start Simulation"
              className="h-8 w-8 inline-flex items-center justify-center border-input bg-background hover:bg-accent hover:text-accent-foreground"
              disabled={isRetrying}
              onClick={handleStartSimulation}
            >
              <ArrowRight
                className={`h-4 w-4 ${isRetrying ? "animate-spin" : ""}`}
              />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Try Simulation</p>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
