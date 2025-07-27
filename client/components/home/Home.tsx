/**
 * Home.tsx
 * This is the cohort dashboard component for the home page
 * @AshokSaravanan222 & @siladiea
 * 07/20/2025
 */
"use client";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useProfile } from "@/contexts/profile-context";
import { useWebSocket } from "@/contexts/websocket-context";
import { logError, logInfo } from "@/utils/logger";
import { getAllCohorts } from "@/utils/queries/cohorts/get-all-cohorts";
import { getAllProfiles } from "@/utils/queries/profiles/get-all-profiles";
import { getAllRubrics } from "@/utils/queries/rubrics/get-all-rubrics";
import { getSimulationAttemptsByProfiles } from "@/utils/queries/simulation_attempts/get-simulation-attempts-by-profiles";
import { getSimulationChatGradesBySimulationChats } from "@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-simulationchats";
import { getSimulationChatsByAttempts } from "@/utils/queries/simulation_chats/get-simulation-chats-by-attempts";
import { getAllSimulations } from "@/utils/queries/simulations/get-all-simulations";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Cohort, CohortPicker } from "../common/cohort/CohortPicker";
import SimulationProgress from "../common/cohort/SimulationProgress";
import SimulationHistory from "../common/history/SimulationHistory";
import SimulationCard from "../common/simulation/SimulationCard";

