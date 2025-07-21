/**
 * TATour.tsx
 * Tour component for TA users that replaces the WelcomeOverlay
 * @AshokSaravanan222 & @siladiea
 * 01/15/2025
 */
"use client";
import { logError, logInfo } from "@/utils/logger";
import { useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

// Dynamically import Tour to avoid SSR issues
const Tour = dynamic(() => import("reactour"), {
  ssr: false,
  loading: () => null,
});

import { useProfile } from "@/contexts/profile-context";
import { useWebSocket } from "@/contexts/websocket-context";
import { updateProfile } from "@/utils/mutations/profiles/update-profile";
import { getAllClasses } from "@/utils/queries/classes/get-all-classes";
import { getAllCohorts } from "@/utils/queries/cohorts/get-all-cohorts";
import { getAllSimulations } from "@/utils/queries/simulations/get-all-simulations";
import { TourState, createTATourSteps } from "@/utils/tour-steps";

interface TATourProps {
  onClose: () => void;
}

export default function TATour({ onClose }: TATourProps) {
  const router = useRouter();
  const { effectiveProfile } = useProfile();
  const { isConnected, emitStartSimulation } = useWebSocket();

  const [tourState, setTourState] = useState<TourState>({
    isActive: false,
    currentStep: 0,
    steps: [],
    profile: null,
  });

  const [isNavigating, setIsNavigating] = useState(false);
  const [loadingSimulation, setLoadingSimulation] = useState<string | null>(
    null
  );
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  // Ensure component is mounted on client side
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Fetch data needed for tour navigation
  const { data: cohorts = [] } = useQuery({
    queryKey: ["cohorts"],
    queryFn: () => getAllCohorts(),
  });

  const { data: classes = [] } = useQuery({
    queryKey: ["classes"],
    queryFn: () => getAllClasses(),
  });

  const { data: simulations = [] } = useQuery({
    queryKey: ["simulations"],
    queryFn: () => getAllSimulations(),
  });

  // Get TA's assigned cohorts and classes
  const taCohorts = useMemo(() => {
    if (!effectiveProfile || !cohorts) return [];
    return cohorts.filter((cohort) =>
      cohort.profileIds?.includes(effectiveProfile.id)
    );
  }, [effectiveProfile, cohorts]);

  const taClasses = useMemo(() => {
    if (!effectiveProfile || !classes) return [];
    return classes.filter((cls) =>
      cls.profileIds?.includes(effectiveProfile.id)
    );
  }, [effectiveProfile, classes]);

  // Get practice simulations (defaultSimulation = true)
  const practiceSimulations = useMemo(() => {
    return simulations.filter((sim) => sim.defaultSimulation);
  }, [simulations]);

  // Handle step completion
  const handleStepComplete = useCallback(
    async (stepIndex: number) => {
      if (!effectiveProfile) return;

      setTourState((prev) => ({
        ...prev,
        steps: prev.steps.map((step, index) =>
          index === stepIndex ? { ...step, isCompleted: true } : step
        ),
      }));

      // Update profile based on completed steps
      const updatedSteps = tourState.steps.map((step, index) =>
        index === stepIndex ? { ...step, isCompleted: true } : step
      );

      const introStepsComplete = updatedSteps
        .slice(0, 3)
        .every((step) => step.isCompleted);
      const chatStepsComplete = updatedSteps
        .slice(3)
        .every((step) => step.isCompleted);

      try {
        if (introStepsComplete && !effectiveProfile.viewedIntro) {
          await updateProfile(effectiveProfile.id, { viewedIntro: true });
          logInfo("Updated profile: viewedIntro = true");
        }

        if (chatStepsComplete && !effectiveProfile.viewedChat) {
          await updateProfile(effectiveProfile.id, { viewedChat: true });
          logInfo("Updated profile: viewedChat = true");
        }
      } catch (error) {
        logError("Error updating profile for tour completion:", error);
      }
    },
    [effectiveProfile, tourState.steps]
  );

  // Handle tour close
  const handleTourClose = useCallback(() => {
    setTourState((prev) => ({ ...prev, isActive: false }));
    onClose();
  }, [onClose]);

  // Navigation handlers
  const handleNavigateToCohort = useCallback(() => {
    if (taCohorts.length === 0) {
      toast.error("No cohorts assigned to you yet.");
      return;
    }

    setIsNavigating(true);
    const firstCohort = taCohorts[0];
    if (!firstCohort) {
      toast.error("No cohorts assigned to you yet.");
      setIsNavigating(false);
      return;
    }
    router.push(`/cohorts/c/${firstCohort.id}`);

    // Mark step as complete after navigation
    setTimeout(() => {
      handleStepComplete(1);
      setIsNavigating(false);
    }, 1000);
  }, [taCohorts, router, handleStepComplete]);

  const handleNavigateToClass = useCallback(() => {
    if (taClasses.length === 0) {
      toast.error("No classes assigned to you yet.");
      return;
    }

    setIsNavigating(true);
    const firstClass = taClasses[0];
    if (!firstClass) {
      toast.error("No classes assigned to you yet.");
      setIsNavigating(false);
      return;
    }
    router.push(`/classes/c/${firstClass.id}`);

    // Mark step as complete after navigation
    setTimeout(() => {
      handleStepComplete(2);
      setIsNavigating(false);
    }, 1000);
  }, [taClasses, router, handleStepComplete]);

  const handleStartSimulation = useCallback(
    async (simulationId: string) => {
      if (!isConnected) {
        toast.error("WebSocket not connected. Please wait for connection.");
        return;
      }

      if (!effectiveProfile?.id) {
        toast.error("Profile not loaded. Please refresh the page.");
        return;
      }

      setLoadingSimulation(simulationId);
      const toastId = toast.loading("Starting practice simulation...");

      try {
        emitStartSimulation({
          simulation_id: simulationId,
          profile_id: String(effectiveProfile.id),
        });

        // Set timeout for simulation start
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
          toast.dismiss(toastId);
          toast.error("Simulation start timed out. Please try again.");
          setLoadingSimulation(null);
        }, 30000);

        // Mark step as complete
        handleStepComplete(3);
      } catch (error) {
        logError("Error starting simulation:", error);
        toast.dismiss(toastId);
        toast.error("Failed to start simulation. Please try again.");
        setLoadingSimulation(null);
      }
    },
    [isConnected, effectiveProfile, emitStartSimulation, handleStepComplete]
  );

  const handleEndChat = useCallback(() => {
    // This will be called when the user clicks the end chat button
    // The step will be marked complete automatically
    handleStepComplete(4);
  }, [handleStepComplete]);

  // Initialize tour steps
  useEffect(() => {
    if (!effectiveProfile) return;

    const steps = createTATourSteps(
      effectiveProfile,
      () => router.push("/home"),
      (cohortId: string) => router.push(`/cohorts/c/${cohortId}`),
      (classId: string) => router.push(`/classes/c/${classId}`),
      (simulationId: string) => handleStartSimulation(simulationId),
      () => handleEndChat()
    );

    setTourState((prev) => ({
      ...prev,
      steps,
      profile: effectiveProfile,
    }));
  }, [effectiveProfile, router, handleStartSimulation, handleEndChat]);

  // Check if tour should start
  useEffect(() => {
    if (!effectiveProfile || tourState.steps.length === 0) return;

    // Start tour if user hasn't viewed intro or chat
    if (!effectiveProfile.viewedIntro || !effectiveProfile.viewedChat) {
      setTourState((prev) => ({ ...prev, isActive: true }));
    }
  }, [effectiveProfile, tourState.steps.length]);

  // Set up simulation event listeners
  useEffect(() => {
    const handleSimulationStarted = (event: CustomEvent) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      const { attemptId } = event.detail;
      logInfo("Navigating to simulation attempt", { attemptId });
      router.push(`/home/a/${attemptId}`);
      setLoadingSimulation(null);
    };

    const handleSimulationError = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      toast.error("Failed to start simulation. Please try again.");
      setLoadingSimulation(null);
    };

    // Listen for end chat button clicks
    const handleEndChatClick = (event: Event) => {
      const target = event.target as HTMLElement;
      if (target.closest("[data-tour-end-chat]")) {
        logInfo("End chat button clicked - marking tour step complete");
        handleStepComplete(4);
      }
    };

    window.addEventListener(
      "simulationStarted",
      handleSimulationStarted as EventListener
    );
    window.addEventListener("simulationError", handleSimulationError);
    document.addEventListener("click", handleEndChatClick);

    return () => {
      window.removeEventListener(
        "simulationStarted",
        handleSimulationStarted as EventListener
      );
      window.removeEventListener("simulationError", handleSimulationError);
      document.removeEventListener("click", handleEndChatClick);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [router, handleStepComplete]);

  // Custom step actions
  const customStepActions = useMemo(() => {
    return {
      1: handleNavigateToCohort, // Cohorts page
      2: handleNavigateToClass, // Classes page
      3: () => {
        if (practiceSimulations.length === 0) {
          toast.error("No practice simulations available.");
          return;
        }
        const firstSimulation = practiceSimulations[0];
        if (!firstSimulation) {
          toast.error("No practice simulations available.");
          return;
        }
        handleStartSimulation(firstSimulation.id);
      }, // Start practice simulation
    };
  }, [
    handleNavigateToCohort,
    handleNavigateToClass,
    handleStartSimulation,
    practiceSimulations,
  ]);

  // Don't render anything during SSR
  if (!isMounted) {
    return null;
  }

  // Tour configuration
  const tourConfig = {
    steps: tourState.steps.map((step, index) => ({
      selector: step.selector || "body",
      content: (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">{step.title}</h3>
          <p className="text-sm text-muted-foreground">{step.content}</p>
          {step.requiresAction && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const action =
                    customStepActions[index as keyof typeof customStepActions];
                  if (action) {
                    action();
                  }
                }}
                disabled={isNavigating || !!loadingSimulation}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
              >
                {isNavigating
                  ? "Navigating..."
                  : loadingSimulation
                    ? "Starting..."
                    : "Continue"}
              </button>
              <button
                onClick={() => handleStepComplete(index)}
                className="px-4 py-2 bg-secondary text-secondary-foreground rounded-md text-sm font-medium hover:bg-secondary/90"
              >
                Mark Complete
              </button>
            </div>
          )}
        </div>
      ),
      position: step.position || "bottom",
    })),
    isOpen: tourState.isActive,
    onRequestClose: handleTourClose,
    showNavigation: false,
    showNavigationNumber: false,
    showButtons: false,
    showCloseButton: true,
    showBadge: false,
    disableInteraction: false,
    disableDotsNavigation: true,
    className: "tour-overlay",
    maskClassName: "tour-mask",
    highlightedMaskClassName: "tour-highlighted-mask",
  };

  if (!tourState.isActive || tourState.steps.length === 0) {
    return null;
  }

  // Additional safety check for Tour component
  if (!Tour) {
    return null;
  }

  return <Tour {...tourConfig} />;
}
