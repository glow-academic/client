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

import { useProfile } from "@/contexts/profile-context";
import { useWebSocket } from "@/contexts/websocket-context";
import { useFilteredAnalyticsData } from "@/hooks/use-filtered-analytics-data";
import { log } from "@/utils/logger";

import { calculateUserPerformanceBySimulation } from "@/utils/analytics/header";
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

  const { data: filteredData } =
    useFilteredAnalyticsData({
      ...(effectiveProfile?.id && { profileId: effectiveProfile.id }),
    });
  const { isConnected, emitStartSimulation, isStartingSimulation } =
    useWebSocket();

  const [carouselIndex, setCarouselIndex] = useState(0);
  // Use WebSocket's loading state instead of local state to prevent flash
  const loadingSimulation = isStartingSimulation ? "loading" : null;
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

  // Removed heavy `cohortsForDisplay` computation; filtering is handled by `filteredCohorts` below.

  // Note: available cohorts should be derived from actual cohort availability, not
  // heavy computed data (attempts/chats/grades). Use `filteredCohorts` downstream.

  // Use cohorts from filtered data (already filtered by analytics context)
  const filteredCohorts = useMemo(() => {
    if (!filteredData?.cohorts) return [];
    return filteredData.cohorts;
  }, [filteredData?.cohorts]);

  // Use profiles from filtered data (already filtered by analytics context)
  const cohortProfiles = useMemo(() => {
    if (!filteredData?.profiles) return [];
    return filteredData.profiles;
  }, [filteredData?.profiles]);

  // Use data from filtered data (already filtered by analytics context)
  const attempts = useMemo(() => {
    if (!filteredData?.attempts) return [];
    return filteredData.attempts;
  }, [filteredData?.attempts]);

  const chats = useMemo(() => {
    if (!filteredData?.chats) return [];
    return filteredData.chats;
  }, [filteredData?.chats]);

  const grades = useMemo(() => {
    if (!filteredData?.grades) return [];
    return filteredData.grades;
  }, [filteredData?.grades]);

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

        const toastId = toast.loading("Starting simulation...");
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

  // Note: attempts and grades can be empty/undefined when no simulations have been started yet
  const safeAttempts = useMemo(() => attempts || [], [attempts]);
  const safeGrades = useMemo(() => grades || [], [grades]);

  // Data processing logic
  const processedCohortData = useMemo(() => {
    // Debug logging to help identify missing data
    if (!filteredCohorts) {
      return [];
    }
    if (!filteredData?.simulations) {
      return [];
    }
    if (!cohortProfiles) {
      return [];
    }

    return filteredCohorts.map((cohort) => {
      // Get simulations for this specific cohort (and exclude default/practice ones)
      const cohortSimulations = filteredData.simulations.filter((sim) =>
        cohort.simulationIds?.includes(sim.id)
      );

      // Get the profiles of members in this cohort
      const cohortMembers = cohortProfiles.filter((p) =>
        cohort.profileIds?.includes(p.id)
      );

      // For each simulation, calculate progress based on user role
      const simulationsWithProgress = cohortSimulations.map((simulation) => {
        if (shouldShowAll) {
          // Instructor/Admin view: Show progress for all cohort members
          const cohortAttempts = safeAttempts.filter(
            (att) =>
              att.profileId &&
              cohort.profileIds?.includes(att.profileId) &&
              att.simulationId === simulation.id
          );

          const cohortAttemptIds = cohortAttempts.map((att) => att.id);
          const cohortChats = chats?.filter((c) =>
            cohortAttemptIds.includes(c.attemptId)
          );

          // Filter grades by date range if dates are provided
          const cohortGrades = safeGrades.filter((g) =>
            cohortChats?.some((c) => c.id === g.simulationChatId)
          );

          // Calculate progress based on each user's best attempt for this simulation
          // This prevents counting multiple attempts per user which was causing >100% progress
          const userBestAttempts = new Map<
            string,
            { passed: boolean; score: number; attemptId: string }
          >();

          // Group grades by attempt and calculate average scores
          const attemptScores = new Map<
            string,
            { scores: number[]; profileId: string }
          >();

          cohortGrades.forEach((grade) => {
            const chat = cohortChats?.find(
              (c) => c.id === grade.simulationChatId
            );
            const attempt = cohortAttempts.find(
              (a) => a.id === chat?.attemptId
            );

            if (attempt?.id && attempt?.profileId) {
              const existing = attemptScores.get(attempt.id);
              if (existing) {
                existing.scores.push(grade.score);
              } else {
                attemptScores.set(attempt.id, {
                  scores: [grade.score],
                  profileId: attempt.profileId,
                });
              }
            }
          });

          // Calculate average score for each attempt and find best attempt per user
          attemptScores.forEach((attemptData, attemptId) => {
            const averageScore =
              attemptData.scores.reduce((sum, score) => sum + score, 0) /
              attemptData.scores.length;

            // Get rubric to determine pass threshold
            const rubric = rubrics?.find((r) => r.id === simulation.rubricId);
            const passThreshold = rubric?.passPoints || 70; // Default to 70% if no rubric
            const passed = averageScore >= passThreshold;

            const existing = userBestAttempts.get(attemptData.profileId);
            if (!existing || averageScore > existing.score) {
              userBestAttempts.set(attemptData.profileId, {
                passed,
                score: averageScore,
                attemptId,
              });
            }
          });

          // Count users based on their best attempts
          const passedCount = Array.from(userBestAttempts.values()).filter(
            (attempt) => attempt.passed
          ).length;
          const inProgressCount = Array.from(userBestAttempts.values()).filter(
            (attempt) => !attempt.passed
          ).length;
          const notStartedCount =
            cohortMembers.length - passedCount - inProgressCount;

          return {
            ...simulation,
            progress: {
              totalMembers: cohortMembers.length,
              passedCount,
              inProgressCount,
              notStartedCount: Math.max(0, notStartedCount),
              passedMembers:
                Array.from(userBestAttempts.entries())
                  .filter(([_, attempt]) => attempt.passed)
                  .map(([profileId, _]) => profileId) || [],
              inProgressMembers:
                Array.from(userBestAttempts.entries())
                  .filter(([_, attempt]) => !attempt.passed)
                  .map(([profileId, _]) => profileId) || [],
            },
          };
        } else {
          // TA view: Show individual progress
          if (!effectiveProfile?.id) {
            // No profile ID available, show empty progress
            return {
              ...simulation,
              progress: {
                totalMembers: 1,
                passedCount: 0,
                inProgressCount: 0,
                notStartedCount: 1,
                passedMembers: [],
                inProgressMembers: [],
              },
            };
          }

          // Find TA's attempts for this simulation
          const taAttempts = safeAttempts.filter(
            (att) =>
              att.profileId === effectiveProfile.id! &&
              att.simulationId === simulation.id
          );

          const taProgress = {
            totalAttempts: taAttempts.length,
            passedCount: 0,
            inProgressCount: 0,
            notStartedCount: taAttempts.length === 0 ? 1 : 0,
            passedMembers: [] as string[],
            inProgressMembers: [] as string[],
          };

          if (taAttempts.length > 0) {
            const taAttemptIds = taAttempts.map((att) => att.id);

            // Find chats and grades related to these attempts
            const taChats = chats?.filter((c) =>
              taAttemptIds.includes(c.attemptId)
            );
            const taGrades = safeGrades.filter((g) =>
              taChats?.some((c) => c.id === g.simulationChatId)
            );

            // Calculate average score for each attempt and find best attempt
            const taAttemptScores = new Map<string, { scores: number[] }>();

            taGrades.forEach((grade) => {
              const chat = taChats?.find(
                (c) => c.id === grade.simulationChatId
              );
              const attempt = taAttempts.find((a) => a.id === chat?.attemptId);

              if (attempt?.id) {
                const existing = taAttemptScores.get(attempt.id);
                if (existing) {
                  existing.scores.push(grade.score);
                } else {
                  taAttemptScores.set(attempt.id, { scores: [grade.score] });
                }
              }
            });

            // Find best attempt based on average score
            let bestAverageScore = 0;
            let hasPassed = false;

            taAttemptScores.forEach((attemptData) => {
              const averageScore =
                attemptData.scores.reduce((sum, score) => sum + score, 0) /
                attemptData.scores.length;

              if (averageScore > bestAverageScore) {
                bestAverageScore = averageScore;

                // Get rubric to determine pass threshold
                const rubric = rubrics?.find(
                  (r) => r.id === simulation.rubricId
                );
                const passThreshold = rubric?.passPoints || 70; // Default to 70% if no rubric
                hasPassed = averageScore >= passThreshold;
              }
            });

            if (hasPassed) {
              taProgress.passedCount = 1;
              taProgress.passedMembers = [effectiveProfile.id!];
            } else {
              taProgress.inProgressCount = 1;
              taProgress.inProgressMembers = [effectiveProfile.id!];
            }
          }

          return {
            ...simulation,
            progress: {
              totalMembers: 1, // Individual TA view
              passedCount: taProgress.passedCount,
              inProgressCount: taProgress.inProgressCount,
              notStartedCount: taProgress.notStartedCount,
              passedMembers: taProgress.passedMembers,
              inProgressMembers: taProgress.inProgressMembers,
            },
          };
        }
      });

      return {
        cohort,
        cohortMembers,
        simulations: simulationsWithProgress,
      };
    });
  }, [
    filteredCohorts,
    filteredData?.simulations,
    cohortProfiles,
    safeAttempts,
    chats,
    safeGrades,
    effectiveProfile,
    shouldShowAll,
    rubrics,
  ]);

  // Enhanced simulation data with completion status and rubric data (deduplicated)
  const enhancedSimulations = useMemo(() => {
    if (!processedCohortData || !rubrics) return [];

    const perfBySim = effectiveProfile?.id
      ? calculateUserPerformanceBySimulation(
          filteredData!,
          rubrics,
          effectiveProfile.id
        )
      : {};

    // Create a map to deduplicate simulations by ID
    const simulationMap = new Map<
      string,
      {
        simulation: (typeof processedCohortData)[0]["simulations"][0];
        cohorts: Array<{ title: string }>;
        progress: (typeof processedCohortData)[0]["simulations"][0]["progress"];
      }
    >();

    // Process all simulations and group by simulation ID
    processedCohortData.forEach((data) => {
      data.simulations.forEach((simulation) => {
        const existing = simulationMap.get(simulation.id);

        if (existing) {
          // Add this cohort to the existing simulation
          existing.cohorts.push(data.cohort);
          // Merge progress data (for instructor view, sum the progress)
          if (shouldShowAll) {
            existing.progress.totalMembers += simulation.progress.totalMembers;
            existing.progress.passedCount += simulation.progress.passedCount;
            existing.progress.inProgressCount +=
              simulation.progress.inProgressCount;
            existing.progress.notStartedCount +=
              simulation.progress.notStartedCount;
            existing.progress.passedMembers.push(
              ...simulation.progress.passedMembers
            );
            existing.progress.inProgressMembers.push(
              ...simulation.progress.inProgressMembers
            );
          }
        } else {
          // First occurrence of this simulation
          simulationMap.set(simulation.id, {
            simulation,
            cohorts: [data.cohort],
            progress: { ...simulation.progress },
          });
        }
      });
    });

    // Convert map back to array and enhance with rubric data
    return Array.from(simulationMap.values()).map(
      ({ simulation, cohorts, progress }) => {
        const rubric = rubrics.find((r) => r.id === simulation.rubricId);
        const passRate =
          rubric && rubric.points > 0
            ? Math.round((rubric.passPoints / rubric.points) * 100)
            : 0;

        // Default to user's performance
        const perf = perfBySim[simulation.id];
        let hasPassed = perf?.passed ?? false;
        const highestScore = perf?.highestScorePercent ?? 0;

        // For instructor view, check if ALL members have passed
        if (shouldShowAll) {
          const passedMembers = progress.passedMembers;
          const totalMembers = progress.totalMembers;
          hasPassed =
            passedMembers.length > 0 && passedMembers.length >= totalMembers;
        }

        return {
          ...simulation,
          cohort: cohorts[0] || { title: "", id: "", description: null }, // Keep first cohort for backward compatibility
          cohorts, // Add all cohorts
          cohortNames: formatCohortNames(cohorts), // Add formatted cohort names
          progress,
          rubric,
          passRate,
          hasPassed,
          highestScore,
          rubricData: {
            attempts: [],
            highestScore,
          },
        } as typeof simulation & {
          cohort: { id: string; title: string; description: string | null };
          cohorts: Array<{ title: string }>;
          cohortNames: string;
          progress: typeof progress;
          rubric?: typeof rubric;
          passRate?: number;
          hasPassed?: boolean;
          highestScore?: number;
          rubricData: { attempts: never[]; highestScore: number };
        };
      }
    );
  }, [
    processedCohortData,
    rubrics,
    shouldShowAll,
    effectiveProfile?.id,
    filteredData,
  ]);

  // Sort simulations by completion status and then by cohort
  const sortedSimulations = useMemo(() => {
    return enhancedSimulations.sort((a, b) => {
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
          {sortedProgressData.map((sim) => (
            <SimulationProgress key={sim.id} simulation={sim} />
          ))}
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
            {visibleSimulations.map((sim) => (
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
            ))}
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
          filteredData={filteredData}
          showExport={false}
          showArchive={false}
        />
      </div>
    </div>
  );
}
