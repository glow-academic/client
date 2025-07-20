/**
 * Home.tsx
 * This is the unified home page with role-based access control
 * @AshokSaravanan222 & @siladiea
 * 05/14/2025
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
import { updateProfile } from "@/utils/mutations/profiles/update-profile";
import { getAllAgents } from "@/utils/queries/agents/get-all-agents";
import { getAllClasses } from "@/utils/queries/classes/get-all-classes";
import { getAllCohorts } from "@/utils/queries/cohorts/get-all-cohorts";
import { getAllProfiles } from "@/utils/queries/profiles/get-all-profiles";
import { getAllRubrics } from "@/utils/queries/rubrics/get-all-rubrics";
import { getAllScenarios } from "@/utils/queries/scenarios/get-all-scenarios";
import { getSimulationAttemptsByProfiles } from "@/utils/queries/simulation_attempts/get-simulation-attempts-by-profiles";
import { getSimulationChatFeedbacksBySimulationChatGrades } from "@/utils/queries/simulation_chat_feedbacks/get-simulation-chat-feedbacks-by-simulationchatgrades";
import { getSimulationChatGradesBySimulationChats } from "@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-simulationchats";
import { getSimulationChatsByAttempts } from "@/utils/queries/simulation_chats/get-simulation-chats-by-attempts";
import { getAllSimulations } from "@/utils/queries/simulations/get-all-simulations";
import { getStandardGroupsByRubrics } from "@/utils/queries/standard_groups/get-standard-groups-by-rubrics";
import { getStandardsByStandardGroups } from "@/utils/queries/standards/get-standards-by-standardgroups";
import SimulationHistory from "../common/history/SimulationHistory";
import { Skeleton } from "../ui/skeleton";
import CompletionistView from "./CompletionistView";
import PracticeZone from "./PracticeZone";
import WelcomeOverlay from "./WelcomeOverlay";
import { Cohort, Profile } from "@/types";

export default function Home() {
  const router = useRouter();
  const [loadingSimulation, setLoadingSimulation] = useState<string | null>(
    null
  );
  const [loadingToastId, setLoadingToastId] = useState<string | number | null>(
    null
  );
  const timeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const [showWelcomeOverlay, setShowWelcomeOverlay] = useState(false);

  // Use global WebSocket context instead of local connection
  const { isConnected, emitStartSimulation } = useWebSocket();
  const { effectiveProfile, activeProfile } = useProfile();

  // 1. EXPAND DATA FETCHING SCOPE FOR ADMINS/INSTRUCTORS
  const isAdminView =
    effectiveProfile?.role === "admin" ||
    effectiveProfile?.role === "superadmin" ||
    effectiveProfile?.role === "instructional";

  // Fetch all profiles if admin, otherwise just the user's
  const { data: profiles, isLoading: _loadingProfiles } = useQuery({
    queryKey: ["allProfilesForHome", isAdminView],
    queryFn: getAllProfiles,
    enabled: !!effectiveProfile,
  });

  const profileIdsForQueries = useMemo(() => {
    if (!profiles) return [];
    if (isAdminView) return profiles.map((p: Profile) => p.id); // All users for admin
    return [effectiveProfile!.id]; // Just self for TA/student
  }, [profiles, isAdminView, effectiveProfile]);

  // Fetch classes and simulations
  const { data: classes } = useQuery({
    queryKey: ["classes"],
    queryFn: () => getAllClasses(),
  });

  const { data: cohorts } = useQuery({
    queryKey: ["cohorts"],
    queryFn: () => getAllCohorts(),
  });

  const { data: simulations, isLoading: simulationsLoading } = useQuery({
    queryKey: ["simulations"],
    queryFn: () => getAllSimulations(),
  });

  const { data: scenarios } = useQuery({
    queryKey: ["scenarios"],
    queryFn: () => getAllScenarios(),
  });

  const { data: agents } = useQuery({
    queryKey: ["agents"],
    queryFn: () => getAllAgents(),
  });

  // Fetch rubric-related data for real progress tracking
  const { data: rubrics } = useQuery({
    queryKey: ["rubrics"],
    queryFn: () => getAllRubrics(),
  });

  const { data: standardGroups } = useQuery({
    queryKey: ["standardGroups", rubrics?.map((rubric) => rubric.id)],
    queryFn: () =>
      getStandardGroupsByRubrics(rubrics!.map((rubric) => rubric.id)),
    enabled: !!rubrics && rubrics.length > 0,
  });

  const { data: standards } = useQuery({
    queryKey: ["standards", standardGroups?.map((group) => group.id)],
    queryFn: () =>
      getStandardsByStandardGroups(standardGroups!.map((group) => group.id)),
    enabled: !!standardGroups && standardGroups.length > 0,
  });

  // 2. USE THE EXPANDED SCOPE IN SUBSEQUENT QUERIES
  const { data: attempts, isLoading: _loadingAttempts } = useQuery({
    queryKey: ["simulationAttemptsForHome", profileIdsForQueries],
    queryFn: () => getSimulationAttemptsByProfiles(profileIdsForQueries),
    enabled: profileIdsForQueries.length > 0,
  });

  const { data: chats } = useQuery({
    queryKey: ["simulationChats", attempts?.map((attempt) => attempt.id)],
    queryFn: () =>
      getSimulationChatsByAttempts(attempts!.map((attempt) => attempt.id)),
    enabled: !!attempts && attempts.length > 0,
  });

  const { data: grades } = useQuery({
    queryKey: ["simulationGrades", chats?.map((chat) => chat.id)],
    queryFn: () =>
      getSimulationChatGradesBySimulationChats(chats!.map((chat) => chat.id)),
    enabled: !!chats && chats.length > 0,
  });

  const { data: feedbacks } = useQuery({
    queryKey: ["simulationFeedbacks", grades?.map((grade) => grade.id)],
    queryFn: () =>
      getSimulationChatFeedbacksBySimulationChatGrades(
        grades!.map((grade) => grade.id)
      ),
    enabled: !!grades && grades.length > 0,
  });

  const handleCloseWelcomeOverlay = useCallback(async () => {
    try {
      if (!effectiveProfile) {
        logError("Profile not found");
        return;
      }
      await updateProfile(effectiveProfile.id, {
        viewedIntro: true,
      });
    } catch (error) {
      logError("Error updating profile", error);
    }
    setShowWelcomeOverlay(false);
  }, [effectiveProfile]);

  useEffect(() => {
    if (effectiveProfile) {
      if (!effectiveProfile.viewedIntro) {
        setShowWelcomeOverlay(true);
      }
    }
  }, [effectiveProfile]);

  // 3. PROCESS DATA FOR NEW COMPONENTS
  const completionistData = useMemo(() => {
    if (
      !effectiveProfile ||
      !cohorts ||
      !simulations ||
      !grades ||
      !profiles ||
      !attempts
    ) {
      return { percentage: 0, actionItems: [] };
    }

    let percentage = 0;
    let actionItems:
      | { type: string; href: string; label: string }[]
      | Cohort[] = [];

    if (effectiveProfile.role === "ta") {
      const taCohorts = cohorts.filter((c) =>
        c.profileIds?.includes(effectiveProfile.id)
      );
      const assignedSimulations = simulations.filter(
        (s) =>
          !s.defaultSimulation &&
          s.cohortIds?.some((cid) => taCohorts.some((tc) => tc.id === cid))
      );
      if (assignedSimulations.length === 0)
        return { percentage: 100, actionItems: [] };

      let passedCount = 0;
      const incompleteCohorts = new Set<string>();

      assignedSimulations.forEach((sim) => {
        const taAttemptsForSim = attempts.filter(
          (a) =>
            a.profileId === effectiveProfile.id && a.simulationId === sim.id
        );
        const taAttemptIds = taAttemptsForSim.map((a) => a.id);
        const taChats = chats?.filter((c) =>
          taAttemptIds.includes(c.attemptId)
        );
        const taGrades = grades.filter((g) =>
          taChats?.some((c) => c.id === g.simulationChatId)
        );

        if (taGrades.some((g) => g.passed)) {
          passedCount++;
        } else {
          // Find which cohorts this incomplete simulation belongs to
          sim.cohortIds?.forEach((cid) => {
            if (taCohorts.some((tc) => tc.id === cid))
              incompleteCohorts.add(cid);
          });
        }
      });

      percentage = Math.round((passedCount / assignedSimulations.length) * 100);
      actionItems = cohorts.filter((c) => incompleteCohorts.has(c.id));
    } else {
      // Admin/Instructor/Other Logic
      const allCohortSimulations = simulations.filter(
        (s) => !s.defaultSimulation && s.cohortIds?.length > 0
      );
      let totalRequiredPasses = 0;
      let actualPasses = 0;

      allCohortSimulations.forEach((sim) => {
        sim.cohortIds?.forEach((cid) => {
          const cohort = cohorts.find((c) => c.id === cid);
          if (!cohort) return;

          cohort.profileIds?.forEach((pid) => {
            totalRequiredPasses++;
            const memberAttempts = attempts.filter(
              (a) => a.profileId === pid && a.simulationId === sim.id
            );
            const memberAttemptIds = memberAttempts.map((a) => a.id);
            const memberChats = chats?.filter((c) =>
              memberAttemptIds.includes(c.attemptId)
            );
            const memberGrades = grades.filter((g) =>
              memberChats?.some((c) => c.id === g.simulationChatId)
            );

            if (memberGrades.some((g) => g.passed)) {
              actualPasses++;
            }
          });
        });
      });

      percentage =
        totalRequiredPasses > 0
          ? Math.round((actualPasses / totalRequiredPasses) * 100)
          : 100;
      actionItems = [
        {
          type: "monitor",
          label: "Monitor All Cohorts",
          href: "/analytics/reports",
        },
      ];
    }

    return { percentage, actionItems };
  }, [
    effectiveProfile,
    cohorts,
    simulations,
    grades,
    profiles,
    attempts,
    chats,
  ]);

  const practiceSimulations = useMemo(() => {
    if (!simulations) return [];
    // Simply filter for all simulations marked as 'defaultSimulation'
    return simulations.filter((sim) => sim.defaultSimulation);
  }, [simulations]);

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
        if (!classes) {
          toast.error("No classes found. Please contact an administrator.");
          return;
        }

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
      classes,
      isConnected,
      emitStartSimulation,
      loadingToastId,
      activeProfile,
    ]
  );

  // Memoize rubric data calculation to prevent unnecessary recalculations
  const rubricDataCache = useMemo(() => {
    if (
      !attempts ||
      !chats ||
      !grades ||
      !feedbacks ||
      !standards ||
      !standardGroups
    ) {
      return new Map();
    }

    const cache = new Map();

    // Pre-calculate for all simulations to avoid recalculation on each render
    const allSimulationIds = [...new Set(attempts.map((a) => a.simulationId))];

    allSimulationIds.forEach((simulationId) => {
      // Get attempts for this simulation
      const simulationAttempts = attempts.filter(
        (attempt) => attempt.simulationId === simulationId
      );

      // Get chats for these attempts
      const simulationChats = chats.filter((chat) =>
        simulationAttempts.some((attempt) => attempt.id === chat.attemptId)
      );

      // Get grades for these chats
      const simulationGrades = grades.filter((grade) =>
        simulationChats.some((chat) => chat.id === grade.simulationChatId)
      );

      // Get feedbacks for these grades
      const simulationFeedbacks = feedbacks.filter((feedback) =>
        simulationGrades.some(
          (grade) => grade.id === feedback.simulationChatGradeId
        )
      );

      // Group by attempt and calculate scores
      const attemptData = simulationAttempts.map((attempt, index) => {
        const attemptChats = simulationChats.filter(
          (chat) => chat.attemptId === attempt.id
        );
        const attemptGrades = simulationGrades.filter((grade) =>
          attemptChats.some((chat) => chat.id === grade.simulationChatId)
        );
        const attemptFeedbacks = simulationFeedbacks.filter((feedback) =>
          attemptGrades.some(
            (grade) => grade.id === feedback.simulationChatGradeId
          )
        );

        // Calculate skill scores similar to Overview.tsx
        const skillScores = standardGroups.reduce(
          (acc, group) => {
            const groupStandards = standards.filter(
              (s) => s.standardGroupId === group.id
            );
            const groupFeedbacks = attemptFeedbacks.filter((f) =>
              groupStandards.some((s) => s.id === f.standardId)
            );

            if (groupFeedbacks.length > 0) {
              // Use the rubric's total points for this group instead of max standard points
              const rubric = rubrics?.find((r) => r.id === group.rubricId);
              const rubricTotalPoints = rubric?.points || 100;

              const avgScore = Math.round(
                (groupFeedbacks.reduce((sum, f) => sum + f.total, 0) /
                  groupFeedbacks.length /
                  rubricTotalPoints) *
                  100
              );
              acc[group.shortName] = avgScore;
            }

            return acc;
          },
          {} as Record<string, number>
        );

        // Calculate overall score - normalize to percentage based on rubric total points
        const rubric = rubrics?.find((r) =>
          standardGroups?.some((sg) => sg.rubricId === r.id)
        );
        const rubricTotalPoints = rubric?.points || 20;

        const overallScore =
          attemptGrades.length > 0
            ? Math.round(
                (attemptGrades.reduce((sum, g) => sum + g.score, 0) /
                  attemptGrades.length /
                  rubricTotalPoints) *
                  100 // Convert to percentage
              )
            : 0;

        return {
          attempt: index + 1,
          overallScore,
          skillScores,
          createdAt: attempt.createdAt,
        };
      });

      const highestScore =
        attemptData.length > 0
          ? Math.max(...attemptData.map((a) => a.overallScore))
          : 0;

      cache.set(simulationId, { attempts: attemptData, highestScore });
    });

    return cache;
  }, [attempts, chats, grades, feedbacks, standards, standardGroups, rubrics]);

  // Get real rubric data for a simulation
  const getRealRubricData = useCallback(
    (simulationId: string) => {
      return (
        rubricDataCache.get(simulationId) || { attempts: [], highestScore: 0 }
      );
    },
    [rubricDataCache]
  );

  // Loading state
  if (simulationsLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between space-y-2">
          <div>
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>

        {/* Skeleton for Simulation Cards */}
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
    );
  }

  // 4. RENDER NEW COMPONENT STRUCTURE
  return (
    <TooltipProvider>
      <div className="container mx-auto p-4 md:p-6 space-y-12">
        <CompletionistView
          data={completionistData}
          profile={effectiveProfile}
        />
        <PracticeZone
          simulations={practiceSimulations}
          profile={effectiveProfile}
          onStartSimulation={handleStartSimulation}
          loadingSimulation={loadingSimulation}
          getRealRubricData={getRealRubricData}
          scenarios={scenarios ?? []}
          agents={agents ?? []}
        />

        {/* History Section for non-guests */}
        {effectiveProfile?.role !== "guest" && (
          <div className="space-y-2">
            <SimulationHistory showAll={false} showExport={false} />
          </div>
        )}
      </div>
      {showWelcomeOverlay && (
        <WelcomeOverlay onClose={handleCloseWelcomeOverlay} />
      )}
    </TooltipProvider>
  );
}
