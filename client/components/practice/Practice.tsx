/**
 * Practice.tsx
 * Practice page for the user.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */
"use client";
import { log } from "@/utils/logger";
import { useRouter } from "next/navigation";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";

import { TooltipProvider } from "@/components/ui/tooltip";
import { useAnalytics } from "@/contexts/analytics-context";
import { useProfile } from "@/contexts/profile-context";
import { useWebSocket } from "@/contexts/websocket-context";
import {
  useAnalyticsAttemptHistory,
  useAnalyticsPracticeOverview,
} from "@/lib/api/hooks/analytics";
import SimulationHistory from "../common/history/SimulationHistory";
import { Skeleton } from "../ui/skeleton";
import PracticeZone from "./PracticeZone";

export default function Practice() {
  const router = useRouter();

  // Use global WebSocket context instead of local connection
  const { isConnected, emitStartSimulation, startingSimulationId } =
    useWebSocket();

  // Use WebSocket's specific simulation ID for precise loading state
  const loadingSimulation = startingSimulationId;
  const [loadingToastId, setLoadingToastId] = useState<string | number | null>(
    null
  );
  const timeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const { effectiveProfile, activeProfile } = useProfile();
  const {
    startDate,
    endDate,
    selectedCohortIds,
    selectedRoles,
    simulationFilters,
  } = useAnalytics();

  // New optimized practice overview analytics
  const { data: practiceOverview, isLoading: isPracticeOverviewLoading } =
    useAnalyticsPracticeOverview({
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      cohortIds: selectedCohortIds,
      roles: selectedRoles,
      simulationFilters: simulationFilters?.map((f) => f.toLowerCase()) as (
        | "general"
        | "practice"
        | "archived"
      )[],
      // Always pass profileId for practice (personal view)
      profileId: effectiveProfile?.id,
    });

  // Fetch history data for the current user
  const { data: historyData, isLoading: isHistoryLoading } =
    useAnalyticsAttemptHistory({
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      cohortIds: selectedCohortIds,
      roles: selectedRoles,
      simulationFilters: simulationFilters?.map((f) => f.toLowerCase()) as (
        | "general"
        | "practice"
        | "archived"
      )[],
      // Only show current user's history
      profileId: effectiveProfile?.id,
    });

  // Use data directly from the hook
  const simulationItems = useMemo(() => {
    return practiceOverview?.items ?? [];
  }, [practiceOverview?.items]);

  // Set up simulation-specific event listeners using global WebSocket
  useEffect(() => {
    // Listen for successful simulation starts to handle navigation
    const handleSimulationStarted = (event: CustomEvent) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (loadingToastId) {
        toast.dismiss(loadingToastId);
        setLoadingToastId(null);
      }
      const { attemptId } = event.detail;
      log.info("simulation.navigate.attempt", {
        message: "Navigating to simulation attempt",
        subject: { entityType: "attempt", entityId: attemptId },
        context: { component: "Practice", function: "handleSimulationStarted" },
      });
      router.push(`/practice/a/${attemptId}`);
    };

    // Listen for simulation errors to reset loading state
    const handleSimulationError = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (loadingToastId) {
        toast.dismiss(loadingToastId);
        setLoadingToastId(null);
      }
      toast.error("Failed to start simulation. Please try again.");
    };

    window.addEventListener(
      "simulationStarted",
      handleSimulationStarted as EventListener
    );
    window.addEventListener("simulationError", handleSimulationError);

    return () => {
      window.removeEventListener(
        "simulationStarted",
        handleSimulationStarted as EventListener
      );
      window.removeEventListener("simulationError", handleSimulationError);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [router, loadingToastId]);

  const handleStartSimulation = useCallback(
    async (simulationId: string) => {
      try {
        // Only enforce profile for non-guests
        if (effectiveProfile?.role !== "guest" && !effectiveProfile?.id) {
          toast.error("Profile not loaded. Please refresh the page.");
          return;
        }

        if (!isConnected) {
          toast.error(
            "WebSocket not connected. Please wait for connection or refresh the page."
          );
          log.error("simulation.start.precheck.failed", {
            message: "WebSocket not connected when trying to start simulation",
            subject: { entityType: "simulation", entityId: simulationId },
            ...(effectiveProfile?.id
              ? { actor: { profileId: effectiveProfile.id } }
              : {}),
            context: {
              component: "Practice",
              function: "handleStartSimulation",
              isConnected,
            },
          });
          return;
        }

        const toastId = toast.loading("Starting simulation...", {
          dismissible: true,
        });
        setLoadingToastId(toastId);

        const profileIdForEmit =
          effectiveProfile?.role === "guest" ? "" : String(activeProfile!.id); // "" → guest

        log.info("simulation.start", {
          message: "Starting simulation via global WebSocket",
          subject: { entityType: "simulation", entityId: simulationId },
          ...(effectiveProfile?.id
            ? { actor: { profileId: effectiveProfile.id } }
            : {}),
          context: {
            component: "Practice",
            function: "handleStartSimulation",
            isConnected,
          },
        });

        emitStartSimulation({
          simulation_id: simulationId,
          profile_id: profileIdForEmit,
        });

        // timeout...
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
          log.error("simulation.start.timeout", {
            message: "Simulation start timeout - no response from server",
            subject: { entityType: "simulation", entityId: simulationId },
            ...(effectiveProfile?.id
              ? { actor: { profileId: effectiveProfile.id } }
              : {}),
            context: {
              component: "Practice",
              function: "handleStartSimulation",
            },
          });
          toast.dismiss(toastId);
          toast.error("Simulation start timed out. Please try again.");
          setLoadingToastId(null);
        }, 30000);
      } catch (error) {
        log.error("simulation.start.failed", {
          message: "Error starting simulation",
          subject: { entityType: "simulation", entityId: simulationId },
          ...(effectiveProfile?.id
            ? { actor: { profileId: effectiveProfile.id } }
            : {}),
          context: { component: "Practice", function: "handleStartSimulation" },
          error,
        });
        if (loadingToastId) toast.dismiss(loadingToastId);
        toast.error("Failed to start simulation. Please try again.");
        setLoadingToastId(null);
      }
    },
    [
      effectiveProfile,
      isConnected,
      emitStartSimulation,
      loadingToastId,
      activeProfile,
    ]
  );

  // Loading state
  if (isPracticeOverviewLoading || isHistoryLoading) {
    return (
      <div className="container mx-auto p-4 md:p-6 space-y-12">
        {/* Header skeleton */}
        <div className="space-y-4">
          <div className="flex items-center justify-between space-y-2">
            <div>
              <Skeleton className="h-8 w-48 mb-2" />
              <Skeleton className="h-4 w-64" />
            </div>
          </div>
        </div>

        {/* Practice Zone skeleton */}
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <Card
                key={i}
                className="overflow-hidden bg-white dark:bg-gray-900 border-0 shadow-lg"
              >
                <CardHeader className="pb-4">
                  <div className="flex items-start justify-between">
                    <Skeleton className="h-12 w-12 rounded-xl" />
                    <div className="text-right space-y-1">
                      <Skeleton className="h-3 w-12" />
                      <Skeleton className="h-3 w-10" />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Skeleton className="h-6 w-32 mb-2" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                  </div>
                  <div className="flex items-center space-x-4">
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </CardContent>
                <CardFooter className="pt-0">
                  <Skeleton className="h-10 w-full rounded-lg" />
                </CardFooter>
              </Card>
            ))}
          </div>
        </div>

        {/* History Section skeleton - only show if not guest */}
        <div className="space-y-2">
          <div className="space-y-4">
            <Skeleton className="h-6 w-32" />
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className="flex items-center space-x-4 p-3 rounded-lg border bg-gray-50 dark:bg-gray-800"
                >
                  <Skeleton className="h-4 w-24" />
                  <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <Skeleton className="h-2 w-1/3 rounded-full" />
                  </div>
                  <Skeleton className="h-6 w-16" />
                  <Skeleton className="h-4 w-12" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!effectiveProfile) {
    return (
      <div className="container mx-auto p-4 md:p-6 space-y-12">
        {/* Header skeleton */}
        <div className="space-y-4">
          <div className="flex items-center justify-between space-y-2">
            <div>
              <Skeleton className="h-8 w-48 mb-2" />
              <Skeleton className="h-4 w-64" />
            </div>
          </div>
        </div>

        {/* Practice Zone skeleton */}
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <Card
                key={i}
                className="overflow-hidden bg-white dark:bg-gray-900 border-0 shadow-lg"
              >
                <CardHeader className="pb-4">
                  <div className="flex items-start justify-between">
                    <Skeleton className="h-12 w-12 rounded-xl" />
                    <div className="text-right space-y-1">
                      <Skeleton className="h-3 w-12" />
                      <Skeleton className="h-3 w-10" />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Skeleton className="h-6 w-32 mb-2" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                  </div>
                  <div className="flex items-center space-x-4">
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </CardContent>
                <CardFooter className="pt-0">
                  <Skeleton className="h-10 w-full rounded-lg" />
                </CardFooter>
              </Card>
            ))}
          </div>
        </div>

        {/* History Section skeleton - only show if not guest */}
        <div className="space-y-2">
          <div className="space-y-4">
            <Skeleton className="h-6 w-32" />
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className="flex items-center space-x-4 p-3 rounded-lg border bg-gray-50 dark:bg-gray-800"
                >
                  <Skeleton className="h-4 w-24" />
                  <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <Skeleton className="h-2 w-1/3 rounded-full" />
                  </div>
                  <Skeleton className="h-6 w-16" />
                  <Skeleton className="h-4 w-12" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 4. RENDER NEW COMPONENT STRUCTURE
  return (
    <TooltipProvider>
      <div className="container mx-auto p-4 md:p-6 space-y-12">
        <PracticeZone
          simulations={simulationItems}
          profile={effectiveProfile}
          onStartSimulation={handleStartSimulation}
          loadingSimulation={loadingSimulation}
        />
        {/* History Section for non-guests */}
        {effectiveProfile?.role !== "guest" && (
          <div className="space-y-2">
            <SimulationHistory
              data={
                historyData
                  ? historyData.map((item) => ({
                      attemptId: item.attemptId,
                      date: new Date(item.date),
                      profileId: item.profileId,
                      profileName: item.profileName,
                      simulationName: item.simulationName,
                      numScenarios: item.numScenarios,
                      numScenariosCompleted: item.numScenariosCompleted,
                      infiniteMode: item.infiniteMode,
                      personaNames: item.personaNames,
                      personaColors: item.personaColors,
                      score: item.score,
                      simulation_id: item.simulation_id,
                      scenario_titles: item.scenario_titles,
                      scenario_ids: item.scenario_ids,
                      isArchived: item.isArchived,
                      showView: item.showView,
                      showContinue: item.showContinue,
                      practiceSimulation: item.practiceSimulation,
                      passPct: item.passPct || 70, // Use rubric pass percentage or default to 70
                    }))
                  : []
              }
              showExport={false}
              showArchive={false}
              singleProfile={true}
              isLoading={isHistoryLoading}
            />
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
