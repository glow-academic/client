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
    setAttemptId,
  } = useTour();

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const tourStateRef = useRef(tourState);

  // Update ref when tour state changes
  useEffect(() => {
    tourStateRef.current = tourState;
  }, [tourState]);

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

  // Get practice simulations (practiceSimulation = true)
  const practiceSimulations = useMemo(() => {
    return simulations.filter((sim) => sim.practiceSimulation);
  }, [simulations]);

  // Handle step completion with proper profile updates
  const handleStepComplete = useCallback(
    async (stepIndex: number) => {
      if (!effectiveProfile) return;

      logInfo("Completing tour step", {
        stepIndex,
        effectiveProfile: effectiveProfile.id,
      });
      completeStep(stepIndex);

      // Get current steps from tour state ref to avoid dependency issues
      const currentSteps = tourStateRef.current.steps;

      // Update profile based on completed steps
      const updatedSteps = currentSteps.map((step, index) =>
        index === stepIndex ? { ...step, isCompleted: true } : step
      );

      // Steps 0-1 are tracked by viewedIntro (Home + Cohort Leaderboard)
      const introStepsComplete = updatedSteps
        .slice(0, 2)
        .every((step) => step.isCompleted);

      // Steps 2-4 are tracked by viewedChat (Practice + Message + End Chat)
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
    [effectiveProfile, completeStep] // No longer need tourState.steps dependency
  );

  // Navigation handlers with proper delays
  const handleNavigateToCohortLeaderboard = useCallback(async () => {
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

    logInfo("Navigating to cohort leaderboard", { cohortId: firstCohort.id });
    router.push(`/cohorts/c/${firstCohort.id}`);

    // Wait for navigation to complete before marking step as complete
    setTimeout(() => {
      handleStepComplete(1);
      setNavigating(false);
    }, 1500);
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

      // Use stored attemptId if available
      if (tourState.attemptId) {
        logInfo("Using stored attemptId for tour", {
          attemptId: tourState.attemptId,
        });
        router.push(`/practice/a/${tourState.attemptId}`);
        setTimeout(() => {
          handleStepComplete(2);
        }, 1000);
        return;
      }

      setLoadingSimulation(simulationId);
      const toastId = toast.loading("Starting practice simulation...");

      try {
        logInfo("Starting practice simulation for tour", { simulationId });
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
      } catch (error) {
        logError("Error starting simulation:", error);
        toast.dismiss(toastId);
        toast.error("Failed to start simulation. Please try again.");
        setLoadingSimulation(null);
      }
    },
    [
      isConnected,
      effectiveProfile?.id,
      emitStartSimulation,
      setLoadingSimulation,
      tourState.attemptId,
      router,
      handleStepComplete,
    ]
  );

  const handleNavigateToPractice = useCallback(async () => {
    setNavigating(true);
    logInfo("Navigating to practice page");

    // Navigate to practice page
    router.push("/practice");

    // Wait for navigation to complete, then auto-start simulation
    setTimeout(() => {
      setNavigating(false);
      // Auto-start first practice simulation
      if (practiceSimulations.length > 0 && practiceSimulations[0]) {
        logInfo("Auto-starting first practice simulation", {
          simulationId: practiceSimulations[0].id,
        });
        handleStartPracticeSimulation(practiceSimulations[0].id);
      } else {
        logError("No practice simulations available for tour");
        toast.error("No practice simulations available.");
      }
    }, 2000); // Longer delay to ensure page loads
  }, [
    router,
    practiceSimulations,
    setNavigating,
    handleStartPracticeSimulation,
  ]);

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

    // Only initialize if we don't already have steps for this profile
    if (
      tourState.steps.length > 0 &&
      tourState.profile?.id === effectiveProfile.id
    ) {
      logInfo("TATour: Already initialized for this profile");

      // Check if tour should be closed based on completion status
      if (
        effectiveProfile.viewedIntro &&
        effectiveProfile.viewedChat &&
        tourState.isOpen
      ) {
        logInfo("TATour: User completed tour, closing");
        closeTour();
      }
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
    tourState.steps.length, // Add this to prevent re-initialization
    tourState.profile?.id, // Add this to check if we already have the right profile
    tourState.isOpen, // Add this to check if we need to close the tour
    openTour,
    closeTour,
    handleStartPracticeSimulation,
    router, // Add router back as it's needed
  ]);

  // Handle automatic step completion based on current location
  useEffect(() => {
    if (!tourState.isOpen || !effectiveProfile) return;

    const currentStep = tourState.steps[tourState.currentStep];
    if (!currentStep || currentStep.isCompleted) return;

    logInfo("Checking auto-completion for step", {
      stepIndex: tourState.currentStep,
      pathname,
      stepId: currentStep.id,
    });

    // Step 0: Home overview - auto-complete when on home page
    if (tourState.currentStep === 0 && pathname === "/home") {
      logInfo("Auto-completing home step");
      handleStepComplete(0);
    }

    // Step 1: Cohort leaderboard - auto-complete when on cohort leaderboard page
    if (tourState.currentStep === 1 && pathname.includes("/cohorts/c/")) {
      logInfo("Auto-completing cohort leaderboard step");
      handleStepComplete(1);
    }

    // Step 2: Practice simulation - auto-complete when on simulation page
    if (tourState.currentStep === 2 && pathname.includes("/practice/a/")) {
      logInfo("Auto-completing practice simulation step");
      handleStepComplete(2);
    }

    // Steps 3-4 are handled by WebSocket events
  }, [
    tourState.currentStep,
    tourState.steps,
    pathname,
    effectiveProfile,
    tourState.isOpen,
    handleStepComplete,
  ]);

  // Set up WebSocket event listeners for tour progression
  useEffect(() => {
    const handleSimulationStarted = (event: CustomEvent) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      const { attemptId } = event.detail;
      logInfo("Simulation started for tour", { attemptId });

      // Store attemptId for persistence
      setAttemptId(attemptId);
      setLoadingSimulation(null);

      // Navigate to the simulation
      router.push(`/practice/a/${attemptId}`);

      // Mark step 2 as complete when simulation starts
      if (tourState.isOpen && tourState.currentStep === 2) {
        setTimeout(() => {
          handleStepComplete(2);
        }, 1000);
      }
    };

    const handleSimulationError = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      toast.error("Failed to start simulation. Please try again.");
      setLoadingSimulation(null);
    };

    // Listen for message sent events (step 3)
    const handleMessageSent = (_event: CustomEvent) => {
      if (tourState.isOpen && tourState.currentStep === 3) {
        logInfo("Message sent - marking tour step complete");
        handleStepComplete(3);
      }
    };

    // Listen for chat ended events (step 4) - ONLY source of truth for final step
    const handleChatEnded = (_event: CustomEvent) => {
      if (tourState.isOpen && tourState.currentStep === 4) {
        logInfo("Chat ended - marking final tour step complete");
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
    setAttemptId,
    tourState.isOpen,
    tourState.currentStep,
  ]);

  // Custom step actions mapping - handles Next button clicks
  const customStepActions = useMemo(() => {
    return {
      0: () => {
        // Step 0: Navigate to home (usually already there)
        if (pathname !== "/home") {
          router.push("/home");
        } else {
          handleStepComplete(0);
          nextStep();
        }
      },
      1: handleNavigateToCohortLeaderboard, // Navigate to cohort leaderboard
      2: handleNavigateToPractice, // Navigate to practice and start simulation
      3: () => {
        // Step 3: User needs to send a message - just advance to show instruction
        nextStep();
      },
      4: () => {
        // Step 4: User needs to end chat - just advance to show instruction
        nextStep();
      },
    };
  }, [
    pathname,
    router,
    handleStepComplete,
    nextStep,
    handleNavigateToCohortLeaderboard,
    handleNavigateToPractice,
  ]);

  // Set up global action handlers for the tour context
  useEffect(() => {
    const handleTourAction = (event: CustomEvent) => {
      const { stepIndex } = event.detail;
      logInfo("Tour action triggered", { stepIndex });

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

  // Show guide button when appropriate
  useEffect(() => {
    if (effectiveProfile?.role === "ta") {
      setShowGuideButton(true);
    } else {
      setShowGuideButton(false);
    }
  }, [effectiveProfile, setShowGuideButton]);

  // Render the guide button
  return <GuideButton />;
}
