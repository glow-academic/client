/**
 * TATour.tsx
 * Tour launcher component for TA users that triggers the persistent sidebar tour
 * @AshokSaravanan222 & @siladiea
 * 01/15/2025
 */
"use client";
import { logError, logInfo } from "@/utils/logger";
import { useQuery } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";

import { useProfile } from "@/contexts/profile-context";
import { useTour } from "@/contexts/tour-context";
import { useWebSocket } from "@/contexts/websocket-context";
import { updateProfile } from "@/utils/mutations/profiles/update-profile";
import { getAllClasses } from "@/utils/queries/classes/get-all-classes";
import { getAllCohorts } from "@/utils/queries/cohorts/get-all-cohorts";
import { getAllSimulations } from "@/utils/queries/simulations/get-all-simulations";
import { createTATourSteps } from "@/utils/tour-steps";

export default function TATour() {
  const router = useRouter();
  const pathname = usePathname();
  const { effectiveProfile } = useProfile();
  const { isConnected, emitStartSimulation } = useWebSocket();
  const {
    state: tourState,
    openTour,
    nextStep,
    completeStep,
    setNavigating,
    setLoadingSimulation,
    setShowGuideButton,
  } = useTour();

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

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

      completeStep(stepIndex);

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
    [effectiveProfile, tourState.steps, completeStep]
  );

  // Navigation handlers
  const handleNavigateToCohort = useCallback(() => {
    if (taCohorts.length === 0) {
      toast.error("No cohorts assigned to you yet.");
      return;
    }

    setNavigating(true);
    const firstCohort = taCohorts[0];
    if (!firstCohort) {
      toast.error("No cohorts assigned to you yet.");
      setNavigating(false);
      return;
    }
    router.push(`/cohorts/c/${firstCohort.id}`);

    // Mark step as complete after navigation
    setTimeout(() => {
      handleStepComplete(1);
      setNavigating(false);
    }, 1000);
  }, [taCohorts, router, handleStepComplete, setNavigating]);

  const handleNavigateToClass = useCallback(() => {
    if (taClasses.length === 0) {
      toast.error("No classes assigned to you yet.");
      return;
    }

    setNavigating(true);
    const firstClass = taClasses[0];
    if (!firstClass) {
      toast.error("No classes assigned to you yet.");
      setNavigating(false);
      return;
    }
    router.push(`/classes/c/${firstClass.id}`);

    // Mark step as complete after navigation
    setTimeout(() => {
      handleStepComplete(2);
      setNavigating(false);
    }, 1000);
  }, [taClasses, router, handleStepComplete, setNavigating]);

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
    [
      isConnected,
      effectiveProfile,
      emitStartSimulation,
      handleStepComplete,
      setLoadingSimulation,
    ]
  );

  const handleEndChat = useCallback(() => {
    // This will be called when the user clicks the end chat button
    // The step will be marked complete automatically
    handleStepComplete(4);
  }, [handleStepComplete]);

  // Initialize tour steps and launch tour
  useEffect(() => {
    if (!effectiveProfile || tourState.isOpen) return;

    // Start tour if user hasn't viewed intro or chat
    if (!effectiveProfile.viewedIntro || !effectiveProfile.viewedChat) {
      const steps = createTATourSteps(
        effectiveProfile,
        () => router.push("/home"),
        (cohortId: string) => router.push(`/cohorts/c/${cohortId}`),
        (classId: string) => router.push(`/classes/c/${classId}`),
        (simulationId: string) => handleStartSimulation(simulationId),
        () => handleEndChat()
      );

      openTour(steps, effectiveProfile);
    }
  }, [
    effectiveProfile,
    tourState.isOpen,
    router,
    handleStartSimulation,
    handleEndChat,
    openTour,
  ]);

  // Automatic step completion based on user actions
  useEffect(() => {
    if (!tourState.isOpen || !effectiveProfile) return;

    const currentStep = tourState.steps[tourState.currentStep];
    if (!currentStep || currentStep.isCompleted) return;

    // Step 1: Home overview - auto-complete when on home page
    if (tourState.currentStep === 0 && pathname === "/home") {
      handleStepComplete(0);
    }

    // Step 2: Cohorts page - auto-complete when on cohorts page
    if (tourState.currentStep === 1 && pathname.includes("/cohorts/c/")) {
      handleStepComplete(1);
    }

    // Step 3: Classes page - auto-complete when on classes page
    if (tourState.currentStep === 2 && pathname.includes("/classes/c/")) {
      handleStepComplete(2);
    }

    // Step 4: Practice simulation - auto-complete when simulation starts
    if (tourState.currentStep === 3 && pathname.includes("/home/a/")) {
      handleStepComplete(3);
    }

    // Step 5: Send message - auto-complete when message is sent
    if (tourState.currentStep === 4) {
      // This will be handled by the message event listener below
    }

    // Step 6: End chat - auto-complete when end chat button is clicked
    // This is handled by the event listener below
  }, [
    tourState.currentStep,
    tourState.steps,
    pathname,
    effectiveProfile,
    tourState.isOpen,
    handleStepComplete,
  ]);

  // Automatic navigation between steps
  useEffect(() => {
    if (!tourState.isOpen || !effectiveProfile) return;

    const currentStep = tourState.steps[tourState.currentStep];
    if (!currentStep || currentStep.isCompleted) return;

    // Auto-navigate based on current step
    switch (tourState.currentStep) {
      case 0: // Home overview - already on home
        break;
      case 1: // Navigate to cohorts
        if (pathname !== "/cohorts" && !pathname.includes("/cohorts/c/")) {
          handleNavigateToCohort();
        }
        break;
      case 2: // Navigate to classes
        if (pathname !== "/classes" && !pathname.includes("/classes/c/")) {
          handleNavigateToClass();
        }
        break;
      case 3: // Navigate to home and start simulation
        if (pathname !== "/home") {
          router.push("/home");
        } else if (practiceSimulations.length > 0 && practiceSimulations[0]) {
          handleStartSimulation(practiceSimulations[0].id);
        }
        break;
      case 4: // Send message - handled by event listener
        break;
      case 5: // End chat - handled by event listener
        break;
    }
  }, [
    tourState.currentStep,
    tourState.steps,
    pathname,
    effectiveProfile,
    tourState.isOpen,
    handleNavigateToCohort,
    handleNavigateToClass,
    handleStartSimulation,
    practiceSimulations,
    router,
  ]);

  // Handle step completion and auto-advance
  useEffect(() => {
    if (!tourState.isOpen || !effectiveProfile) return;

    const currentStep = tourState.steps[tourState.currentStep];
    if (!currentStep || !currentStep.isCompleted) return;

    // Auto-advance to next step after a short delay
    const timer = setTimeout(() => {
      if (tourState.currentStep < tourState.steps.length - 1) {
        nextStep();
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [
    tourState.currentStep,
    tourState.steps,
    effectiveProfile,
    tourState.isOpen,
    nextStep,
  ]);

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
        handleStepComplete(5);
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
  }, [router, handleStepComplete, setLoadingSimulation]);

  // Custom step actions mapping
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

  // Set up global action handlers for the tour context
  useEffect(() => {
    const handleTourAction = (event: CustomEvent) => {
      const { stepIndex } = event.detail;
      const action =
        customStepActions[stepIndex as keyof typeof customStepActions];
      if (action) {
        action();
      }
    };

    window.addEventListener("tourAction", handleTourAction as EventListener);
    return () => {
      window.removeEventListener(
        "tourAction",
        handleTourAction as EventListener
      );
    };
  }, [customStepActions]);

  // Show guide button when tour is not complete
  useEffect(() => {
    if (
      effectiveProfile &&
      (!effectiveProfile.viewedIntro || !effectiveProfile.viewedChat)
    ) {
      setShowGuideButton(true);
    } else {
      setShowGuideButton(false);
    }
  }, [effectiveProfile, setShowGuideButton]);

  // This component no longer renders UI - it just manages tour state
  return null;
}
