/**
 * Home.tsx
 * This is the cohort dashboard component for the home page
 * @AshokSaravanan222 & @siladiea
 * 07/20/2025
 */
"use client";
import type { HomeOut } from "@/app/(main)/home/page";

import { useProfile } from "@/contexts/profile-context";
import { useTrainingStart } from "@/hooks/useTrainingStart";

import SimulationCard, {
  SimulationCardSkeleton,
} from "@/components/common/layout/SimulationCard";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import SimulationProgress, {
  SimulationProgressSkeleton,
  ViewMode,
} from "./SimulationProgress";

export interface HomeProps {
  homeData: HomeOut;
}

export default function Home({ homeData }: HomeProps) {
  const { profile } = useProfile();

  // Use the unified training start hook for WebSocket-based simulation starts
  const { startTraining, startingSimulationId } = useTrainingStart({
    practice: false,
  });

  // Use data directly from props (fetched server-side)
  const homeOverview = homeData;

  // Extract rubric mappings from home overview data (arrays from composite types)
  // TableRubric component expects dicts, so we build them from arrays using efficient lookups
  const standardGroupsMapping = useMemo(() => {
    const groups = homeOverview?.standard_groups || [];
    // Build dict using array methods for efficient lookup
    return Object.fromEntries(
      groups
        .filter((group) => group.standard_group_id)
        .map((group) => [
          String(group.standard_group_id),
          {
            name: group.name,
            description: group.description,
            points: group.points,
            passPoints: group.pass_points,
          },
        ])
    );
  }, [homeOverview?.standard_groups]);

  const standardsMapping = useMemo(() => {
    const standards = homeOverview?.standards || [];
    // Build dict using array methods for efficient lookup
    return Object.fromEntries(
      standards
        .filter((standard) => standard.standard_id)
        .map((standard) => [
          String(standard.standard_id),
          {
            name: standard.name,
            description: standard.description,
            points: standard.points,
          },
        ])
    );
  }, [homeOverview?.standards]);

  // Helper to build standardGroups dict for a simulation item (group_id -> [standard_ids])
  const buildStandardGroupsDict = useCallback(
    (itemStandardGroups: string[]) => {
      const standards = homeOverview?.standards || [];
      const dict: Record<string, string[]> = {};
      for (const groupId of itemStandardGroups) {
        const standardIds = standards
          .filter((s) => s.standard_group_id === groupId)
          .map((s) => String(s.standard_id));
        if (standardIds.length > 0) {
          dict[groupId] = standardIds;
        }
      }
      return dict;
    },
    [homeOverview?.standards]
  );

  const [carouselIndex, setCarouselIndex] = useState(0);
  // Use WebSocket's specific simulation ID for precise loading state
  const loadingSimulation = startingSimulationId;

  // Handle starting a simulation via the unified training hook
  const handleStartSimulation = useCallback(
    (simulationId: string) => {
      startTraining({ simulationId });
    },
    [startTraining]
  );

  // Use data directly from the hook
  const simulationItems = useMemo(() => {
    return homeOverview?.items ?? [];
  }, [homeOverview?.items]);

  // Sort simulations by completion status and then by cohort
  const sortedSimulations = useMemo(() => {
    if (simulationItems[0]?.view_mode === "instructional") {
      // Server already sorted with: passed → cohort_name → cohort order → title
      return simulationItems;
    }
    // TA: keep orderIndex before cohort_name
    const items = [...(simulationItems ?? [])];
    return items.sort((a, b) => {
      if (!a || !b) return 0;

      // 1) incomplete first (has_passed false first)
      if (!!a?.has_passed !== !!b?.has_passed) return a?.has_passed ? 1 : -1;

      // // 2) use cohort array order when available (especially TA)
      // const ai = Number.isFinite(a?.orderIndex)
      //   ? a.orderIndex!
      //   : Number.POSITIVE_INFINITY;
      // const bi = Number.isFinite(b?.orderIndex)
      //   ? b.orderIndex!
      //   : Number.POSITIVE_INFINITY;
      // if (ai !== bi) return ai - bi;

      // 3) cohort name alpha as a softer signal
      const ca = (a?.cohort_names_junction || "").toLowerCase();
      const cb = (b?.cohort_names_junction || "").toLowerCase();
      if (ca !== cb) return ca < cb ? -1 : 1;

      // 4) title alpha
      const ta = (a?.simulation_name || "").toLowerCase();
      const tb = (b?.simulation_name || "").toLowerCase();
      if (ta !== tb) return ta < tb ? -1 : 1;

      return 0;
    });
  }, [simulationItems]);

  // Sort progress data the same way as the cards (non-completed first, then by cohort)
  const sortedProgressData = useMemo(() => {
    if (simulationItems[0]?.view_mode === "instructional") {
      // Server already sorted with: passed → cohort_name → cohort order → title
      return simulationItems;
    }
    // TA: keep orderIndex before cohort_name
    const items = [...(simulationItems ?? [])];
    return items.sort((a, b) => {
      if (!a || !b) return 0;

      // 1) incomplete first (has_passed false first)
      if (!!a?.has_passed !== !!b?.has_passed) return a?.has_passed ? 1 : -1;

      // // 2) use cohort array order when available (especially TA)
      // const ai = Number.isFinite(a?.orderIndex)
      //   ? a.orderIndex!
      //   : Number.POSITIVE_INFINITY;
      // const bi = Number.isFinite(b?.orderIndex)
      //   ? b.orderIndex!
      //   : Number.POSITIVE_INFINITY;
      // if (ai !== bi) return ai - bi;

      // 3) cohort name alpha as a softer signal
      const ca = (a?.cohort_names_junction || "").toLowerCase();
      const cb = (b?.cohort_names_junction || "").toLowerCase();
      if (ca !== cb) return ca < cb ? -1 : 1;

      // 4) title alpha
      const ta = (a?.simulation_name || "").toLowerCase();
      const tb = (b?.simulation_name || "").toLowerCase();
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

  // Access control is handled by AccessControl component in layout
  // If we reach here, user has access
  if (!profile) {
    return null;
  }

  return (
    <div className="space-y-8">
      {/* Header with title */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">
          Welcome back, {profile?.name}!
        </h2>
      </div>

      {!simulationItems.length ? (
        <div>
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">
              No Simulations Available
            </h1>
            <p className="text-gray-600">
              There are no simulations assigned to you. Please contact an
              administrator.
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Progress Visualization Section - All progress bars grouped together */}
          <div className="space-y-6">
            <div className="max-h-96 overflow-y-auto space-y-4 pr-2">
              {sortedProgressData.map((item) =>
                item ? (
                  <SimulationProgress
                    key={item.simulation_id || ""}
                    id={item.simulation_id || ""}
                    viewMode={
                      item.view_mode === "member"
                        ? ViewMode.MEMBER
                        : ViewMode.INSTRUCTIONAL
                    }
                    {...(item.cohort_names_junction && { cohortName: item.cohort_names_junction })}
                    simulationName={item.simulation_name || ""}
                    status={
                      (item.status || "not-started") as
                        | "not-started"
                        | "in-progress"
                        | "passed"
                    }
                    completionPct={item.completion_pct || 0}
                    {...(typeof item.passed_count === "number" && {
                      passedCount: item.passed_count,
                    })}
                    {...(typeof item.in_progress_count === "number" && {
                      inProgressCount: item.in_progress_count,
                    })}
                    {...(typeof item.not_started_count === "number" && {
                      notStartedCount: item.not_started_count,
                    })}
                    {...(typeof item.pass_pct === "number" && {
                      passPct: item.pass_pct,
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
                      key={item.simulation_id || ""}
                      id={item.simulation_id || ""}
                      {...(typeof item.time_limit === "number" && {
                        timeLimit: item.time_limit,
                      })}
                      numSessions={
                        typeof item.num_sessions === "number"
                          ? item.num_sessions
                          : 1
                      }
                      {...(typeof item.highest_score === "number" && {
                        highestScore: item.highest_score,
                      })}
                      simulationTitle={item.simulation_name || ""}
                      simulationDescription={item.simulation_description || ""}
                      standard_groups={buildStandardGroupsDict(
                        item.standard_groups || []
                      )}
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
                      {...(typeof item.has_passed === "boolean" && {
                        hasPassed: item.has_passed,
                      })}
                      {...(typeof item.pass_pct === "number" && {
                        passRate: item.pass_pct,
                      })}
                      type="cohort"
                      onStartSimulation={handleStartSimulation}
                      loadingSimulation={loadingSimulation}
                      profile={{
                        ...profile,
                        role: profile.role as
                          | "member"
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
                        index === carouselIndex ? "bg-primary" : "bg-muted"
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function HomeSkeleton() {
  const PROGRESS_ROWS = 5;
  const CARD_COUNT = 3;

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
    </div>
  );
}
