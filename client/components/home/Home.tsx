/**
 * Home.tsx
 * This is the cohort dashboard component for the home page
 * @AshokSaravanan222 & @siladiea
 * 07/20/2025
 */
"use client";
import type { HomeOut } from "@/app/(main)/home/page";

import { useProfile } from "@/contexts/profile-context";

import SimulationCard, {
  SimulationCardSkeleton,
} from "@/components/common/layout/SimulationCard";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import SimulationHistory, {
  HistorySkeleton,
} from "../common/history/SimulationHistory";
import SimulationProgress, {
  SimulationProgressSkeleton,
  ViewMode,
} from "./SimulationProgress";

export interface HomeProps {
  homeData: HomeOut;
}

export default function Home({ homeData }: HomeProps) {
  const {
    effectiveProfile,
    activeProfile,
    isConnected,
    emitStartSimulation,
    startingSimulationId,
  } = useProfile();

  // Use data directly from props (fetched server-side)
  const homeOverview = homeData;
  const historyData = homeData?.history;

  // Extract rubric mappings from home overview data
  const standardGroupsMapping = useMemo(
    () => homeOverview?.standard_groups_mapping || {},
    [homeOverview]
  );
  const standardsMapping = useMemo(
    () => homeOverview?.standards_mapping || {},
    [homeOverview]
  );

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
      activeProfile,
      isConnected,
      emitStartSimulation,
      loadingToastId,
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

      // // 2) use cohort array order when available (especially TA)
      // const ai = Number.isFinite(a?.orderIndex)
      //   ? a.orderIndex!
      //   : Number.POSITIVE_INFINITY;
      // const bi = Number.isFinite(b?.orderIndex)
      //   ? b.orderIndex!
      //   : Number.POSITIVE_INFINITY;
      // if (ai !== bi) return ai - bi;

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

      // // 2) use cohort array order when available (especially TA)
      // const ai = Number.isFinite(a?.orderIndex)
      //   ? a.orderIndex!
      //   : Number.POSITIVE_INFINITY;
      // const bi = Number.isFinite(b?.orderIndex)
      //   ? b.orderIndex!
      //   : Number.POSITIVE_INFINITY;
      // if (ai !== bi) return ai - bi;

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
  if (!effectiveProfile) {
    return null;
  }

  if (!effectiveProfile || effectiveProfile.role === "guest") {
    return (
      <div>
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
      <div>
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
    <div className="space-y-8">
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
                id={item.id}
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
                  effectiveProfile={{
                    ...effectiveProfile,
                    role: effectiveProfile.role as
                      | "ta"
                      | "instructional"
                      | "superadmin"
                      | "admin"
                      | "guest",
                  }}
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
                  numScenarios: item.numScenarios ?? null,
                  numScenariosCompleted: item.numScenariosCompleted,
                  infiniteMode: item.infiniteMode,
                  timeLimit: item.timeLimit ?? null, // timeLimit comes from server in seconds
                  personaNames: item.personaNames,
                  personaColors: item.personaColors,
                  scenario_titles: item.scenario_titles,
                  score: item.score ?? null,
                  simulation_id: item.simulation_id,
                  department_id: item.department_ids?.[0] ?? "",
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
          showExport={true}
          showArchive={false}
          singleProfile={true}
        />
      </div>
    </div>
  );
}

export function HomeSkeleton() {
  const PROGRESS_ROWS = 5;
  const CARD_COUNT = 3;
  const HISTORY_ROWS = 5;

  return (
    <div className="space-y-8">
      {/* Header with title */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-64" />
      </div>

      {/* Progress Visualization Section */}
      <div className="space-y-6">
        <div className="max-h-96 overflow-y-auto space-y-4 pr-2">
          {Array.from({ length: PROGRESS_ROWS }).map((_, index) => (
            <SimulationProgressSkeleton key={`progress-${index}`} />
          ))}
        </div>
      </div>

      {/* Assignments List Section - Carousel */}
      <div className="space-y-4">
        {/* Header with navigation */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Skeleton className="h-9 w-9 rounded-lg" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-9 w-9 rounded-lg" />
          </div>
        </div>

        {/* Carousel container */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: CARD_COUNT }).map((_, index) => (
            <SimulationCardSkeleton key={`card-${index}`} />
          ))}
        </div>

        {/* Dots indicator */}
        <div className="flex justify-center space-x-2 mt-4">
          {Array.from({ length: CARD_COUNT }).map((_, index) => (
            <Skeleton
              key={`dot-${index}`}
              className={`h-2 rounded-full ${index === 0 ? "w-6" : "w-2"}`}
            />
          ))}
        </div>
      </div>

      {/* History Section */}
      <div className="mt-12">
        <HistorySkeleton rows={HISTORY_ROWS} />
      </div>
    </div>
  );
}
