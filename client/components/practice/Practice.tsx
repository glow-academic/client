/**
 * Practice.tsx
 * Practice page for the user.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */
"use client";
import type { PracticeOut } from "@/app/(main)/practice/page";
import { useRouter } from "next/navigation";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { TooltipProvider } from "@/components/ui/tooltip";
import { useProfile } from "@/contexts/profile-context";
// Note: createPracticeScenario endpoint is deprecated on backend (returns 410)
// This functionality needs to be re-implemented or removed
import SimulationHistory from "../common/history/SimulationHistory";
import { PracticeCustomizeDialog } from "./PracticeCustomizeDialog";
import PracticeZone from "./PracticeZone";

export interface PracticeProps {
  practiceData: PracticeOut;
}

export default function Practice({ practiceData }: PracticeProps) {
  const router = useRouter();

  const {
    effectiveProfile,
    activeProfile,
    isConnected,
    emitStartSimulation,
    startingSimulationId,
  } = useProfile();

  // Use WebSocket's specific simulation ID for precise loading state
  const loadingSimulation = startingSimulationId;
  const [loadingToastId, setLoadingToastId] = useState<string | number | null>(
    null,
  );
  const timeoutRef = React.useRef<NodeJS.Timeout | null>(null);
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

  // Extract data from practiceData
  const bundle = practiceData;
  const practiceOverview = bundle;
  const historyData = practiceData?.history;

  // Extract entity mappings for PracticeCustomizeDialog (memoized to prevent reference changes)
  const personaMapping = useMemo(
    () => bundle?.persona_mapping || {},
    [bundle?.persona_mapping],
  );
  const scenarioMapping = useMemo(
    () => bundle?.scenario_mapping || {},
    [bundle?.scenario_mapping],
  );
  const parameterMapping = useMemo(
    () => bundle?.parameter_mapping || {},
    [bundle?.parameter_mapping],
  );
  const parameterItemMapping = useMemo(
    () => bundle?.parameter_item_mapping || {},
    [bundle?.parameter_item_mapping],
  );
  const simulationMapping = useMemo(
    () => bundle?.simulation_mapping || {},
    [bundle?.simulation_mapping],
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
    [practiceOverview],
  );
  const standardsMapping = useMemo(
    () => practiceOverview?.standards_mapping || {},
    [practiceOverview],
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
      handleSimulationStarted as EventListener,
    );
    window.addEventListener("simulationError", handleSimulationError);

    return () => {
      window.removeEventListener(
        "simulationStarted",
        handleSimulationStarted as EventListener,
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
            "WebSocket not connected. Please wait for connection or refresh the page.",
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
    ],
  );

  if (!effectiveProfile) {
    return null;
  }

  // 4. RENDER NEW COMPONENT STRUCTURE
  return (
    <TooltipProvider>
      <div className="space-y-12">
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
          profile={{
            ...effectiveProfile,
            role: effectiveProfile.role as
              | "ta"
              | "instructional"
              | "superadmin"
              | "admin"
              | "guest",
          }}
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
                  "WebSocket not connected. Please refresh the page.",
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
                },
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
                  },
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
                  },
                );
              } finally {
                setIsStartingAttempt(false);
                setCustomizeOpen(false);
              }
            }
          }}
          isStartingAttempt={isStartingAttempt}
          effectiveProfile={{
            ...effectiveProfile!,
            role: effectiveProfile!.role as
              | "ta"
              | "instructional"
              | "superadmin"
              | "admin"
              | "guest",
          }}
          activeProfile={{
            ...activeProfile!,
            role: activeProfile!.role as
              | "ta"
              | "instructional"
              | "superadmin"
              | "admin"
              | "guest",
          }}
        />
      )}
    </TooltipProvider>
  );
}
