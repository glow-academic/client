/**
 * Practice.tsx
 * Practice page for the user.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */
"use client";
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
import { useProfile } from "@/contexts/profile-context";
import { useWebSocket } from "@/contexts/websocket-context";
import { api } from "@/lib/api/client";
import { keys } from "@/lib/query/keys";
import { useQuery } from "@tanstack/react-query";
// Note: createPracticeScenario endpoint is deprecated on backend (returns 410)
// This functionality needs to be re-implemented or removed
import SimulationHistory from "../common/history/SimulationHistory";
import { Skeleton } from "../ui/skeleton";
import { PracticeCustomizeDialog } from "./PracticeCustomizeDialog";
import PracticeZone from "./PracticeZone";

export default function Practice() {
  const router = useRouter();
  const { effectiveDepartmentIds } = useProfile();

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
  // Practice customize dialog state
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [isStartingAttempt, setIsStartingAttempt] = useState(false);

  // Listen for customize button click from layout
  useEffect(() => {
    const handleOpenCustomize = () => setCustomizeOpen(true);
    window.addEventListener("openPracticeCustomize", handleOpenCustomize);
    return () =>
      window.removeEventListener("openPracticeCustomize", handleOpenCustomize);
  }, []);

  // Practice uses simplified filters: only profileId and departmentIds
  // No date/cohort/role filtering for personal practice
  const filters = useMemo(
    () => ({
      profileId: effectiveProfile?.id || "",
      departmentIds: effectiveDepartmentIds,
    }),
    [effectiveProfile?.id, effectiveDepartmentIds]
  );

  // Single optimized bundle call with items, history, and mappings
  const { data: bundle, isLoading: isPracticeOverviewLoading } = useQuery({
    queryKey: keys.practice.with(filters),
    queryFn: () => api.post("/practice", { body: filters }),
  });

  // Extract data from bundle
  const practiceOverview = bundle;
  const historyData = bundle?.history;
  const isHistoryLoading = isPracticeOverviewLoading;

  // Extract entity mappings for PracticeCustomizeDialog (memoized to prevent reference changes)
  const personaMapping = useMemo(
    () => bundle?.persona_mapping || {},
    [bundle?.persona_mapping]
  );
  const scenarioMapping = useMemo(
    () => bundle?.scenario_mapping || {},
    [bundle?.scenario_mapping]
  );
  const parameterMapping = useMemo(
    () => bundle?.parameter_mapping || {},
    [bundle?.parameter_mapping]
  );
  const parameterItemMapping = useMemo(
    () => bundle?.parameter_item_mapping || {},
    [bundle?.parameter_item_mapping]
  );
  const simulationMapping = useMemo(
    () => bundle?.simulation_mapping || {},
    [bundle?.simulation_mapping]
  );

  // Normalize simulation items to ensure required fields are present
  const simulationItems = useMemo(() => {
    if (!practiceOverview?.items) return [];

    return practiceOverview.items.map((item) => ({
      ...item,
      // Ensure simulationDescription is always present (string | null, not undefined)
      simulationDescription: item.simulationDescription ?? null,
    }));
  }, [practiceOverview?.items]);

  // Extract rubric mappings from practice overview data
  const standardGroupsMapping = useMemo(
    () => practiceOverview?.standard_groups_mapping || {},
    [practiceOverview]
  );
  const standardsMapping = useMemo(
    () => practiceOverview?.standards_mapping || {},
    [practiceOverview]
  );

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
          return;
        }

        const toastId = toast.loading("Starting simulation...", {
          dismissible: true,
        });
        setLoadingToastId(toastId);

        const profileIdForEmit =
          effectiveProfile?.role === "guest" ? "" : String(activeProfile!.id); // "" → guest

        emitStartSimulation({
          simulation_id: simulationId,
          profile_id: profileIdForEmit,
        });

        // timeout...
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
          toast.dismiss(toastId);
          toast.error("Simulation start timed out. Please try again.");
          setLoadingToastId(null);
        }, 30000);
      } catch {
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
          standardGroupsMapping={
            standardGroupsMapping as Record<
              string,
              {
                name: string;
                description: string;
                points: number;
                passPoints: number;
              }
            >
          }
          standardsMapping={
            standardsMapping as Record<
              string,
              { name: string; description: string; points: number }
            >
          }
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
                  ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    historyData.map((item: any) => ({
                      attemptId: item.attemptId,
                      date: new Date(item.date),
                      profileId: item.profileId,
                      profileName: item.profileName,
                      simulationName: item.simulationName,
                      numScenarios: item.numScenarios,
                      numScenariosCompleted: item.numScenariosCompleted,
                      infiniteMode: item.infiniteMode,
                      timeLimit: item.timeLimit ?? null, // timeLimit comes from server in seconds
                      personaNames: item.personaNames,
                      personaColors: item.personaColors,
                      score: item.score,
                      simulation_id: item.simulation_id,
                      department_id: item.department_ids?.[0] ?? "",
                      scenario_titles: item.scenario_titles,
                      scenario_ids: item.scenario_ids,
                      isArchived: item.isArchived,
                      showView: item.showView,
                      showContinue: item.showContinue,
                      practiceSimulation: item.practiceSimulation,
                      passPct: item.passPct || 70, // Use rubric pass percentage or default to 70
                      cohortNames: item.cohortNames,
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

      {/* Practice Customize Dialog */}
      {customizeOpen && (
        <PracticeCustomizeDialog
          open={customizeOpen}
          onClose={() => setCustomizeOpen(false)}
          personaMapping={personaMapping}
          scenarioMapping={scenarioMapping}
          parameterMapping={parameterMapping}
          parameterItemMapping={parameterItemMapping}
          simulationMapping={simulationMapping}
          onStartAttempt={async (params) => {
            if (params.timeLimit) {
              // Infinite mode - use WebSocket
              if (!isConnected) {
                toast.error(
                  "WebSocket not connected. Please refresh the page."
                );
                return;
              }
              const profileIdForEmit =
                effectiveProfile?.role === "guest"
                  ? ""
                  : String(effectiveProfile?.id || "");
              toast.loading("Starting simulation...", {
                dismissible: true,
              });
              emitStartSimulation({
                simulation_id: params.simulationId,
                profile_id: profileIdForEmit,
                infinite: true,
                infinite_time_limit: params.timeLimit,
              });
              setCustomizeOpen(false);
            } else {
              // Custom one-off scenario
              setIsStartingAttempt(true);
              const startToastId = toast.loading(
                "Creating practice scenario...",
                {
                  dismissible: true,
                }
              ) as unknown as string;

              try {
                // TODO: Re-implement practice scenario creation
                // The old endpoint is deprecated (returns 410)
                // For now, show an error message
                // TODO: Re-implement practice scenario creation
                // The old endpoint is deprecated (returns 410)
                // For now, show an error message
                toast.error(
                  "Practice scenario creation is currently unavailable",
                  {
                    id: startToastId,
                    description:
                      "This feature is being updated. Please use existing scenarios.",
                    dismissible: true,
                  }
                );

                // Commenting out old code until re-implemented:
                // const result = await createPracticeScenario({
                //   personaId: params.personaId!,
                //   parameterItemIds: params.parameterItemIds || [],
                //   profileId: effectiveProfile?.id || "",
                // });
                //
                // if (result.success && result.scenario) {
                //   toast.success("Practice scenario created!", {
                //     id: startToastId,
                //     dismissible: true,
                //   });
                //   router.push("/practice");
                // } else {
                //   throw new Error(result.message || "Failed to create practice scenario");
                // }
              } catch (error) {
                toast.error(
                  error instanceof Error
                    ? error.message
                    : "Failed to start practice session",
                  {
                    id: "start-attempt",
                    dismissible: true,
                  }
                );
              } finally {
                setIsStartingAttempt(false);
                setCustomizeOpen(false);
              }
            }
          }}
          isStartingAttempt={isStartingAttempt}
          effectiveProfile={effectiveProfile!}
          activeProfile={activeProfile!}
        />
      )}
    </TooltipProvider>
  );
}
