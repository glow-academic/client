/**
 * TATour.tsx
 * Tour launcher component for TA users that triggers the persistent sidebar tour
 * @AshokSaravanan222 & @siladiea
 * 01/15/2025
 */
"use client";
import { logError, logInfo } from "@/utils/logger";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle, HelpCircle, Play } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useProfile } from "@/contexts/profile-context";
import { useTour } from "@/contexts/tour-context";
import { useWebSocket } from "@/contexts/websocket-context";
import { updateProfile } from "@/utils/mutations/profiles/update-profile";
import { getAllCohorts } from "@/utils/queries/cohorts/get-all-cohorts";
import { getAllSimulations } from "@/utils/queries/simulations/get-all-simulations";
import { createTATourSteps } from "@/utils/tour-steps";

// Guide Button Component
function GuideButton() {
  const { effectiveProfile } = useProfile();
  const { state: tourState, openGuide, getGuideButtonState } = useTour();

  const buttonState = getGuideButtonState();

  // Debug logging
  logInfo("GuideButton render", {
    effectiveProfile: effectiveProfile?.role,
    buttonState,
    tourStepsLength: tourState.steps.length,
    tourIsOpen: tourState.isOpen,
    viewedIntro: effectiveProfile?.viewedIntro,
    viewedChat: effectiveProfile?.viewedChat,
  });

  // Don't render if hidden or no profile
  if (buttonState === "hidden" || !effectiveProfile) {
    logInfo("GuideButton hidden", {
      buttonState,
      hasProfile: !!effectiveProfile,
    });
    return null;
  }

  const getButtonContent = () => {
    switch (buttonState) {
      case "start":
        return {
          icon: <Play className="h-4 w-4" />,
          text: "Start Tour",
          variant: "default" as const,
        };
      case "resume":
        return {
          icon: <HelpCircle className="h-4 w-4" />,
          text: "Resume Tour",
          variant: "secondary" as const,
        };
      case "complete":
        return {
          icon: <CheckCircle className="h-4 w-4" />,
          text: "Tour Complete",
          variant: "outline" as const,
        };
      default:
        return {
          icon: <HelpCircle className="h-4 w-4" />,
          text: "Help",
          variant: "outline" as const,
        };
    }
  };

  const { icon, text, variant } = getButtonContent();

  return (
    <div className="fixed bottom-4 left-4 z-50">
      <Button
        onClick={openGuide}
        variant={variant}
        size="sm"
        className="shadow-lg hover:shadow-xl transition-all duration-200"
        disabled={buttonState === "complete"}
      >
        {icon}
        <span className="ml-2">{text}</span>
      </Button>
    </div>
  );
}

