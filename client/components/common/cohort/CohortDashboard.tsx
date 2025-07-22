/**
 * CohortDashboard.tsx
 * This is the cohort dashboard component for the home page
 * @AshokSaravanan222 & @siladiea
 * 07/20/2025
 */

"use client";

import { useProfile } from "@/contexts/profile-context";
import { useWebSocket } from "@/contexts/websocket-context";
import { logError, logInfo } from "@/utils/logger";
import { getAllProfiles } from "@/utils/queries/profiles/get-all-profiles";
import { getSimulationAttemptsByProfiles } from "@/utils/queries/simulation_attempts/get-simulation-attempts-by-profiles";
import { getSimulationChatGradesBySimulationChats } from "@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-simulationchats";
import { getSimulationChatsByAttempts } from "@/utils/queries/simulation_chats/get-simulation-chats-by-attempts";
import { getAllSimulations } from "@/utils/queries/simulations/get-all-simulations";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import SimulationHistory from "../history/SimulationHistory";
import SimulationCard from "../simulation/SimulationCard";
import SimulationProgress from "./SimulationProgress";

export interface CohortDashboardProps {
  cohortIds: string[];
}

export default function CohortDashboard({ cohortIds }: CohortDashboardProps) {
  const { effectiveProfile, activeProfile } = useProfile();
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [loadingSimulation, setLoadingSimulation] = useState<string | null>(
    null
  );
  const [loadingToastId, setLoadingToastId] = useState<string | number | null>(
    null
  );
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const router = useRouter();

  // 1. Fetch the specific cohorts
  const { data: cohorts, isLoading: loadingCohorts } = useQuery({
    queryKey: ["cohorts", cohortIds],
    queryFn: async () => {
      // Fetch all cohorts and filter by the provided IDs
      const { getAllCohorts } = await import(
        "@/utils/queries/cohorts/get-all-cohorts"
      );
      const allCohorts = await getAllCohorts();
      return allCohorts.filter((cohort) => cohortIds.includes(cohort.id));
    },
    enabled: cohortIds.length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  // 2. Fetch all simulations, to be filtered by cohorts
  const { data: allSimulations, isLoading: loadingSimulations } = useQuery({
    queryKey: ["simulations"],
    queryFn: getAllSimulations,
  });

  // 3. Get all profile IDs from the cohorts to fetch member data
  const cohortMemberIds = useMemo(() => {
    if (!cohorts) return [];
    const ids = new Set<string>();
    cohorts.forEach((cohort) => {
      cohort.profileIds?.forEach((id) => ids.add(id));
    });
    return Array.from(ids).sort(); // Sort to ensure stable array reference
  }, [cohorts]);

  // 4. Fetch all profiles for the members
  const { data: allProfiles, isLoading: loadingProfiles } = useQuery({
    queryKey: ["profiles", "cohortMembers", cohortMemberIds],
    queryFn: () => getAllProfiles(), // We fetch all and filter client-side for simplicity
    enabled: cohortMemberIds.length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  // Filter profiles to only include those in the cohort's profileIds
  const cohortProfiles = useMemo(() => {
    if (!allProfiles || !cohorts) return [];

    // Get all profile IDs from all selected cohorts
    const allCohortProfileIds = new Set<string>();
    cohorts.forEach((cohort) => {
      cohort.profileIds?.forEach((id) => allCohortProfileIds.add(id));
    });

    // Filter profiles to only include those in the cohort
    const filteredProfiles = allProfiles.filter((profile) =>
      allCohortProfileIds.has(profile.id)
    );

    return filteredProfiles;
  }, [allProfiles, cohorts]);

  // 5. Fetch all attempts for these members
  const { data: attempts, isLoading: loadingAttempts } = useQuery({
    queryKey: ["simulationAttempts", cohortMemberIds],
    queryFn: () => getSimulationAttemptsByProfiles(cohortMemberIds),
    enabled: cohortMemberIds.length > 0,
  });

  // 6. Fetch chats for those attempts
  const { data: chats, isLoading: loadingChats } = useQuery({
    queryKey: ["simulationChats", attempts?.map((a) => a.id)?.sort() || []],
    queryFn: () => getSimulationChatsByAttempts(attempts!.map((a) => a.id)),
    enabled: !!attempts && attempts.length > 0,
  });

  // 7. Fetch grades for those chats - this contains the critical 'passed' status
  const { data: grades, isLoading: loadingGrades } = useQuery({
    queryKey: ["simulationGrades", chats?.map((c) => c.id)?.sort() || []],
    queryFn: () =>
      getSimulationChatGradesBySimulationChats(chats!.map((c) => c.id)),
    enabled: !!chats && chats.length > 0,
  });

  const { isConnected, emitStartSimulation } = useWebSocket();

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
      router.push(`/home/a/${attemptId}`);
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
      activeProfile,
      isConnected,
      emitStartSimulation,
      loadingToastId,
    ]
  );

  // Determine if we should show all data (instructor view) or filtered (TA view)
  const shouldShowAll =
    effectiveProfile?.role === "instructional" ||
    effectiveProfile?.role === "admin" ||
    effectiveProfile?.role === "superadmin";

  // Note: attempts and grades can be empty/undefined when no simulations have been started yet
  const safeAttempts = useMemo(() => attempts || [], [attempts]);
  const safeGrades = useMemo(() => grades || [], [grades]);

  // Data processing logic
  const processedCohortData = useMemo(() => {
    // Debug logging to help identify missing data
    if (!cohorts) {
      logError("CohortDashboard: No cohorts data available");
      return [];
    }
    if (!allSimulations) {
      logError("CohortDashboard: No simulations data available");
      return [];
    }
    if (!cohortProfiles) {
      logError("CohortDashboard: No cohort profiles data available");
      return [];
    }

    return cohorts.map((cohort) => {
      // Get simulations for this specific cohort (and exclude default/practice ones)
      const cohortSimulations = allSimulations.filter((sim) =>
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
          const cohortGrades = safeGrades.filter((g) =>
            cohortChats?.some((c) => c.id === g.simulationChatId)
          );

          const passedCount = cohortGrades.filter((g) => g.passed).length || 0;
          const inProgressCount =
            cohortGrades.filter((g) => !g.passed).length || 0;
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
                cohortGrades
                  ?.filter((g) => g.passed)
                  .map((g) => {
                    const chat = cohortChats?.find(
                      (c) => c.id === g.simulationChatId
                    );
                    const attempt = cohortAttempts.find(
                      (a) => a.id === chat?.attemptId
                    );
                    return attempt?.profileId || "";
                  })
                  .filter(Boolean) || [],
              inProgressMembers:
                cohortGrades
                  ?.filter((g) => !g.passed)
                  .map((g) => {
                    const chat = cohortChats?.find(
                      (c) => c.id === g.simulationChatId
                    );
                    const attempt = cohortAttempts.find(
                      (a) => a.id === chat?.attemptId
                    );
                    return attempt?.profileId || "";
                  })
                  .filter(Boolean) || [],
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

            const hasPassed = taGrades.some((g) => g.passed);

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
    cohorts,
    allSimulations,
    cohortProfiles,
    safeAttempts,
    chats,
    safeGrades,
    effectiveProfile,
    shouldShowAll,
  ]);

  // Flatten all simulations for carousel
  const allSimulationsForCarousel = useMemo(() => {
    return processedCohortData.flatMap((data) => data.simulations);
  }, [processedCohortData]);

  // Carousel logic
  const maxVisible = 3;
  const totalPages = Math.ceil(allSimulationsForCarousel.length / maxVisible);
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
  const visibleSimulations = allSimulationsForCarousel.slice(
    startIndex,
    endIndex
  );

  // Loading state
  const isLoading =
    loadingCohorts ||
    loadingSimulations ||
    loadingProfiles ||
    loadingAttempts ||
    loadingChats ||
    loadingGrades;

  if (isLoading) {
    return (
      <div className="container mx-auto p-4">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg">Loading cohort dashboard...</div>
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

  if (!processedCohortData.length) {
    return (
      <div className="container mx-auto p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">No Simulations Available</h1>
          <p className="text-gray-600 mb-4">
            {!cohorts || cohorts.length === 0
              ? "No cohorts found for the selected IDs."
              : !allSimulations || allSimulations.length === 0
                ? "No simulations available."
                : !cohortProfiles || cohortProfiles.length === 0
                  ? "No profile data available."
                  : "The selected cohorts have no simulations assigned to them."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 space-y-8">
      {/* Accolades Section */}
      {/* <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <AccoladeCard
          icon={<Award className="h-4 w-4" />}
          title="Perfect Score"
          user={accolades.perfectScore?.holder}
          details={accolades.perfectScore?.details || ""}
        />
        <AccoladeCard
          icon={<MessageSquareText className="h-4 w-4" />}
          title="Longest Convo"
          user={accolades.longestConvo?.holder}
          details={accolades.longestConvo?.details || ""}
        />
        <AccoladeCard
          icon={<Zap className="h-4 w-4" />}
          title="Most Improved"
          user={accolades.mostImproved?.holder}
          details={accolades.mostImproved?.details || ""}
        />
        <AccoladeCard
          icon={<Crown className="h-4 w-4" />}
          title="Quickest Pass"
          user={accolades.quickestPass?.holder}
          details={accolades.quickestPass?.details || ""}
        />
      </div> */}

      {/* Progress Visualization Section - All progress bars grouped together */}
      <div className="space-y-6">
        <h2 className="text-2xl font-bold mb-4">
          {shouldShowAll ? "Cohort Progress" : "Your Progress"}
        </h2>
        <div className="max-h-96 overflow-y-auto space-y-4 pr-2">
          {processedCohortData.map((data) => (
            <div key={data.cohort.id} className="space-y-4">
              {data.simulations.map((sim) => (
                <SimulationProgress key={sim.id} simulation={sim} />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Assignments List Section - All simulation cards in carousel */}
      {allSimulationsForCarousel.length > 0 && (
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
                rubricData={{ attempts: [], highestScore: 0 }} // Placeholder - implement as needed
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

      {/* History Section */}
      <div className="mt-12">
        <SimulationHistory
          showAll={shouldShowAll}
          cohortIds={cohortIds}
          showExport={shouldShowAll}
        />
      </div>
    </div>
  );
}
