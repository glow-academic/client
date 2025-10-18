/**
 * Home.tsx
 * This is the cohort dashboard component for the home page
 * @AshokSaravanan222 & @siladiea
 * 07/20/2025
 */
"use client";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

import { useAnalytics } from "@/contexts/analytics-context";
import { useProfile } from "@/contexts/profile-context";
import { useWebSocket } from "@/contexts/websocket-context";
import { useAnalyticsHomeOverview } from "@/lib/api/v2/hooks/analytics";
import { useLogger } from "@/lib/api/v2/hooks/logs";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import SimulationProgress, {
  ViewMode,
} from "../common/cohort/SimulationProgress";
import SimulationHistory from "../common/history/SimulationHistory";
import SimulationCard from "../common/simulation/SimulationCard";

export default function Home() {
  const { effectiveProfile, activeProfile, cohortIds, effectiveDepartmentIds } =
    useProfile();
  const log = useLogger();
  const {
    startDate,
    endDate,
    selectedCohortIds,
    selectedRoles,
    simulationFilters,
  } = useAnalytics();

  // Use all user's cohorts if none specifically selected (same pattern as departments)
  const effectiveCohortIds =
    selectedCohortIds.length > 0 ? selectedCohortIds : cohortIds;

  // Memoized filters for analytics query
  const filters = useMemo(
    () => ({
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      cohortIds: effectiveCohortIds,
      roles: selectedRoles,
      simulationFilters: simulationFilters?.map((f) => f.toLowerCase()) as (
        | "general"
        | "practice"
        | "archived"
      )[],
      // Always send profileId - server will decide whether to use it based on role
      profileId: effectiveProfile?.id || undefined,
      departmentIds: effectiveDepartmentIds,
    }),
    [
      startDate,
      endDate,
      effectiveCohortIds,
      selectedRoles,
      simulationFilters,
      effectiveProfile?.id,
      effectiveDepartmentIds,
    ]
  );

  // Single optimized bundle call with items, history, and mappings
  const { data: bundle, isLoading: isHomeOverviewLoading } =
    useAnalyticsHomeOverview(filters);

  // Extract data from bundle
  const homeOverview = bundle;
  const historyData = bundle?.history;
  const isHistoryLoading = isHomeOverviewLoading;

  // Build simulations array from mapping
  const simulations = useMemo(
    () =>
      Object.entries(bundle?.simulation_mapping || {}).map(([id, sim]) => ({
        id,
        title: sim.name,
        description: sim.description,
        departmentId: effectiveDepartmentIds[0] || "", // Use first department
      })),
    [bundle?.simulation_mapping, effectiveDepartmentIds]
  );

  // Extract rubric mappings from home overview data
  const standardGroupsMapping = useMemo(
    () => homeOverview?.standard_groups_mapping || {},
    [homeOverview]
  );
  const standardsMapping = useMemo(
    () => homeOverview?.standards_mapping || {},
    [homeOverview]
  );

  const { isConnected, emitStartSimulation, startingSimulationId } =
    useWebSocket();

  const [carouselIndex, setCarouselIndex] = useState(0);
  // Use WebSocket's specific simulation ID for precise loading state
  const loadingSimulation = startingSimulationId;
  const [loadingToastId, setLoadingToastId] = useState<string | number | null>(
    null
  );
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const router = useRouter();

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
        context: { component: "Home", function: "handleSimulationStarted" },
      });
      router.push(`/home/a/${attemptId}`);
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
  }, [router, loadingToastId, log]);

  const handleStartSimulation = useCallback(
    async (simulationId: string) => {
      try {
        // Only enforce profile for non-guests
        if (effectiveProfile?.role !== "guest" && !effectiveProfile?.id) {
          toast.error("Profile not loaded. Please refresh the page.");
          return;
        }

        // Validate department_id is available
        if (effectiveDepartmentIds.length === 0 || !effectiveDepartmentIds[0]) {
          toast.error("No department found. Please contact support.");
          return;
        }

        if (!isConnected) {
          toast.error(
            "WebSocket not connected. Please wait for connection or refresh the page."
          );
          log.error("simulation.start.precheck.failed", {
            message: "WebSocket not connected when trying to start simulation",
            subject: { entityType: "simulation", entityId: simulationId },
            context: {
              component: "Home",
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
          context: {
            component: "Home",
            function: "handleStartSimulation",
            isConnected,
          },
        });
        const departmentId = simulations?.find(
          (simulation) => simulation.id === simulationId
        )?.departmentId;
        if (!departmentId) {
          toast.error("No department found. Please contact support.");
          return;
        }

        emitStartSimulation({
          simulation_id: simulationId,
          profile_id: profileIdForEmit,
          department_id: effectiveDepartmentIds[0] || "",
        });

        // timeout...
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
          log.error("simulation.start.timeout", {
            message: "Simulation start timeout - no response from server",
            subject: { entityType: "simulation", entityId: simulationId },
            context: { component: "Home", function: "handleStartSimulation" },
          });
          toast.dismiss(toastId);
          toast.error("Simulation start timed out. Please try again.");
          setLoadingToastId(null);
        }, 30000);
      } catch (err) {
        log.error("simulation.start.failed", {
          message: "Error starting simulation",
          subject: { entityType: "simulation", entityId: simulationId },
          context: { component: "Home", function: "handleStartSimulation" },
          error: err,
        });
        if (loadingToastId) toast.dismiss(loadingToastId);
        toast.error("Failed to start simulation. Please try again.");
        setLoadingToastId(null);
      }
    },
    [
      effectiveProfile,
      activeProfile,
      isConnected,
      emitStartSimulation,
      loadingToastId,
      effectiveDepartmentIds,
      simulations,
      log,
    ]
  );

  // Use data directly from the hook
  const simulationItems = useMemo(() => {
    return homeOverview?.items ?? [];
  }, [homeOverview?.items]);

  // Sort simulations by completion status and then by cohort
  const sortedSimulations = useMemo(() => {
    if (simulationItems[0]?.viewMode === "instructional") {
      // Server already sorted with: passed → cohortName → cohort order → title
      return simulationItems;
    }
    // TA: keep orderIndex before cohortName
    const items = [...(simulationItems ?? [])];
    return items.sort((a, b) => {
      if (!a || !b) return 0;

      // 1) incomplete first (hasPassed false first)
      if (!!a?.hasPassed !== !!b?.hasPassed) return a?.hasPassed ? 1 : -1;

      // 2) use cohort array order when available (especially TA)
      const ai = Number.isFinite(a?.orderIndex)
        ? a.orderIndex!
        : Number.POSITIVE_INFINITY;
      const bi = Number.isFinite(b?.orderIndex)
        ? b.orderIndex!
        : Number.POSITIVE_INFINITY;
      if (ai !== bi) return ai - bi;

      // 3) cohort name alpha as a softer signal
      const ca = (a?.cohortName || "").toLowerCase();
      const cb = (b?.cohortName || "").toLowerCase();
      if (ca !== cb) return ca < cb ? -1 : 1;

      // 4) title alpha
      const ta = (a?.simulationTitle || "").toLowerCase();
      const tb = (b?.simulationTitle || "").toLowerCase();
      if (ta !== tb) return ta < tb ? -1 : 1;

      return 0;
    });
  }, [simulationItems]);

  // Sort progress data the same way as the cards (non-completed first, then by cohort)
  const sortedProgressData = useMemo(() => {
    if (simulationItems[0]?.viewMode === "instructional") {
      // Server already sorted with: passed → cohortName → cohort order → title
      return simulationItems;
    }
    // TA: keep orderIndex before cohortName
    const items = [...(simulationItems ?? [])];
    return items.sort((a, b) => {
      if (!a || !b) return 0;

      // 1) incomplete first (hasPassed false first)
      if (!!a?.hasPassed !== !!b?.hasPassed) return a?.hasPassed ? 1 : -1;

      // 2) use cohort array order when available (especially TA)
      const ai = Number.isFinite(a?.orderIndex)
        ? a.orderIndex!
        : Number.POSITIVE_INFINITY;
      const bi = Number.isFinite(b?.orderIndex)
        ? b.orderIndex!
        : Number.POSITIVE_INFINITY;
      if (ai !== bi) return ai - bi;

      // 3) cohort name alpha as a softer signal
      const ca = (a?.cohortName || "").toLowerCase();
      const cb = (b?.cohortName || "").toLowerCase();
      if (ca !== cb) return ca < cb ? -1 : 1;

      // 4) title alpha
      const ta = (a?.simulationTitle || "").toLowerCase();
      const tb = (b?.simulationTitle || "").toLowerCase();
      if (ta !== tb) return ta < tb ? -1 : 1;

      return 0;
    });
  }, [simulationItems]);

  // Carousel logic
  const maxVisible = 3;
  const totalPages = Math.ceil(sortedSimulations.length / maxVisible);
  const canScrollLeft = carouselIndex > 0;
  const canScrollRight = carouselIndex < totalPages - 1;

  const handlePrevious = useCallback(() => {
    if (canScrollLeft) {
      setCarouselIndex(carouselIndex - 1);
    }
  }, [canScrollLeft, carouselIndex]);

  const handleNext = useCallback(() => {
    if (canScrollRight) {
      setCarouselIndex(carouselIndex + 1);
    }
  }, [canScrollRight, carouselIndex]);

  // Get simulations for current page
  const startIndex = carouselIndex * maxVisible;
  const endIndex = startIndex + maxVisible;
  const visibleSimulations = sortedSimulations.slice(startIndex, endIndex);

  // Loading state
  // const isLoading = isFilteredDataLoading;

  // Optional guard before rendering main body
  if (isHomeOverviewLoading || isHistoryLoading) {
    return (
      <div className="container mx-auto p-4 space-y-8">
        {/* Header skeleton */}
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-64" />
        </div>

        {/* Progress Visualization Section skeleton */}
        <div className="space-y-6">
          <div className="max-h-96 overflow-y-auto space-y-4 pr-2">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="flex items-center space-x-4 p-3 rounded-lg border bg-gray-50 dark:bg-gray-800"
              >
                <Skeleton className="h-4 w-32" />
                <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <Skeleton className="h-2 w-1/2 rounded-full" />
                </div>
                <Skeleton className="h-6 w-16" />
                <Skeleton className="h-4 w-12" />
              </div>
            ))}
          </div>
        </div>

        {/* Assignments List Section skeleton */}
        <div className="space-y-4">
          {/* Header with navigation skeleton */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Skeleton className="h-8 w-8 rounded-lg" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-8 w-8 rounded-lg" />
            </div>
          </div>

          {/* Carousel container skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => (
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

          {/* Dots indicator skeleton */}
          <div className="flex justify-center space-x-2 mt-4">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="w-2 h-2 rounded-full" />
            ))}
          </div>
        </div>

        {/* History Section skeleton */}
        <div className="mt-12 space-y-4">
          <Skeleton className="h-6 w-32" />
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="flex items-center space-x-4 p-3 rounded-lg border bg-gray-50 dark:bg-gray-800"
              >
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!effectiveProfile) {
    return (
      <div className="container mx-auto p-4 space-y-8">
        {/* Header skeleton */}
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-64" />
        </div>

        {/* Progress Visualization Section skeleton */}
        <div className="space-y-6">
          <div className="max-h-96 overflow-y-auto space-y-4 pr-2">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="flex items-center space-x-4 p-3 rounded-lg border bg-gray-50 dark:bg-gray-800"
              >
                <Skeleton className="h-4 w-32" />
                <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <Skeleton className="h-2 w-1/2 rounded-full" />
                </div>
                <Skeleton className="h-6 w-16" />
                <Skeleton className="h-4 w-12" />
              </div>
            ))}
          </div>
        </div>

        {/* Assignments List Section skeleton */}
        <div className="space-y-4">
          {/* Header with navigation skeleton */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Skeleton className="h-8 w-8 rounded-lg" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-8 w-8 rounded-lg" />
            </div>
          </div>

          {/* Carousel container skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => (
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

          {/* Dots indicator skeleton */}
          <div className="flex justify-center space-x-2 mt-4">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="w-2 h-2 rounded-full" />
            ))}
          </div>
        </div>

        {/* History Section skeleton */}
        <div className="mt-12 space-y-4">
          <Skeleton className="h-6 w-32" />
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="flex items-center space-x-4 p-3 rounded-lg border bg-gray-50 dark:bg-gray-800"
              >
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!effectiveProfile || effectiveProfile.role === "guest") {
    return (
      <div className="container mx-auto p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
          <p className="text-gray-600">
            You need TA permissions to view this dashboard.
          </p>
        </div>
      </div>
    );
  }

  if (!simulationItems.length) {
    return (
      <div className="container mx-auto p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">No Simulations Available</h1>
          <p className="text-gray-600">
            There are no simulations assigned to you. Please contact an
            administrator.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 space-y-8">
      {/* Header with title */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">
          Welcome back, {effectiveProfile?.firstName}!
        </h2>
      </div>

      {/* Progress Visualization Section - All progress bars grouped together */}
      <div className="space-y-6">
        <div className="max-h-96 overflow-y-auto space-y-4 pr-2">
          {sortedProgressData.map((item) =>
            item ? (
              <SimulationProgress
                key={item.id}
                viewMode={
                  item.viewMode === "ta" ? ViewMode.TA : ViewMode.INSTRUCTIONAL
                }
                {...(item.cohortName && { cohortName: item.cohortName })}
                {...(item.cohortNames &&
                  !item.cohortName && { cohortName: item.cohortNames })}
                simulationName={item.simulationName}
                status={item.status || "not-started"}
                completionPct={item.completionPct || 0}
                {...(typeof item.passedCount === "number" && {
                  passedCount: item.passedCount,
                })}
                {...(typeof item.inProgressCount === "number" && {
                  inProgressCount: item.inProgressCount,
                })}
                {...(typeof item.notStartedCount === "number" && {
                  notStartedCount: item.notStartedCount,
                })}
                {...(typeof item.passPct === "number" && {
                  passPct: item.passPct,
                })}
              />
            ) : null
          )}
        </div>
      </div>

      {/* Assignments List Section - All simulation cards in carousel */}
      {sortedSimulations.length > 0 && (
        <div className="space-y-4">
          {/* Header with navigation */}
          <div className="flex items-center justify-between">
            {totalPages > 1 && (
              <div className="flex items-center space-x-2">
                <button
                  onClick={handlePrevious}
                  disabled={!canScrollLeft}
                  className={`p-2 rounded-lg transition-colors ${
                    canScrollLeft
                      ? "bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
                      : "bg-gray-50 text-gray-300 dark:bg-gray-900 dark:text-gray-600 cursor-not-allowed"
                  }`}
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {carouselIndex + 1} of {totalPages}
                </span>
                <button
                  onClick={handleNext}
                  disabled={!canScrollRight}
                  className={`p-2 rounded-lg transition-colors ${
                    canScrollRight
                      ? "bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
                      : "bg-gray-50 text-gray-300 dark:bg-gray-900 dark:text-gray-600 cursor-not-allowed"
                  }`}
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>

          {/* Carousel container */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {visibleSimulations.map((item) =>
              item ? (
                <SimulationCard
                  key={item.id}
                  id={item.id}
                  {...(typeof item.timeLimit === "number" && {
                    timeLimit: item.timeLimit,
                  })}
                  numSessions={
                    typeof item.numSessions === "number" ? item.numSessions : 1
                  }
                  {...(typeof item.highestScore === "number" && {
                    highestScore: item.highestScore,
                  })}
                  simulationTitle={item.simulationTitle}
                  simulationDescription={item.simulationDescription || ""}
                  standard_groups={item.standard_groups}
                  standardGroupsMapping={standardGroupsMapping}
                  standardsMapping={standardsMapping}
                  {...(item.color && { color: item.color })}
                  {...(item.icon && { icon: item.icon })}
                  {...(typeof item.hasPassed === "boolean" && {
                    hasPassed: item.hasPassed,
                  })}
                  {...(typeof item.passRate === "number" && {
                    passRate: item.passRate,
                  })}
                  type="cohort"
                  onStartSimulation={handleStartSimulation}
                  loadingSimulation={loadingSimulation}
                  effectiveProfile={effectiveProfile}
                />
              ) : null
            )}
          </div>

          {/* Dots indicator */}
          {totalPages > 1 && (
            <div className="flex justify-center space-x-2 mt-4">
              {Array.from({ length: totalPages }, (_, index) => (
                <button
                  key={index}
                  onClick={() => setCarouselIndex(index)}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    index === carouselIndex
                      ? "bg-blue-500"
                      : "bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500"
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* History Section. Always show current user's history */}
      <div className="mt-12">
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
                  infiniteModeTimeLimit: item.infiniteModeTimeLimit,
                  personaNames: item.personaNames,
                  personaColors: item.personaColors,
                  scenario_titles: item.scenario_titles,
                  score: item.score,
                  simulation_id: item.simulation_id,
                  department_id: item.department_id,
                  scenario_ids: item.scenario_ids,
                  isArchived: item.isArchived,
                  showView: item.showView,
                  showContinue: item.showContinue,
                  practiceSimulation: item.practiceSimulation,
                  passPct: item.passPct || 70, // Use rubric pass percentage or default to 70
                }))
              : []
          }
          showExport={true}
          showArchive={false}
          singleProfile={true}
          isLoading={isHistoryLoading}
        />
      </div>
    </div>
  );
}
