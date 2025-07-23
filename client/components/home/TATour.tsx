/**
 * TATour.tsx
 * Tour launcher component for TA users that triggers the persistent sidebar tour
 * @AshokSaravanan222 & @siladiea
 * 01/15/2025
 */
"use client";
import { logError, logInfo } from "@/utils/logger";
import { useQuery } from "@tanstack/react-query";
import { Bug, CheckCircle, HelpCircle, Play } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useProfile } from "@/contexts/profile-context";
import { useTour } from "@/contexts/tour-context";
import { useWebSocket } from "@/contexts/websocket-context";
import { updateProfile } from "@/utils/mutations/profiles/update-profile";
import { getAllCohorts } from "@/utils/queries/cohorts/get-all-cohorts";
import { getAllSimulations } from "@/utils/queries/simulations/get-all-simulations";
import { createTATourSteps } from "@/utils/tour-steps";

// Debug Indicator Component
function DebugIndicator() {
  const { effectiveProfile } = useProfile();
  const { state: tourState, getGuideButtonState } = useTour();
  const [isVisible, setIsVisible] = useState(false);

  const buttonState = getGuideButtonState();

  // Toggle debug visibility with Ctrl+Shift+D
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.key === "D") {
        setIsVisible((prev) => !prev);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isVisible]);

  if (!isVisible) return null;

  const getStepStatus = (index: number) => {
    const step = tourState.steps[index];
    if (!step) return "N/A";
    return step.isCompleted ? "✅" : "⏳";
  };

  const getProfileStatus = () => {
    if (!effectiveProfile) return null;
    return {
      role: effectiveProfile.role,
      viewedIntro: effectiveProfile.viewedIntro ? "✅" : "❌",
      viewedChat: effectiveProfile.viewedChat ? "✅" : "❌",
      id: effectiveProfile.id,
    };
  };

  const profileStatus = getProfileStatus();

  return (
    <div
      className="fixed top-4 right-4 z-[9999] bg-black/90 text-white p-4 rounded-lg shadow-lg max-w-md text-xs font-mono border-2 border-yellow-400"
      style={{
        marginRight: "20px",
        zIndex: 9999,
        position: "fixed",
        top: "16px",
        right: "16px",
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-bold text-yellow-400">🐛 Tour Debug</h3>
        <button
          onClick={() => setIsVisible(false)}
          className="text-gray-400 hover:text-white"
        >
          ✕
        </button>
      </div>

      <div className="space-y-2">
        <div>
          <strong>Profile:</strong>{" "}
          {profileStatus
            ? `${profileStatus.role} (ID: ${profileStatus.id})`
            : "No Profile"}
        </div>
        <div>
          <strong>Viewed Intro:</strong> {profileStatus?.viewedIntro || "N/A"}
        </div>
        <div>
          <strong>Viewed Chat:</strong> {profileStatus?.viewedChat || "N/A"}
        </div>
        <div>
          <strong>Tour Open:</strong> {tourState.isOpen ? "✅" : "❌"}
        </div>
        <div>
          <strong>Current Step:</strong> {tourState.currentStep + 1}/
          {tourState.steps.length}
        </div>
        <div>
          <strong>Button State:</strong> {buttonState}
        </div>
        <div>
          <strong>Steps Status:</strong>
          <div className="ml-2 mt-1">
            {tourState.steps.map((step, index) => (
              <div key={index}>
                {index + 1}. {step.title}: {getStepStatus(index)}
              </div>
            ))}
          </div>
        </div>
        <div>
          <strong>Attempt ID:</strong> {tourState.attemptId || "None"}
        </div>
        <div>
          <strong>Loading:</strong> {tourState.loadingSimulation || "None"}
        </div>
        <div>
          <strong>Navigating:</strong> {tourState.isNavigating ? "✅" : "❌"}
        </div>
      </div>

      <div className="mt-3 pt-2 border-t border-gray-600 text-gray-400">
        Press{" "}
        <kbd className="px-1 py-0.5 bg-gray-700 rounded text-xs">
          Ctrl+Shift+D
        </kbd>{" "}
        to toggle
      </div>
    </div>
  );
}

// Small debug indicator that's always visible
function DebugIndicatorSmall() {
  return (
    <div
      className="fixed top-2 right-2 z-[9997] bg-yellow-400 text-black px-2 py-1 rounded text-xs font-mono border border-yellow-600 shadow-lg"
      style={{
        zIndex: 9997,
        position: "fixed",
        top: "8px",
        right: "8px",
      }}
    >
      🐛 Debug: Ctrl+Shift+D
    </div>
  );
}

// Guide Button Component
function GuideButton() {
  const { effectiveProfile } = useProfile();
  const { openGuide, getGuideButtonState } = useTour();

  const buttonState = getGuideButtonState();

  // Don't render if hidden or no profile
  if (buttonState === "hidden" || !effectiveProfile) {
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

  // Comprehensive debug logging on every render
  useEffect(() => {
    // Removed logInfo call to prevent Next.js 15 server function error
  });
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
      if (!effectiveProfile) {
        logError("handleStepComplete: No effective profile", { stepIndex });
        return;
      }

      logInfo("Completing tour step", {
        stepIndex,
        effectiveProfile: effectiveProfile.id,
        stepTitle: tourState.steps[stepIndex]?.title,
        currentViewedIntro: effectiveProfile.viewedIntro,
        currentViewedChat: effectiveProfile.viewedChat,
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
    [effectiveProfile, completeStep, tourState.steps] // Add tourState.steps dependency
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

    // Wait for navigation to complete
    setTimeout(() => {
      setNavigating(false);
    }, 1500);
  }, [taCohorts, router, setNavigating]);

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
      profileId: effectiveProfile?.id,
      viewedIntro: effectiveProfile?.viewedIntro,
      viewedChat: effectiveProfile?.viewedChat,
      currentTourState: {
        isOpen: tourState.isOpen,
        currentStep: tourState.currentStep,
        stepsLength: tourState.steps.length,
        profileId: tourState.profile?.id,
        attemptId: tourState.attemptId,
      },
    });

    if (!effectiveProfile || effectiveProfile.role !== "ta") {
      logInfo("TATour: Skipping initialization", {
        hasProfile: !!effectiveProfile,
        role: effectiveProfile?.role,
        profileId: effectiveProfile?.id,
      });
      return;
    }

    // Only initialize if we don't already have steps for this profile
    if (
      tourState.steps.length > 0 &&
      tourState.profile?.id === effectiveProfile.id
    ) {
      logInfo("TATour: Already initialized for this profile", {
        profileId: effectiveProfile.id,
        stepsLength: tourState.steps.length,
        isOpen: tourState.isOpen,
        viewedIntro: effectiveProfile.viewedIntro,
        viewedChat: effectiveProfile.viewedChat,
      });

      // Check if tour should be closed based on completion status
      if (
        effectiveProfile.viewedIntro &&
        effectiveProfile.viewedChat &&
        tourState.isOpen
      ) {
        logInfo("TATour: User completed tour, closing", {
          viewedIntro: effectiveProfile.viewedIntro,
          viewedChat: effectiveProfile.viewedChat,
        });
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
      () => {}, // End chat is handled by WebSocket events
      taCohorts && taCohorts.length > 0 ? taCohorts[0].id : undefined,
      tourState.attemptId || undefined
    );

    // Determine initial step based on profile completion status
    let initialStep = 0;
    if (effectiveProfile.viewedIntro && !effectiveProfile.viewedChat) {
      // User has completed intro steps (0-1) but not chat steps (2-4)
      initialStep = 2; // Start at practice simulation step
    } else if (effectiveProfile.viewedIntro && effectiveProfile.viewedChat) {
      // User has completed everything, but we'll still show the tour
      initialStep = 0; // Start from beginning for review
    }

    logInfo("TATour: Created steps", {
      stepsLength: steps.length,
      initialStep,
    });

    // Always initialize the tour with steps (this sets up the guide button)
    openTour(steps, effectiveProfile, initialStep);
    logInfo("TATour: Opened tour");

    // Navigate to the correct page for the initial step
    if (initialStep >= 0 && initialStep < steps.length) {
      const targetStep = steps[initialStep];
      if (targetStep && targetStep.page && targetStep.page !== pathname) {
        const targetPage = targetStep.page;
        logInfo("Navigating to correct page for tour step", {
          step: initialStep,
          targetPage,
          currentPath: pathname,
        });
        router.push(targetPage);
      }
    }

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
    tourState.currentStep, // Add missing dependency
    tourState.attemptId, // Add missing dependency
    openTour,
    closeTour,
    handleStartPracticeSimulation,
    router, // Add router back as it's needed
    taCohorts, // Add taCohorts dependency
    pathname, // Add pathname dependency
  ]);

  // Function to navigate to the correct page for the current step
  const navigateToStepPage = useCallback(
    (stepIndex: number) => {
      if (stepIndex >= 0 && stepIndex < tourState.steps.length) {
        const step = tourState.steps[stepIndex];
        if (step && step.page && step.page !== pathname) {
          logInfo("Navigating to page for tour step", {
            stepIndex,
            targetPage: step.page,
            currentPath: pathname,
          });
          router.push(step.page);
        }
      }
    },
    [tourState.steps, pathname, router]
  );

  // Navigate to correct page when tour is opened
  useEffect(() => {
    if (tourState.isOpen && tourState.steps.length > 0) {
      navigateToStepPage(tourState.currentStep);
    }
  }, [
    tourState.isOpen,
    tourState.currentStep,
    tourState.steps.length,
    navigateToStepPage,
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
    if (
      tourState.currentStep === 0 &&
      pathname === "/home" &&
      !tourState.steps[0]?.isCompleted
    ) {
      logInfo("Auto-completing home step");
      handleStepComplete(0);
      nextStep();
    }

    // Step 1: Cohort leaderboard - auto-complete when on cohort leaderboard page
    if (
      tourState.currentStep === 1 &&
      pathname.includes("/cohorts/c/") &&
      !tourState.steps[1]?.isCompleted
    ) {
      logInfo("Auto-completing cohort leaderboard step");
      handleStepComplete(1);
      nextStep();
    }

    // Step 2: Practice simulation - auto-complete when on simulation page
    if (
      tourState.currentStep === 2 &&
      pathname.includes("/practice/a/") &&
      !tourState.steps[2]?.isCompleted
    ) {
      logInfo("Auto-completing practice simulation step");
      handleStepComplete(2);
      nextStep();
    }

    // Steps 3-4 are handled by WebSocket events
  }, [
    tourState.currentStep,
    tourState.steps,
    pathname,
    effectiveProfile,
    tourState.isOpen,
    handleStepComplete,
    nextStep,
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
      if (
        tourState.isOpen &&
        tourState.currentStep === 2 &&
        !tourState.steps[2]?.isCompleted
      ) {
        setTimeout(() => {
          handleStepComplete(2);
          nextStep();
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
      if (
        tourState.isOpen &&
        tourState.currentStep === 3 &&
        !tourState.steps[3]?.isCompleted
      ) {
        logInfo("Message sent - marking tour step complete");
        handleStepComplete(3);
        nextStep();
      }
    };

    // Listen for chat ended events (step 4) - ONLY source of truth for final step
    const handleChatEnded = (_event: CustomEvent) => {
      if (
        tourState.isOpen &&
        tourState.currentStep === 4 &&
        !tourState.steps[4]?.isCompleted
      ) {
        logInfo("Chat ended - marking final tour step complete");
        handleStepComplete(4);
        nextStep();
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
    tourState.steps,
    nextStep,
  ]);

  // Custom step actions mapping - handles Next button clicks
  const customStepActions = useMemo(() => {
    return {
      0: () => {
        // Step 0: Complete current step and navigate to cohort leaderboard
        handleStepComplete(0);
        nextStep();
        handleNavigateToCohortLeaderboard();
      },
      1: () => {
        // Step 1: Complete current step and navigate to practice
        handleStepComplete(1);
        nextStep();
        handleNavigateToPractice();
      },
      2: () => {
        // Step 2: Complete current step and advance (simulation should already be started)
        handleStepComplete(2);
        nextStep();
      },
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
  return (
    <>
      <GuideButton />
      <DebugIndicator />
      <DebugIndicatorSmall />
      {/* Always visible debug button for development */}
      {process.env.NODE_ENV === "development" && (
        <div className="fixed top-4 left-4 z-[9998]">
          <Button
            onClick={() => {
              logInfo("Manual debug trigger", {
                profile: effectiveProfile,
                tourState: {
                  isOpen: tourState.isOpen,
                  currentStep: tourState.currentStep,
                  stepsLength: tourState.steps.length,
                  profileId: tourState.profile?.id,
                  viewedIntro: effectiveProfile?.viewedIntro,
                  viewedChat: effectiveProfile?.viewedChat,
                },
              });
            }}
            variant="outline"
            size="sm"
            className="bg-yellow-100 text-yellow-800 border-yellow-300 hover:bg-yellow-200 shadow-lg"
          >
            <Bug className="h-4 w-4 mr-1" />
            Debug
          </Button>
        </div>
      )}
    </>
  );
}
