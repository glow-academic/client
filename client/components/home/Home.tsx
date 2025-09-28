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
import { useFilteredAnalyticsData } from "@/hooks/use-filtered-analytics-data";
import { useAnalyticsHomeOverview } from "@/lib/api/hooks/analytics";
import { log } from "@/utils/logger";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import SimulationProgress from "../common/cohort/SimulationProgress";
import SimulationHistory from "../common/history/SimulationHistory";
import SimulationCard from "../common/simulation/SimulationCard";

// Utility function to format cohort names with proper comma handling
const formatCohortNames = (cohorts: Array<{ title: string }>): string => {
  if (cohorts.length === 0) return "";
  if (cohorts.length === 1) return cohorts[0]?.title || "";
  if (cohorts.length === 2)
    return `${cohorts[0]?.title || ""} and ${cohorts[1]?.title || ""}`;

  const firstCohorts = cohorts.slice(0, -2).map((c) => c?.title || "");
  const lastTwo = cohorts.slice(-2).map((c) => c?.title || "");

  return `${firstCohorts.join(", ")}, ${lastTwo[0]}, and ${lastTwo[1]}`;
};

export default function Home() {
  const { effectiveProfile, activeProfile } = useProfile();
  const {
    startDate,
    endDate,
    selectedCohortIds,
    selectedRoles,
    simulationFilters,
  } = useAnalytics();

  // Main filtered data for progress visualization - no profileId for admin/superadmin
  const { data: filteredData } = useFilteredAnalyticsData({
    // Only pass profileId for non-admin users so admins can see all TA progress
    ...(effectiveProfile?.id &&
      effectiveProfile?.role !== "admin" &&
      effectiveProfile?.role !== "superadmin" && {
        profileId: effectiveProfile.id,
      }),
  });

  // Separate filtered data for history section - always include profileId for current user
  const { data: historyFilteredData } = useFilteredAnalyticsData({
    ...(effectiveProfile?.id && { profileId: effectiveProfile.id }),
  });

  // New optimized home overview analytics
  const { data: homeOverview, isLoading: isHomeOverviewLoading } =
    useAnalyticsHomeOverview({
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      cohortIds: selectedCohortIds,
      roles: selectedRoles,
      simulationFilters: simulationFilters?.map((f) => f.toLowerCase()) as (
        | "general"
        | "practice"
        | "archived"
      )[],
      // Pass profileId for TA view, omit for instructor/admin view
      ...(effectiveProfile?.role !== "admin" &&
        effectiveProfile?.role !== "superadmin" &&
        effectiveProfile?.role !== "instructional" &&
        effectiveProfile?.id && { profileId: effectiveProfile.id }),
    });

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

  // Determine if we should show all data (instructor view) or filtered (TA view)
  const shouldShowAll =
    effectiveProfile?.role === "instructional" ||
    effectiveProfile?.role === "admin" ||
    effectiveProfile?.role === "superadmin";

  // Use rubrics from filtered data
  const rubrics = filteredData?.rubrics;

  // --- lookups from filteredData (safe fallbacks) ---
  const simById = useMemo(() => {
    const arr = filteredData?.simulations ?? [];
    return new Map(arr.map((s) => [s.id, s]));
  }, [filteredData?.simulations]);

  const cohortById = useMemo(() => {
    const arr = filteredData?.cohorts ?? [];
    return new Map(arr.map((c) => [c.id, c]));
  }, [filteredData?.cohorts]);

  const rubricById = useMemo(() => {
    const arr = filteredData?.rubrics ?? rubrics ?? [];
    return new Map(arr.map((r) => [r.id, r]));
  }, [filteredData?.rubrics, rubrics]);

  const cohortMembersMap = useMemo(() => {
    const arr = filteredData?.cohorts ?? [];
    return new Map<string, string[]>(
      arr.map((c) => [c.id, c.profileIds ?? []])
    );
  }, [filteredData?.cohorts]);

  // Removed heavy `cohortsForDisplay` computation; filtering is handled by `filteredCohorts` below.

  // Note: available cohorts should be derived from actual cohort availability, not
  // heavy computed data (attempts/chats/grades). Use `filteredCohorts` downstream.

  // Use cohorts from filtered data (already filtered by analytics context)
  const filteredCohorts = useMemo(() => {
    if (!filteredData?.cohorts) return [];
    return filteredData.cohorts;
  }, [filteredData?.cohorts]);

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
          ...(effectiveProfile?.id
            ? { actor: { profileId: effectiveProfile.id } }
            : {}),
          context: {
            component: "Home",
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
            context: { component: "Home", function: "handleStartSimulation" },
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
          context: { component: "Home", function: "handleStartSimulation" },
          error,
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
    ]
  );

  // NEW: build enhancedSimulations directly from server payload (with client lookups)
  const enhancedSimulations = useMemo(() => {
    if (!homeOverview || homeOverview.mode === "empty") return [];

    // helper: format cohort names
    const fmtCohortNames = (cohortIds: string[]) => {
      const cohorts = cohortIds
        .map((id) => cohortById.get(id))
        .filter(Boolean) as Array<{ title: string }>;
      return formatCohortNames(cohorts);
    };

    // TA view → one record per simulation (your schema already gives highestScore + hasPassed)
    if (homeOverview.mode === "ta") {
      return (homeOverview.simulations ?? [])
        .map((row) => {
          const sim = simById.get(row.simulationId);
          if (!sim) return null;

          const rubric = rubricById.get(sim.rubricId);
          const passRate =
            rubric && rubric.points > 0
              ? Math.round((rubric.passPoints / rubric.points) * 100)
              : 0;

          const cohorts = (row.cohortIds ?? [])
            .map((id) => cohortById.get(id))
            .filter(Boolean) as Array<{
            id: string;
            title: string;
            description: string | null;
          }>;

          const cohort = cohorts[0] ?? {
            id: "",
            title: "",
            description: null as string | null,
          };

          return {
            ...sim,
            cohort,
            cohorts,
            cohortNames: fmtCohortNames(row.cohortIds ?? []),
            rubric,
            passRate,
            hasPassed: row.hasPassed,
            highestScore: row.highestScore ?? 0,
            progress: {
              totalMembers: 1,
              passedCount: row.hasPassed ? 1 : 0,
              inProgressCount: row.hasPassed ? 0 : 1,
              notStartedCount: 0,
              passedMembers:
                row.hasPassed && effectiveProfile?.id
                  ? [effectiveProfile.id]
                  : [],
              inProgressMembers:
                !row.hasPassed && effectiveProfile?.id
                  ? [effectiveProfile.id]
                  : [],
            },
            rubricData: {
              attempts: [],
              highestScore: row.highestScore ?? 0,
            },
          };
        })
        .filter(Boolean);
    }

    // Instructor/Admin → aggregate by simulation across cohorts
    if (homeOverview.mode === "instructor") {
      // group rows by simulationId
      const bySim = new Map<
        string,
        {
          simulation: NonNullable<typeof filteredData>["simulations"][0];
          cohorts: { id: string; title: string; description: string | null }[];
          passedMembers: string[];
          inProgressMembers: string[];
          totalMembers: number;
        }
      >();

      for (const row of homeOverview.bySimulationCohort ?? []) {
        const sim = simById.get(row.simulationId);
        if (!sim) continue;

        const cohort = cohortById.get(row.cohortId);
        if (!cohort) continue;

        const bucket = bySim.get(row.simulationId) ?? {
          simulation: sim,
          cohorts: [],
          passedMembers: [],
          inProgressMembers: [],
          totalMembers: 0,
        };

        // accumulate cohort + membership
        if (!bucket.cohorts.find((c) => c.id === cohort.id)) {
          bucket.cohorts.push(cohort);
        }

        const cohortMembers = cohortMembersMap.get(cohort.id) ?? [];
        bucket.totalMembers += cohortMembers.length;

        bucket.passedMembers.push(...row.passedProfileIds);
        bucket.inProgressMembers.push(...row.inProgressProfileIds);

        bySim.set(row.simulationId, bucket);
      }

      // build final records per simulation
      const results = Array.from(bySim.values()).map((bucket) => {
        const sim = bucket.simulation;
        const rubric = rubricById.get(sim.rubricId);
        const passRate =
          rubric && rubric.points > 0
            ? Math.round((rubric.passPoints / rubric.points) * 100)
            : 0;

        const passedSet = new Set(bucket.passedMembers);
        const inProgSet = new Set(bucket.inProgressMembers);

        const passedCount = passedSet.size;
        const inProgressCount = inProgSet.size;
        const notStartedCount = Math.max(
          0,
          bucket.totalMembers - passedCount - inProgressCount
        );

        const cohort = bucket.cohorts[0] ?? {
          id: "",
          title: "",
          description: null as string | null,
        };

        // hasPassed for instructor cards = everyone in the cohorts passed
        const hasPassed =
          bucket.totalMembers > 0 && passedCount >= bucket.totalMembers;

        return {
          ...sim,
          cohort,
          cohorts: bucket.cohorts,
          cohortNames: formatCohortNames(bucket.cohorts),
          rubric,
          passRate,
          hasPassed,
          highestScore: 0, // not defined for instructor rollup
          progress: {
            totalMembers: bucket.totalMembers,
            passedCount,
            inProgressCount,
            notStartedCount,
            passedMembers: Array.from(passedSet),
            inProgressMembers: Array.from(inProgSet),
          },
          rubricData: {
            attempts: [],
            highestScore: 0,
          },
        };
      });

      return results;
    }

    return [];
  }, [
    homeOverview,
    simById,
    cohortById,
    rubricById,
    cohortMembersMap,
    effectiveProfile?.id,
  ]);

  // Sort simulations by completion status and then by cohort
  const sortedSimulations = useMemo(() => {
    return enhancedSimulations.sort((a, b) => {
      if (!a || !b) return 0;
      // First sort by completion status (non-completed first)
      if (a.hasPassed !== b.hasPassed) {
        return a.hasPassed ? 1 : -1;
      }

      // Then sort by cohort title
      return a.cohort.title.localeCompare(b.cohort.title);
    });
  }, [enhancedSimulations]);

  // Sort progress data the same way as the cards (non-completed first, then by cohort)
  const sortedProgressData = useMemo(() => {
    if (!enhancedSimulations) return [];

    // Use the deduplicated simulations for progress data
    return enhancedSimulations.sort((a, b) => {
      if (!a || !b) return 0;
      // First sort by completion status (non-completed first)
      const aCompleted = a.progress.passedCount >= a.progress.totalMembers;
      const bCompleted = b.progress.passedCount >= b.progress.totalMembers;

      if (aCompleted !== bCompleted) {
        return aCompleted ? 1 : -1;
      }

      // Then sort by first cohort title
      return a.cohort.title.localeCompare(b.cohort.title);
    });
  }, [enhancedSimulations]);

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
  if (isHomeOverviewLoading) {
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

  if (!filteredCohorts.length) {
    return (
      <div className="container mx-auto p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">No Cohorts Available</h1>
          <p className="text-gray-600">
            There are no cohorts assigned to you. Please contact an
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
          {sortedProgressData.map((sim) =>
            sim ? (
              <SimulationProgress
                key={sim.id}
                simulation={sim}
                isTAView={!shouldShowAll}
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
            {visibleSimulations.map((sim) =>
              sim ? (
                <SimulationCard
                  key={sim.id}
                  simulation={sim}
                  type="cohort"
                  onStartSimulation={handleStartSimulation}
                  loadingSimulation={loadingSimulation}
                  effectiveProfile={effectiveProfile}
                  scenarios={[]} // Not needed for cohort simulations
                  personas={[]} // Not needed for cohort simulations
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
          filteredData={historyFilteredData}
          showExport={true}
          showArchive={false}
          singleProfile={true}
        />
      </div>
    </div>
  );
}