export default function Home() {
  const { effectiveProfile, activeProfile } = useProfile();
  const [selectedCohorts, setSelectedCohorts] = useState<Cohort[]>([]);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [loadingSimulation, setLoadingSimulation] = useState<string | null>(
    null
  );
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

  // Check if user is a TA
  const isTA = effectiveProfile?.role === "ta";

  // 1. Fetch all cohorts
  const { data: allCohorts, isLoading: loadingCohorts } = useQuery({
    queryKey: ["cohorts"],
    queryFn: getAllCohorts,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  // 2. Fetch all simulations
  const { data: allSimulations, isLoading: loadingSimulations } = useQuery({
    queryKey: ["simulations"],
    queryFn: getAllSimulations,
  });

  // 3. Fetch all profiles
  const { data: allProfiles, isLoading: loadingProfiles } = useQuery({
    queryKey: ["profiles"],
    queryFn: getAllProfiles,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  // 4. Fetch all rubrics
  const { data: allRubrics, isLoading: loadingRubrics } = useQuery({
    queryKey: ["rubrics"],
    queryFn: getAllRubrics,
  });

  // 5. Fetch all attempts
  const { data: allAttempts, isLoading: loadingAttempts } = useQuery({
    queryKey: ["simulationAttempts"],
    queryFn: () => {
      if (!allProfiles) return [];
      return getSimulationAttemptsByProfiles(allProfiles.map((p) => p.id));
    },
    enabled: !!allProfiles && allProfiles.length > 0,
  });

  // 6. Fetch all chats
  const { data: allChats, isLoading: loadingChats } = useQuery({
    queryKey: ["simulationChats", allAttempts?.map((a) => a.id)?.sort() || []],
    queryFn: () => getSimulationChatsByAttempts(allAttempts!.map((a) => a.id)),
    enabled: !!allAttempts && allAttempts.length > 0,
  });

  // 7. Fetch all grades
  const { data: allGrades, isLoading: loadingGrades } = useQuery({
    queryKey: ["simulationGrades", allChats?.map((c) => c.id)?.sort() || []],
    queryFn: () =>
      getSimulationChatGradesBySimulationChats(allChats!.map((c) => c.id)),
    enabled: !!allChats && allChats.length > 0,
  });

  // Transform cohorts for the picker with completion status
  const cohortsForPicker = useMemo(() => {
    if (
      !allCohorts ||
      !allSimulations ||
      !allProfiles ||
      !allAttempts ||
      !allChats ||
      !allGrades
    ) {
      return [];
    }

    // Filter to only active cohorts
    const activeCohorts = allCohorts.filter((cohort) => cohort.active);

    return activeCohorts.map((cohort) => {
      // Get simulations for this cohort
      const cohortSimulations = allSimulations.filter((sim) =>
        cohort.simulationIds?.includes(sim.id)
      );

      // Get the profiles of members in this cohort
      const cohortMembers = allProfiles.filter((p) =>
        cohort.profileIds?.includes(p.id)
      );

      // Calculate completion status
      let isCompleted = false;

      if (shouldShowAll) {
        // Instructor view: Check if all members have completed all simulations
        const cohortAttempts = allAttempts.filter(
          (att) =>
            att.profileId &&
            cohort.profileIds?.includes(att.profileId) &&
            cohortSimulations.some((sim) => sim.id === att.simulationId)
        );

        const cohortAttemptIds = cohortAttempts.map((att) => att.id);
        const cohortChats = allChats?.filter((c) =>
          cohortAttemptIds.includes(c.attemptId)
        );
        const cohortGrades = allGrades.filter((g) =>
          cohortChats?.some((c) => c.id === g.simulationChatId)
        );

        const passedCount = cohortGrades.filter((g) => g.passed).length || 0;
        const totalExpectedAttempts =
          cohortMembers.length * cohortSimulations.length;

        isCompleted = passedCount >= totalExpectedAttempts;
      } else {
        // TA view: Check if current TA has completed all simulations
        if (!effectiveProfile?.id) {
          isCompleted = false;
        } else {
          const taAttempts = allAttempts.filter(
            (att) =>
              att.profileId === effectiveProfile.id! &&
              cohortSimulations.some((sim) => sim.id === att.simulationId)
          );

          const taAttemptIds = taAttempts.map((att) => att.id);
          const taChats = allChats?.filter((c) =>
            taAttemptIds.includes(c.attemptId)
          );
          const taGrades = allGrades.filter((g) =>
            taChats?.some((c) => c.id === g.simulationChatId)
          );

          const passedCount = taGrades.filter((g) => g.passed).length || 0;
          isCompleted = passedCount >= cohortSimulations.length;
        }
      }

      return {
        id: cohort.id,
        title: cohort.title,
        description: `Cohort with ${cohort.profileIds?.length || 0} members`,
        memberCount: cohort.profileIds?.length || 0,
        isCompleted,
      };
    });
  }, [
    allCohorts,
    allSimulations,
    allProfiles,
    allAttempts,
    allChats,
    allGrades,
    shouldShowAll,
    effectiveProfile?.id,
  ]);

  // Get available cohorts based on user role
  const availableCohorts = useMemo(() => {
    if (!cohortsForPicker) return [];

    if (shouldShowAll || effectiveProfile?.defaultProfile) {
      // Instructors see all active cohorts
      return cohortsForPicker;
    } else if (isTA && effectiveProfile?.id) {
      // TAs see only their assigned active cohorts
      return cohortsForPicker.filter((cohort) => {
        const originalCohort = allCohorts?.find((c) => c.id === cohort.id);
        return originalCohort?.profileIds?.includes(effectiveProfile.id);
      });
    }

    return [];
  }, [
    cohortsForPicker,
    shouldShowAll,
    isTA,
    effectiveProfile?.id,
    allCohorts,
    effectiveProfile?.defaultProfile,
  ]);

  // Get selected cohort IDs
  const selectedCohortIds = useMemo(() => {
    return selectedCohorts.map((cohort) => cohort.id);
  }, [selectedCohorts]);

  // Filter cohorts to only selected ones, or show all available cohorts if none selected
  // This ensures users always see data by default, similar to analytics filters
  const cohorts = useMemo(() => {
    if (!allCohorts) return [];

    // If no cohorts are selected, show all available cohorts for the user
    if (selectedCohortIds.length === 0) {
      return allCohorts.filter((cohort) => {
        // For instructors/admins, show all active cohorts
        if (shouldShowAll || effectiveProfile?.defaultProfile) {
          return cohort.active;
        }
        // For TAs, show only their assigned active cohorts
        if (isTA && effectiveProfile?.id) {
          return (
            cohort.active && cohort.profileIds?.includes(effectiveProfile.id)
          );
        }
        return false;
      });
    }

    // Otherwise, filter to only selected cohorts
    return allCohorts.filter((cohort) => selectedCohortIds.includes(cohort.id));
  }, [
    allCohorts,
    selectedCohortIds,
    shouldShowAll,
    effectiveProfile?.defaultProfile,
    isTA,
    effectiveProfile?.id,
  ]);

  // Note: cohortMemberIds is no longer needed since we fetch all data upfront

  // Filter profiles to only include those in the selected cohorts
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

  // Filter attempts to only include those from selected cohorts
  const attempts = useMemo(() => {
    if (!allAttempts || !cohorts) return [];

    const cohortProfileIds = new Set<string>();
    cohorts.forEach((cohort) => {
      cohort.profileIds?.forEach((id) => cohortProfileIds.add(id));
    });

    return allAttempts.filter(
      (attempt) => attempt.profileId && cohortProfileIds.has(attempt.profileId)
    );
  }, [allAttempts, cohorts]);

  // Filter chats to only include those from selected cohort attempts
  const chats = useMemo(() => {
    if (!allChats || !attempts) return [];

    const attemptIds = new Set(attempts.map((a) => a.id));
    return allChats.filter((chat) => attemptIds.has(chat.attemptId));
  }, [allChats, attempts]);

  // Filter grades to only include those from selected cohort chats
  const grades = useMemo(() => {
    if (!allGrades || !chats) return [];

    const chatIds = new Set(chats.map((c) => c.id));
    return allGrades.filter((grade) => chatIds.has(grade.simulationChatId));
  }, [allGrades, chats]);

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

  // Note: attempts and grades can be empty/undefined when no simulations have been started yet
  const safeAttempts = useMemo(() => attempts || [], [attempts]);
  const safeGrades = useMemo(() => grades || [], [grades]);

  // Data processing logic
  const processedCohortData = useMemo(() => {
    // Debug logging to help identify missing data
    if (!cohorts) {
      return [];
    }
    if (!allSimulations) {
      return [];
    }
    if (!cohortProfiles) {
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

  // Enhanced simulation data with completion status and rubric data
  const enhancedSimulations = useMemo(() => {
    if (!processedCohortData || !allRubrics) return [];

    return processedCohortData.flatMap((data) => {
      return data.simulations.map((simulation) => {
        // Get rubric for this simulation
        const rubric = allRubrics.find((r) => r.id === simulation.rubricId);

        // Calculate pass rate
        const passRate =
          rubric && rubric.points > 0
            ? Math.round((rubric.passPoints / rubric.points) * 100)
            : 0;

        // Check if user has passed this simulation
        let hasPassed = false;
        let highestScore = 0;

        if (shouldShowAll) {
          // Instructor view: Check if ALL members have passed (not just any)
          const passedMembers = simulation.progress.passedMembers;
          const totalMembers = simulation.progress.totalMembers;
          hasPassed =
            passedMembers.length > 0 && passedMembers.length >= totalMembers;
          // For instructor view, we don't track individual scores, so use a placeholder
          highestScore = hasPassed ? 100 : 0;
        } else {
          // TA view: Check if current TA has passed
          if (effectiveProfile?.id) {
            const taAttempts = safeAttempts.filter(
              (att) =>
                att.profileId === effectiveProfile.id! &&
                att.simulationId === simulation.id
            );

            if (taAttempts.length > 0) {
              const taAttemptIds = taAttempts.map((att) => att.id);
              const taChats = chats?.filter((c) =>
                taAttemptIds.includes(c.attemptId)
              );
              const taGrades = safeGrades.filter((g) =>
                taChats?.some((c) => c.id === g.simulationChatId)
              );

              if (taGrades.length > 0) {
                // Calculate highest score as percentage
                const rubricTotalPoints = rubric?.points || 100;
                highestScore = Math.round(
                  (Math.max(...taGrades.map((g) => g.score)) /
                    rubricTotalPoints) *
                    100
                );
                hasPassed = taGrades.some((g) => g.passed);
              }
            }
          }
        }

        return {
          ...simulation,
          cohort: data.cohort,
          rubric,
          passRate,
          hasPassed,
          highestScore,
          rubricData: {
            attempts: [], // We don't need detailed attempt data for the card
            highestScore,
          },
        };
      });
    });
  }, [
    processedCohortData,
    allRubrics,
    shouldShowAll,
    effectiveProfile?.id,
    safeAttempts,
    chats,
    safeGrades,
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

  // Note: We could separate completed and non-completed simulations here if needed for future features

  // Sort progress data the same way as the cards (non-completed first, then by cohort)
  const sortedProgressData = useMemo(() => {
    if (!processedCohortData) return [];

    // Flatten all simulations with their cohort info
    const allSimulationsWithCohort = processedCohortData.flatMap((data) => {
      return data.simulations.map((simulation) => ({
        ...simulation,
        cohort: data.cohort,
      }));
    });

    // Sort using the same logic as sortedSimulations
    return allSimulationsWithCohort.sort((a, b) => {
      // First sort by completion status (non-completed first)
      const aCompleted = a.progress.passedCount >= a.progress.totalMembers;
      const bCompleted = b.progress.passedCount >= b.progress.totalMembers;

      if (aCompleted !== bCompleted) {
        return aCompleted ? 1 : -1;
      }

      // Then sort by cohort title
      return a.cohort.title.localeCompare(b.cohort.title);
    });
  }, [processedCohortData]);

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
  const isLoading =
    loadingCohorts ||
    loadingSimulations ||
    loadingProfiles ||
    loadingRubrics ||
    loadingAttempts ||
    loadingChats ||
    loadingGrades;

  if (isLoading || !effectiveProfile) {
    return (
      <div className="container mx-auto p-4 space-y-8">
        {/* Header skeleton */}
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-10 w-48" />
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

  if (!availableCohorts.length) {
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
      {/* Header with title and cohort picker */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">
          Welcome back, {effectiveProfile?.firstName}!
        </h2>
        <CohortPicker
          cohorts={availableCohorts.map((cohort) => ({
            ...cohort,
            title: cohort.isCompleted ? (
              <div className="flex items-center gap-2">
                <span>{cohort.title}</span>
                <Badge
                  variant="secondary"
                  className="bg-green-100 text-green-800 border-green-200"
                >
                  Complete
                </Badge>
              </div>
            ) : (
              cohort.title
            ),
          }))}
          placeholder={
            selectedCohorts.length === 0 ? "All cohorts" : "Select cohorts..."
          }
          onSelect={setSelectedCohorts}
          selectedCohorts={selectedCohorts}
          hideSelectedChips={true}
        />
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

      {/* History Section */}
      <div className="mt-12">
        <SimulationHistory
          showAll={shouldShowAll}
          cohortIds={selectedCohortIds}
          showExport={!shouldShowAll}
          showPractice={false}
        />
      </div>

      {/* Tour Component - Only for TAs */}
      {/* TATour component is now handled in the layout */}
    </div>
  );
}
