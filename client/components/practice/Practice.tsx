/**
 * Practice.tsx
 * Practice page for the user.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */
"use client";
import { logError, logInfo } from "@/utils/logger";
import { useQuery } from "@tanstack/react-query";
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
import { getAllPersonas } from "@/utils/queries/personas/get-all-personas";
import { getAllProfiles } from "@/utils/queries/profiles/get-all-profiles";
import { getAllRubrics } from "@/utils/queries/rubrics/get-all-rubrics";
import { getAllScenarios } from "@/utils/queries/scenarios/get-all-scenarios";
import { getSimulationAttemptsByProfiles } from "@/utils/queries/simulation_attempts/get-simulation-attempts-by-profiles";
import { getSimulationChatGradesBySimulationChats } from "@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-simulationchats";
import { getSimulationChatsByAttempts } from "@/utils/queries/simulation_chats/get-simulation-chats-by-attempts";
import { getAllSimulations } from "@/utils/queries/simulations/get-all-simulations";
import SimulationHistory from "../common/history/SimulationHistory";
import { Skeleton } from "../ui/skeleton";
import PracticeZone from "./PracticeZone";

export default function Practice() {
  const router = useRouter();
  const [loadingSimulation, setLoadingSimulation] = useState<string | null>(
    null,
  );
  const [loadingToastId, setLoadingToastId] = useState<string | number | null>(
    null,
  );
  const timeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  // Use global WebSocket context instead of local connection
  const { isConnected, emitStartSimulation } = useWebSocket();
  const {
    effectiveProfile,
    activeProfile,
    isLoading: isProfileLoading,
  } = useProfile();

  const { data: simulations, isLoading: simulationsLoading } = useQuery({
    queryKey: ["simulations"],
    queryFn: () => getAllSimulations(),
  });

  const { data: scenarios } = useQuery({
    queryKey: ["scenarios"],
    queryFn: () => getAllScenarios(),
  });

  const { data: personas } = useQuery({
    queryKey: ["personas"],
    queryFn: () => getAllPersonas(),
  });

  // Fetch data needed for highest score calculation
  const { data: allProfiles } = useQuery({
    queryKey: ["profiles"],
    queryFn: () => getAllProfiles(),
  });

  const { data: allAttempts } = useQuery({
    queryKey: ["simulationAttempts"],
    queryFn: () => {
      if (!allProfiles) return [];
      return getSimulationAttemptsByProfiles(allProfiles.map((p) => p.id));
    },
    enabled: !!allProfiles && allProfiles.length > 0,
  });

  const { data: allChats } = useQuery({
    queryKey: ["simulationChats", allAttempts?.map((a) => a.id)?.sort() || []],
    queryFn: () => getSimulationChatsByAttempts(allAttempts!.map((a) => a.id)),
    enabled: !!allAttempts && allAttempts.length > 0,
  });

  const { data: allGrades } = useQuery({
    queryKey: ["simulationGrades", allChats?.map((c) => c.id)?.sort() || []],
    queryFn: () =>
      getSimulationChatGradesBySimulationChats(allChats!.map((c) => c.id)),
    enabled: !!allChats && allChats.length > 0,
  });

  const { data: allRubrics } = useQuery({
    queryKey: ["rubrics"],
    queryFn: () => getAllRubrics(),
  });

  const practiceSimulations = useMemo(() => {
    if (!simulations || !allRubrics) return [];

    // Filter for practice simulations and add highest score calculation
    return simulations
      .filter((sim) => sim.practiceSimulation)
      .map((simulation) => {
        // Get rubric for this simulation
        const rubric = allRubrics.find((r) => r.id === simulation.rubricId);

        // Calculate individual user's highest score for any profile with an ID (except guests)
        let highestScore = 0;
        let hasPassed = false;

        if (effectiveProfile?.id && effectiveProfile?.role !== "guest") {
          const userAttempts =
            allAttempts?.filter(
              (att) =>
                att.profileId === effectiveProfile.id! &&
                att.simulationId === simulation.id,
            ) || [];

          if (userAttempts.length > 0) {
            const userAttemptIds = userAttempts.map((att) => att.id);
            const userChats =
              allChats?.filter((c) => userAttemptIds.includes(c.attemptId)) ||
              [];
            const userGrades =
              allGrades?.filter((g) =>
                userChats?.some((c) => c.id === g.simulationChatId),
              ) || [];

            if (userGrades.length > 0) {
              // Calculate highest score as percentage
              const rubricTotalPoints = rubric?.points || 100;
              highestScore = Math.round(
                (Math.max(...userGrades.map((g) => g.score)) /
                  rubricTotalPoints) *
                  100,
              );
              hasPassed = userGrades.some((g) => g.passed);
            }
          }
        }

        return {
          ...simulation,
          highestScore,
          hasPassed,
        };
      });
  }, [
    simulations,
    allRubrics,
    effectiveProfile?.id,
    effectiveProfile?.role,
    allAttempts,
    allChats,
    allGrades,
  ]);

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
      logInfo("Navigating to simulation attempt", { attemptId });
      router.push(`/practice/a/${attemptId}`);
      setLoadingSimulation(null);
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
      setLoadingSimulation(null);
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
          logError("WebSocket not connected when trying to start simulation", {
            simulationId,
            profileId: effectiveProfile?.id,
            isConnected,
          });
          return;
        }

        setLoadingSimulation(simulationId);
        const toastId = toast.loading("Starting simulation...");
        setLoadingToastId(toastId);

        const profileIdForEmit =
          effectiveProfile?.role === "guest" ? "" : String(activeProfile!.id); // "" → guest

        logInfo("Starting simulation via global WebSocket", {
          simulationId,
          profileId: profileIdForEmit || "(guest)",
          isConnected,
        });

        emitStartSimulation({
          simulation_id: simulationId,
          profile_id: profileIdForEmit,
        });

        // timeout...
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
          logError("Simulation start timeout - no response from server");
          toast.dismiss(toastId);
          toast.error("Simulation start timed out. Please try again.");
          setLoadingSimulation(null);
          setLoadingToastId(null);
        }, 30000);
      } catch (error) {
        logError("Error starting simulation:", error);
        if (loadingToastId) toast.dismiss(loadingToastId);
        toast.error("Failed to start simulation. Please try again.");
        setLoadingSimulation(null);
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

  // Loading state
  if (simulationsLoading || isProfileLoading || !effectiveProfile) {
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
        {effectiveProfile?.role !== "guest" && (
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
        )}
      </div>
    );
  }

  // 4. RENDER NEW COMPONENT STRUCTURE
  return (
    <TooltipProvider>
      <div className="container mx-auto p-4 md:p-6 space-y-12">
        <PracticeZone
          simulations={practiceSimulations}
          profile={effectiveProfile}
          onStartSimulation={handleStartSimulation}
          loadingSimulation={loadingSimulation}
          scenarios={scenarios ?? []}
          personas={personas ?? []}
        />
        {/* History Section for non-guests */}
        {effectiveProfile?.role !== "guest" && (
          <div className="space-y-2">
            <SimulationHistory
              showAll={false}
              showExport={false}
              showPractice={true}
            />
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