export default function TATour() {
  const router = useRouter();
  const pathname = usePathname();
  const { effectiveProfile } = useProfile();
  const { isConnected, emitStartSimulation } = useWebSocket();
  const {
    state: tourState,
    openTour,
    closeTour,
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

  const { data: simulations = [] } = useQuery({
    queryKey: ["simulations"],
    queryFn: () => getAllSimulations(),
  });

  // Get TA's assigned cohorts
  const taCohorts = useMemo(() => {
    if (!effectiveProfile || !cohorts) return [];
    return cohorts.filter((cohort) =>
      cohort.profileIds?.includes(effectiveProfile.id)
    );
  }, [effectiveProfile, cohorts]);

  // Get practice simulations (defaultSimulation = true)
  const practiceSimulations = useMemo(() => {
    return simulations.filter((sim) => sim.practiceSimulation);
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

      // Steps 1-2 are tracked by viewedIntro
      const introStepsComplete = updatedSteps
        .slice(0, 2)
        .every((step) => step.isCompleted);

      // Steps 3-5 are tracked by viewedChat
      const chatStepsComplete = updatedSteps
        .slice(2)
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
  const handleNavigateToCohortLeaderboard = useCallback(() => {
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

  const handleStartPracticeSimulation = useCallback(
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

        // Mark step as complete when simulation starts
        // This will be handled by the WebSocket event listener
      } catch (error) {
        logError("Error starting simulation:", error);
        toast.dismiss(toastId);
        toast.error("Failed to start simulation. Please try again.");
        setLoadingSimulation(null);
      }
    },
    [isConnected, effectiveProfile, emitStartSimulation, setLoadingSimulation]
  );

  // Initialize tour steps and launch tour
  useEffect(() => {
    logInfo("TATour useEffect triggered", {
      hasProfile: !!effectiveProfile,
      role: effectiveProfile?.role,
      viewedIntro: effectiveProfile?.viewedIntro,
      viewedChat: effectiveProfile?.viewedChat,
    });

    if (!effectiveProfile || effectiveProfile.role !== "ta") {
      logInfo("TATour: Skipping initialization", {
        hasProfile: !!effectiveProfile,
        role: effectiveProfile?.role,
      });
      return;
    }

    // Create tour steps for TAs
    const steps = createTATourSteps(
      effectiveProfile,
      () => router.push("/home"),
      (cohortId: string) => router.push(`/cohorts/c/${cohortId}`),
      (simulationId: string) => handleStartPracticeSimulation(simulationId),
      () => {} // End chat is handled by WebSocket events
    );

    logInfo("TATour: Created steps", { stepsLength: steps.length });

    // Always initialize the tour with steps (this sets up the guide button)
    openTour(steps, effectiveProfile);
    logInfo("TATour: Opened tour");

    // If user has completed the tour, close it immediately but keep steps in state
    if (effectiveProfile.viewedIntro && effectiveProfile.viewedChat) {
      logInfo("TATour: User completed tour, closing");
      closeTour();
    }
  }, [
    effectiveProfile,
    router,
    handleStartPracticeSimulation,
    openTour,
    closeTour,
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

    // Step 2: Cohort leaderboard - auto-complete when on cohort leaderboard page
    if (tourState.currentStep === 1 && pathname.includes("/cohorts/c/")) {
      handleStepComplete(1);
    }

    // Step 3: Practice simulation - auto-complete when simulation starts
    if (tourState.currentStep === 2 && pathname.includes("/practice/a/")) {
      handleStepComplete(2);
    }

    // Step 4: Send message - handled by WebSocket event listener
    // Step 5: End chat - handled by WebSocket event listener
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
      case 1: // Navigate to cohort leaderboard
        if (pathname !== "/cohorts" && !pathname.includes("/cohorts/c/")) {
          handleNavigateToCohortLeaderboard();
        }
        break;
      case 2: // Navigate to practice and start simulation
        if (pathname !== "/practice") {
          router.push("/practice");
        } else if (practiceSimulations.length > 0 && practiceSimulations[0]) {
          handleStartPracticeSimulation(practiceSimulations[0].id);
        }
        break;
      case 3: // Send message - handled by WebSocket event listener
        break;
      case 4: // End chat - handled by WebSocket event listener
        break;
    }
  }, [
    tourState.currentStep,
    tourState.steps,
    pathname,
    effectiveProfile,
    tourState.isOpen,
    handleNavigateToCohortLeaderboard,
    handleStartPracticeSimulation,
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

  // Set up WebSocket event listeners for tour progression
  useEffect(() => {
    const handleSimulationStarted = (event: CustomEvent) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      const { attemptId } = event.detail;
      logInfo("Navigating to simulation attempt", { attemptId });
      router.push(`/practice/a/${attemptId}`);
      setLoadingSimulation(null);

      // Mark step 3 as complete when simulation starts
      if (tourState.isOpen && tourState.currentStep === 2) {
        handleStepComplete(2);
      }
    };

    const handleSimulationError = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      toast.error("Failed to start simulation. Please try again.");
      setLoadingSimulation(null);
    };

    // Listen for message sent events
    const handleMessageSent = (_event: CustomEvent) => {
      if (tourState.isOpen && tourState.currentStep === 3) {
        logInfo("Message sent - marking tour step complete");
        handleStepComplete(3);
      }
    };

    // Listen for chat ended events
    const handleChatEnded = (_event: CustomEvent) => {
      if (tourState.isOpen && tourState.currentStep === 4) {
        logInfo("Chat ended - marking tour step complete");
        handleStepComplete(4);
      }
    };

    window.addEventListener(
      "simulationStarted",
      handleSimulationStarted as EventListener
    );
    window.addEventListener("simulationError", handleSimulationError);
    window.addEventListener("messageSent", handleMessageSent as EventListener);
    window.addEventListener("chatEnded", handleChatEnded as EventListener);

    return () => {
      window.removeEventListener(
        "simulationStarted",
        handleSimulationStarted as EventListener
      );
      window.removeEventListener("simulationError", handleSimulationError);
      window.removeEventListener(
        "messageSent",
        handleMessageSent as EventListener
      );
      window.removeEventListener("chatEnded", handleChatEnded as EventListener);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [
    router,
    handleStepComplete,
    setLoadingSimulation,
    tourState.isOpen,
    tourState.currentStep,
  ]);

  // Custom step actions mapping
  const customStepActions = useMemo(() => {
    return {
      1: handleNavigateToCohortLeaderboard, // Cohort leaderboard
      2: () => {
        if (practiceSimulations.length === 0) {
          toast.error("No practice simulations available.");
          return;
        }
        const firstSimulation = practiceSimulations[0];
        if (!firstSimulation) {
          toast.error("No practice simulations available.");
          return;
        }
        handleStartPracticeSimulation(firstSimulation.id);
      }, // Start practice simulation
    };
  }, [
    handleNavigateToCohortLeaderboard,
    handleStartPracticeSimulation,
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
      setShowGuideButton(true); // Always show guide button
    }
  }, [effectiveProfile, setShowGuideButton]);

  // Render the guide button
  return <GuideButton />;
}
