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
import { Skeleton } from "@/components/ui/skeleton";
import { HistorySkeleton } from "../common/history/SimulationHistory";
import { PracticeCustomizeDialog } from "./PracticeCustomizeDialog";
import PracticeZone, { PracticeZoneSkeleton } from "./PracticeZone";

export interface PracticeProps {
  practiceData: PracticeOut;
  revalidateAttemptAction: (attemptId: string) => Promise<void>;
}

export default function Practice({
  practiceData,
  revalidateAttemptAction,
}: PracticeProps) {
  const router = useRouter();

  const {
    effectiveProfile,
    activeProfile,
    isConnected,
    emitStartSimulation,
    emitCreatePracticeScenario,
    startingSimulationId,
  } = useProfile();

  // Use WebSocket's specific simulation ID for precise loading state
  const loadingSimulation = startingSimulationId;
  const [loadingToastId, setLoadingToastId] = useState<string | number | null>(
    null
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
  const departmentMapping = useMemo(
    () => bundle?.department_mapping || {},
    [bundle?.department_mapping]
  );
  const validDepartmentIds = useMemo(
    () => bundle?.valid_department_ids || [],
    [bundle?.valid_department_ids]
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
    const handleSimulationStarted = async (event: CustomEvent) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (loadingToastId) {
        toast.dismiss(loadingToastId);
        setLoadingToastId(null);
      }
      setIsStartingAttempt(false); // Reset practice scenario loading state
      const { attemptId } = event.detail;
      // Invalidate cache and refresh current page before navigation to ensure fresh data
      await revalidateAttemptAction(attemptId);
      router.refresh(); // Refresh current page data so it's updated when user returns
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
      setIsStartingAttempt(false); // Reset practice scenario loading state
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
  }, [router, loadingToastId, revalidateAttemptAction]);

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

  const handleStartInfiniteMode = useCallback(
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

        const toastId = toast.loading("Starting infinite mode...", {
          dismissible: true,
        });
        setLoadingToastId(toastId);

        const profileIdForEmit =
          effectiveProfile?.role === "guest" ? "" : String(activeProfile!.id); // "" → guest

        emitStartSimulation({
          simulation_id: simulationId,
          profile_id: profileIdForEmit,
          infinite: true,
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
        toast.error("Failed to start infinite mode. Please try again.");
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
          onStartInfiniteMode={handleStartInfiniteMode}
          loadingSimulation={loadingSimulation}
        />
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
          departmentMapping={departmentMapping}
          validDepartmentIds={validDepartmentIds}
          onStartAttempt={async (params) => {
            if (!isConnected) {
              toast.error("WebSocket not connected. Please refresh the page.");
              return;
            }

            setIsStartingAttempt(true);
            const profileIdForEmit =
              effectiveProfile?.role === "guest"
                ? ""
                : String(effectiveProfile?.id || "");

            // Standard mode - use create_practice_scenario WebSocket event
            // Store toast ID so it can be dismissed when simulation starts
            const practiceToastId = toast.loading(
              "Creating practice scenario...",
              {
                dismissible: true,
              }
            );
            setLoadingToastId(practiceToastId);

            // Set timeout for practice scenario creation
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            timeoutRef.current = setTimeout(() => {
              toast.dismiss(practiceToastId);
              toast.error(
                "Practice scenario creation timed out. Please try again."
              );
              setLoadingToastId(null);
              setIsStartingAttempt(false);
            }, 30000);

            emitCreatePracticeScenario({
              persona_id: params.personaId || null,
              parameter_item_ids: params.parameterItemIds || [],
              department_id: params.departmentId || null,
              profile_id: profileIdForEmit,
              infinite_mode: false,
            });
            setCustomizeOpen(false);
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

export function PracticeSkeleton() {
  const HISTORY_ROWS = 5;

  return (
    <div className="space-y-12">
      {/* Practice Zone */}
      <section className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-7 w-48" />
            <div className="flex flex-wrap gap-2">
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-5 w-24 rounded-full" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-32 rounded-lg" />
            <Skeleton className="h-10 w-10 rounded-lg" />
          </div>
        </div>

        <PracticeZoneSkeleton />
      </section>

      {/* Simulation history */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Skeleton className="h-6 w-40" />
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-28 rounded-lg" />
            <Skeleton className="h-10 w-28 rounded-lg" />
          </div>
        </div>

        <HistorySkeleton rows={HISTORY_ROWS} />
      </section>
    </div>
  );
}
