/**
 * TATour.tsx
 * Tour launcher component for TA users that triggers the persistent sidebar tour
 * @AshokSaravanan222 & @siladiea
 * 01/15/2025
 */
"use client";
import { HelpCircle, Play } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";

import type {
  MarkChatCompleteIn,
  MarkChatCompleteOut,
  MarkIntroCompleteIn,
  MarkIntroCompleteOut,
} from "@/app/(main)/layout-server";
import { Button } from "@/components/ui/button";
import { useProfile } from "@/contexts/profile-context";
import { useTour } from "@/contexts/tour-context";
import { createTATourSteps } from "@/utils/tour-steps";

// Guide Button Component
function GuideButton() {
  const { effectiveProfile, activeProfile, isFullEmulation } = useProfile();
  const { openGuide, getGuideButtonState } = useTour();

  const buttonState = getGuideButtonState();

  // Don't render if hidden or no profile
  const isEmulatingAnother = Boolean(
    effectiveProfile?.id &&
      activeProfile?.id &&
      effectiveProfile.id !== activeProfile.id
  );

  if (
    buttonState === "hidden" ||
    !effectiveProfile ||
    isEmulatingAnother ||
    isFullEmulation
  ) {
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
          icon: <Play className="h-4 w-4" />,
          text: "Resume Tour",
          variant: "default" as const,
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
    (buttonState === "start" || buttonState === "resume") && (
      <div className="fixed bottom-4 right-4 z-50">
        <Button
          onClick={openGuide}
          variant={variant}
          size="sm"
          className="shadow-lg hover:shadow-xl transition-all duration-200"
          data-testid="tour-guide-button"
          data-tour-state={buttonState}
        >
          {icon}
          <span className="ml-2">{text}</span>
        </Button>
      </div>
    )
  );
}

export interface TATourProps {
  markIntroCompleteAction: (
    input: MarkIntroCompleteIn
  ) => Promise<MarkIntroCompleteOut>;
  markChatCompleteAction: (
    input: MarkChatCompleteIn
  ) => Promise<MarkChatCompleteOut>;
}

export default function TATour({
  markIntroCompleteAction,
  markChatCompleteAction,
}: TATourProps) {
  const router = useRouter();
  const pathname = usePathname();
  const {
    effectiveProfile,
    activeProfile,
    cohorts: taCohorts,
    isFullEmulation,
    isConnected,
    emitStartSimulation,
    startingSimulationId,
  } = useProfile();

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
    setHasAssignedCohorts,
  } = useTour();

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const tourStateRef = useRef(tourState);
  const expectedPathnameRef = useRef<string | null>(null);

  // Update ref when tour state changes
  useEffect(() => {
    tourStateRef.current = tourState;
  }, [tourState]);

  // Reflect assigned cohort availability into tour context for UI gating/tooltips
  useEffect(() => {
    if (effectiveProfile?.role === "ta") {
      setHasAssignedCohorts(taCohorts.length > 0);
    } else {
      // not applicable
      setHasAssignedCohorts(null);
    }
  }, [effectiveProfile?.role, taCohorts, setHasAssignedCohorts]);

  // Handle step completion with proper profile updates
  const handleStepComplete = useCallback(
    async (stepIndex: number) => {
      if (!effectiveProfile) {
        return;
      }

      completeStep(stepIndex);

      // Get current steps from tour state ref to avoid dependency issues
      const currentSteps = tourStateRef.current.steps;

      // Update profile based on completed steps
      const updatedSteps = currentSteps.map((step, index) =>
        index === stepIndex ? { ...step, isCompleted: true } : step
      );

      // Step 1 is tracked by viewedIntro (Cohort Leaderboard)
      const introStepsComplete = updatedSteps[1]?.isCompleted;

      // Step 4 is tracked by viewedChat (End Chat)
      const chatStepsComplete = updatedSteps[4]?.isCompleted;

      try {
        let profileUpdated = false;

        if (introStepsComplete && !effectiveProfile.viewedIntro) {
          await markIntroCompleteAction({
            body: { profileId: effectiveProfile.id },
          });
          profileUpdated = true;
        }

        if (chatStepsComplete && !effectiveProfile.viewedChat) {
          await markChatCompleteAction({
            body: { profileId: effectiveProfile.id },
          });
          profileUpdated = true;
        }

        // Refresh page to get updated profile data
        if (profileUpdated) {
          router.refresh();
        }
      } catch (err) {
        toast.error("Failed to complete step. Please try again.", {
          description: (err as Error).message ?? "Unknown error",
        });
      }
    },
    [
      effectiveProfile,
      completeStep,
      markIntroCompleteAction,
      markChatCompleteAction,
      router,
    ]
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

    const targetPath = `/cohorts/c/${firstCohort.id}`;
    expectedPathnameRef.current = targetPath;

    router.push(targetPath);

    // Set a fallback timeout in case navigation fails
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      if (expectedPathnameRef.current === targetPath) {
        setNavigating(false);
        expectedPathnameRef.current = null;
      }
    }, 5000); // 5 second fallback timeout
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

      // // Use stored attemptId if available
      // if (tourState.attemptId) {
      //   router.push(`/practice/a/${tourState.attemptId}`);
      //   return;
      // }

      setLoadingSimulation(simulationId);
      const toastId = toast.loading("Starting practice simulation...", {
        dismissible: true,
      });

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
      } catch (err) {
        toast.dismiss(toastId);
        toast.error("Failed to start simulation. Please try again.", {
          description: (err as Error).message ?? "Unknown error",
        });
        setLoadingSimulation(null);
      }
    },
    [
      isConnected,
      effectiveProfile?.id,
      emitStartSimulation,
      setLoadingSimulation,
    ]
  );

  const handleNavigateToPractice = useCallback(async () => {
    setNavigating(true);
    const targetPath = "/practice";
    expectedPathnameRef.current = targetPath;

    // Navigate to practice page
    router.push(targetPath);

    // Set a fallback timeout in case navigation fails
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      if (expectedPathnameRef.current === targetPath) {
        setNavigating(false);
        expectedPathnameRef.current = null;
      }
    }, 5000); // 5 second fallback timeout
  }, [router, setNavigating]);

  // Back navigation handlers
  const handleNavigateBackToPractice = useCallback(async () => {
    setNavigating(true);
    const targetPath = "/practice";
    expectedPathnameRef.current = targetPath;

    // Navigate back to practice page
    router.push(targetPath);

    // Set a fallback timeout in case navigation fails
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      if (expectedPathnameRef.current === targetPath) {
        setNavigating(false);
        expectedPathnameRef.current = null;
      }
    }, 3000); // 3 second fallback timeout for back navigation
  }, [router, setNavigating]);

  const handleNavigateBackToHome = useCallback(async () => {
    setNavigating(true);
    const targetPath = "/home";
    expectedPathnameRef.current = targetPath;

    // Navigate back to home page
    router.push(targetPath);

    // Set a fallback timeout in case navigation fails
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      if (expectedPathnameRef.current === targetPath) {
        setNavigating(false);
        expectedPathnameRef.current = null;
      }
    }, 5000); // 5 second fallback timeout for back navigation
  }, [router, setNavigating]);

  const handleNavigateBackToCohortLeaderboard = useCallback(async () => {
    if (taCohorts.length === 0) {
      toast.error("No cohorts assigned to you yet.");
      setNavigating(false);
      return;
    }

    setNavigating(true);
    const firstCohort = taCohorts[0];
    if (!firstCohort) {
      toast.error("No cohorts assigned to you yet.");
      setNavigating(false);
      return;
    }

    const targetPath = `/cohorts/c/${firstCohort.id}`;
    expectedPathnameRef.current = targetPath;

    router.push(targetPath);

    // Set a fallback timeout in case navigation fails
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      if (expectedPathnameRef.current === targetPath) {
        setNavigating(false);
        expectedPathnameRef.current = null;
      }
    }, 5000); // 5 second fallback timeout for back navigation
  }, [taCohorts, router, setNavigating]);

  // Initialize tour steps and launch tour
  useEffect(() => {
    // Skip entirely during full emulation to prevent infinite logging
    if (isFullEmulation) {
      return;
    }

    const isEmulatingAnother = Boolean(
      effectiveProfile?.id &&
        activeProfile?.id &&
        effectiveProfile.id !== activeProfile.id
    );

    // If emulating another user (half-emulation), ensure the tour is closed and guide hidden
    if (isEmulatingAnother) {
      setShowGuideButton(false);
      closeTour();
      setAttemptId(null);
      return;
    }

    if (!effectiveProfile || effectiveProfile.role !== "ta") {
      return;
    }

    // If TA has no cohorts, don't initialize or show the tour at all
    if (taCohorts.length === 0) {
      setShowGuideButton(false);
      closeTour();
      setAttemptId(null);
      return;
    }

    // Only initialize if we don't already have steps for this profile
    if (
      tourState.steps.length > 0 &&
      tourState.profile?.id === effectiveProfile.id
    ) {
      // Check if tour should be closed based on completion status
      // Note: We no longer auto-close completed tours - they show completion screen
      if (
        effectiveProfile.viewedIntro &&
        effectiveProfile.viewedChat &&
        tourState.isOpen
      ) {
        // Don't close - let the completion screen show
      }
      return;
    }

    // Don't initialize tour if user has officially completed it (both flags true and no attemptId)
    if (
      effectiveProfile.viewedIntro &&
      effectiveProfile.viewedChat &&
      !tourState.attemptId
    ) {
      return;
    }

    // Create tour steps for TAs (we know they have at least one cohort here)
    const steps = createTATourSteps(
      {
        ...effectiveProfile,
        role: effectiveProfile.role as
          | "superadmin"
          | "admin"
          | "instructional"
          | "ta"
          | "guest",
      },
      () => router.push("/home"),
      (cohortId: string) => router.push(`/cohorts/c/${cohortId}`),
      (simulationId: string) => handleStartPracticeSimulation(simulationId),
      () => {}, // End chat is handled by WebSocket events
      taCohorts && taCohorts.length > 0 && taCohorts[0]
        ? taCohorts[0].id
        : undefined,
      tourState.attemptId || undefined
    );

    // Determine initial step based on profile completion status
    let initialStep = 0;
    if (!effectiveProfile.viewedIntro) {
      initialStep = 0;
    } else if (effectiveProfile.viewedIntro && !effectiveProfile.viewedChat) {
      initialStep = 2;
    } else if (effectiveProfile.viewedIntro && effectiveProfile.viewedChat) {
      initialStep = 4;
    }

    // Always initialize the tour with steps (this sets up the guide button)
    openTour(
      steps,
      {
        ...effectiveProfile,
        role: effectiveProfile.role as
          | "superadmin"
          | "admin"
          | "instructional"
          | "ta"
          | "guest",
      },
      initialStep
    );

    // Navigate to the correct page for the initial step
    if (initialStep >= 0 && initialStep < steps.length) {
      const targetStep = steps[initialStep];
      if (targetStep && targetStep.page && targetStep.page !== pathname) {
        const targetPage = targetStep.page;
        router.push(targetPage);
      }
    }

    // If user has completed the tour, show completion screen instead of closing
    if (effectiveProfile.viewedIntro && effectiveProfile.viewedChat) {
      // Don't close the tour - let it show the completion screen
    }
  }, [
    isFullEmulation, // Check first to prevent infinite logging
    effectiveProfile,
    activeProfile,
    tourState.steps.length, // Add this to prevent re-initialization
    tourState.profile?.id, // Add this to check if we already have the right profile
    tourState.isOpen, // Add this to check if we need to close the tour
    tourState.currentStep, // Add missing dependency
    tourState.attemptId, // Add missing dependency
    openTour,
    closeTour,
    setShowGuideButton,
    setAttemptId,
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
          // For steps 3-4 (send-message and end-chat), check if we need to wait for attemptId
          if ((stepIndex === 3 || stepIndex === 4) && !tourState.attemptId) {
            return;
          }

          // If we have an attemptId and the step page is /practice, update it to the actual attempt page
          let targetPage = step.page;
          if (
            tourState.attemptId &&
            (stepIndex === 3 || stepIndex === 4) &&
            step.page === "/practice"
          ) {
            targetPage = `/practice/a/${tourState.attemptId}`;
          }

          expectedPathnameRef.current = targetPage;
          router.push(targetPage);
        }
      }
    },
    [tourState.steps, pathname, router, tourState.attemptId]
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

  // Navigate to attempt page when attemptId becomes available
  useEffect(() => {
    if (isFullEmulation) return; // Skip during full emulation

    if (tourState.isOpen && tourState.attemptId && tourState.steps.length > 0) {
      const currentStep = tourState.steps[tourState.currentStep];

      if (
        currentStep &&
        (tourState.currentStep === 3 || tourState.currentStep === 4) &&
        currentStep.page === "/practice"
      ) {
        router.push(`/practice/a/${tourState.attemptId}`);
      }
    }
  }, [
    isFullEmulation,
    tourState.attemptId,
    tourState.isOpen,
    tourState.currentStep,
    tourState.steps,
    router,
    pathname,
  ]);

  // Monitor pathname changes to set navigating to false when we reach expected destination
  useEffect(() => {
    if (isFullEmulation) return; // Skip during full emulation

    if (
      expectedPathnameRef.current &&
      pathname === expectedPathnameRef.current
    ) {
      setNavigating(false);
      expectedPathnameRef.current = null;

      // Clear the fallback timeout since we've reached our destination
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    }
  }, [
    isFullEmulation,
    pathname,
    setNavigating,
    tourState.isNavigating,
    tourState.isOpen,
  ]);

  // Fallback mechanism: set navigating to false after a delay if it's still true
  useEffect(() => {
    if (isFullEmulation) return; // Skip during full emulation

    if (tourState.isNavigating) {
      const fallbackTimeout = setTimeout(() => {
        setNavigating(false);
        expectedPathnameRef.current = null;
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
      }, 12000); // 12 second fallback

      return () => clearTimeout(fallbackTimeout);
    }
    return undefined;
  }, [isFullEmulation, tourState.isNavigating, pathname, setNavigating]);

  // Handle automatic step completion based on current location
  useEffect(() => {
    if (isFullEmulation) return; // Skip during full emulation
    if (!tourState.isOpen || !effectiveProfile) return;

    const currentStep = tourState.steps[tourState.currentStep];
    if (!currentStep || currentStep.isCompleted) return;

    // Step 0: Home overview - auto-complete when on home page
    if (
      tourState.currentStep === 0 &&
      pathname === "/home" &&
      !tourState.steps[0]?.isCompleted
    ) {
      handleStepComplete(0);
      // Don't auto-advance - let user control progression
    }

    // Step 1: Cohort leaderboard - auto-complete when on cohort leaderboard page
    if (
      tourState.currentStep === 1 &&
      pathname.includes("/cohorts/c/") &&
      !tourState.steps[1]?.isCompleted
    ) {
      handleStepComplete(1);
      // Don't auto-advance - let user control progression
    }

    // Step 2: Practice simulation - don't auto-complete, wait for user action or next button
    // This step requires the user to click Next or manually start a simulation

    // Step 3: Send message - DON'T auto-complete, wait for actual message sent
    // This step should only complete when the user actually sends a message via WebSocket events

    // Step 4: End chat - DON'T auto-complete, wait for actual chat completion
    // This step should only complete when the user actually ends the chat via WebSocket events

    // Steps 3-4 are handled by WebSocket events
  }, [
    isFullEmulation,
    tourState.currentStep,
    tourState.steps,
    pathname,
    effectiveProfile,
    tourState.isOpen,
    handleStepComplete,
    tourState.attemptId,
  ]);

  // Set up WebSocket event listeners for tour progression
  useEffect(() => {
    if (isFullEmulation) return; // Skip during full emulation

    const handleSimulationStarted = (event: CustomEvent) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      const { attemptId } = event.detail;

      // Only store attemptId for persistence if user hasn't completed the tour
      // This prevents the tour from showing when users have already completed it
      if (!effectiveProfile?.viewedIntro || !effectiveProfile?.viewedChat) {
        setAttemptId(attemptId);
      }
      setLoadingSimulation(null);

      // Refresh data when navigating to step 3
      if (attemptId) {
        router.refresh();
      }

      // Complete step 2 and advance to step 3 when simulation is actually started
      if (
        tourState.isOpen &&
        tourState.currentStep === 2 &&
        !tourState.steps[2]?.isCompleted
      ) {
        handleStepComplete(2);
        nextStep();
        // Don't set navigating to false here - let the pathname monitoring handle it
        // when we actually reach the attempt page
      } else if (tourState.isOpen && tourState.currentStep === 3) {
        // If we're already on step 3, just reset navigating state
        setNavigating(false);
      } else if (tourState.isOpen && tourState.currentStep === 2) {
        // Just reset navigating state if step is already completed
      }

      // Let WebSocket events handle step completion - don't auto-advance here
    };

    const handleSimulationError = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      toast.error("Failed to start simulation. Please try again.");
      setLoadingSimulation(null);
    };

    // Listen for simulation button press (before server call)
    const handleSimulationButtonPressed = () => {
      // Set navigating state to true when simulation button is pressed (but don't complete step yet)
      if (tourState.isOpen && tourState.currentStep === 2) {
        setNavigating(true);
      }
    };

    // Listen for message sent events (step 3) - when user sends their first message
    const handleMessageSent = () => {
      // Set navigating to true when a message is sent (but don't complete step yet)
      if (tourState.isOpen && tourState.currentStep === 3) {
        setNavigating(true);
      }
    };

    // Listen for response complete events - when we receive the full response from backend
    const handleResponseComplete = () => {
      // Set navigating to false and complete step 3 when response is complete
      if (
        tourState.isOpen &&
        tourState.currentStep === 3 &&
        !tourState.steps[3]?.isCompleted
      ) {
        setNavigating(false);
        handleStepComplete(3);
        nextStep();
      } else if (tourState.isOpen && tourState.currentStep === 3) {
        // Just reset navigating state if step is already completed
        setNavigating(false);
      }
    };

    // Listen for end chat button pressed events (step 4) - when user clicks End Chat button
    const handleEndChatButtonPressed = () => {
      // Set navigating to true when end chat button is pressed
      if (tourState.isOpen && tourState.currentStep === 4) {
        setNavigating(true);
      }
    };

    // Listen for chat ended events (step 4) - when chat is actually ended by backend
    const handleChatEnded = () => {
      // Set navigating to false and complete step 4 when chat is ended
      if (
        tourState.isOpen &&
        tourState.currentStep === 4 &&
        !tourState.steps[4]?.isCompleted
      ) {
        setNavigating(false);
        handleStepComplete(4);
        nextStep();
      } else if (tourState.isOpen && tourState.currentStep === 4) {
        // Just reset navigating state if step is already completed
        setNavigating(false);
      }
    };

    // Listen for back navigation events
    const handleBackNavigation = (event: CustomEvent) => {
      const { fromStep, toStep } = event.detail;

      // Handle back navigation from step 3 to step 2
      if (tourState.isOpen && fromStep === 3 && toStep === 2) {
        setNavigating(true);
        // Clear attemptId when going back from step 3 to step 2
        // This allows the user to create a new simulation when they press next again
        setAttemptId(null);

        handleNavigateBackToPractice();
      }
      // Handle back navigation from step 2 to step 1
      else if (tourState.isOpen && fromStep === 2 && toStep === 1) {
        setNavigating(true);
        handleNavigateBackToCohortLeaderboard();
      }
      // Handle back navigation from step 1 to step 0
      else if (tourState.isOpen && fromStep === 1 && toStep === 0) {
        setNavigating(true);
        handleNavigateBackToHome();
      }
    };

    // Listen for existing simulation navigation events
    const handleExistingSimulationNavigation = (event: CustomEvent) => {
      // Set navigating to false when we navigate to an existing simulation
      if (tourState.isOpen && tourState.currentStep === 2) {
        setNavigating(false);
      }

      // Refresh data when navigating to existing simulation
      if (event.detail?.attemptId) {
        router.refresh();
      }
    };

    window.addEventListener(
      "simulationStarted",
      handleSimulationStarted as EventListener
    );
    window.addEventListener("simulationError", handleSimulationError);
    window.addEventListener(
      "simulationButtonPressed",
      handleSimulationButtonPressed as EventListener
    );
    window.addEventListener("messageSent", handleMessageSent as EventListener);
    window.addEventListener(
      "responseComplete",
      handleResponseComplete as EventListener
    );
    window.addEventListener(
      "endChatButtonPressed",
      handleEndChatButtonPressed as EventListener
    );
    window.addEventListener("chatEnded", handleChatEnded as EventListener);
    window.addEventListener(
      "backNavigation",
      handleBackNavigation as EventListener
    );
    window.addEventListener(
      "existingSimulationNavigation",
      handleExistingSimulationNavigation as EventListener
    );

    return () => {
      window.removeEventListener(
        "simulationStarted",
        handleSimulationStarted as EventListener
      );
      window.removeEventListener("simulationError", handleSimulationError);
      window.removeEventListener(
        "simulationButtonPressed",
        handleSimulationButtonPressed as EventListener
      );
      window.removeEventListener(
        "messageSent",
        handleMessageSent as EventListener
      );
      window.removeEventListener(
        "responseComplete",
        handleResponseComplete as EventListener
      );
      window.removeEventListener(
        "endChatButtonPressed",
        handleEndChatButtonPressed as EventListener
      );
      window.removeEventListener("chatEnded", handleChatEnded as EventListener);
      window.removeEventListener(
        "backNavigation",
        handleBackNavigation as EventListener
      );
      window.removeEventListener(
        "existingSimulationNavigation",
        handleExistingSimulationNavigation as EventListener
      );
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [
    isFullEmulation,
    router,
    handleStepComplete,
    setLoadingSimulation,
    setAttemptId,
    tourState.isOpen,
    tourState.currentStep,
    tourState.steps,
    nextStep,
    setNavigating,
    handleNavigateBackToPractice,
    handleNavigateBackToHome,
    handleNavigateBackToCohortLeaderboard,
    pathname,
    effectiveProfile?.viewedIntro,
    effectiveProfile?.viewedChat,
  ]);

  // Custom step actions mapping - handles Next button clicks
  const customStepActions = useMemo(() => {
    return {
      0: () => {
        // Step 0: Complete current step and navigate to cohort leaderboard
        handleStepComplete(0);
        handleNavigateToCohortLeaderboard();
        nextStep();
      },
      1: () => {
        // Step 1: Complete current step and navigate to practice
        handleStepComplete(1);
        handleNavigateToPractice();
        nextStep();
      },
      2: () => {
        // Step 2: Handle practice simulation start - use startingSimulationId for loading state
        // Don't call nextStep() here - let WebSocket events handle step advancement when simulation is actually started

        // Dispatch simulationButtonPressed event when Next button is clicked on step 2
        // This will set the navigating state to true
        window.dispatchEvent(
          new CustomEvent("simulationButtonPressed", {
            detail: { simulationId: "tour-step-2" },
          })
        );

        // Check if we already have an attemptId
        if (tourState.attemptId) {
          // If we have an attemptId, navigate directly to the simulation

          // Refresh data to get updated attempts and profile
          router.refresh();

          // Dispatch existingSimulationNavigation event to set navigating to false
          window.dispatchEvent(
            new CustomEvent("existingSimulationNavigation", {
              detail: { attemptId: tourState.attemptId },
            })
          );

          router.push(`/practice/a/${tourState.attemptId}`);
        } else {
          // If no attemptId, trigger the first practice simulation card click
          // Use startingSimulationId as loading state instead of timer
          const triggerSimulationStart = () => {
            // Look for practice simulation cards (permanent-simulation-card) first
            let practiceCards = document.querySelectorAll(
              '[data-testid="permanent-simulation-card"]'
            );

            // If no permanent cards found, try regular simulation cards as fallback
            if (practiceCards.length === 0) {
              practiceCards = document.querySelectorAll(
                '[data-testid="simulation-card"]'
              );
            }

            if (practiceCards.length > 0) {
              const firstCard = practiceCards[0];
              if (firstCard) {
                // Look for the start button using data-testid
                const startButton = firstCard.querySelector(
                  '[data-testid^="start-simulation-"]'
                ) as HTMLButtonElement;
                if (startButton && !startButton.disabled) {
                  startButton.click();
                  // Don't auto-advance - let WebSocket events handle progression
                } else {
                  toast.error(
                    "Could not start simulation automatically. Please click the Start button manually."
                  );
                }
              } else {
                toast.error(
                  "Could not start simulation automatically. Please click the Start button manually."
                );
              }
            } else {
              toast.error("No practice simulations available.");
            }
          };

          // If simulation is not starting, trigger immediately
          if (!startingSimulationId) {
            triggerSimulationStart();
          }
          // If simulation is starting, the effect will handle triggering when it's ready
        }
      },
      3: () => {
        // Step 3: User is now in the simulation - click the first starter prompt

        // If we have an attemptId, navigate to the attempt page first
        // if (tourState.attemptId) {
        //   const targetPath = `/practice/a/${tourState.attemptId}`;
        //   expectedPathnameRef.current = targetPath;
        //   router.push(targetPath);
        // }

        // Click the first starter prompt button after a short delay to ensure page is loaded
        setTimeout(() => {
          // Look for starter prompt buttons - they are buttons with variant="outline" in the attempt messages
          const starterPromptButtons = document.querySelectorAll(
            'button[class*="outline"][class*="h-auto"][class*="p-4"]'
          );

          if (starterPromptButtons.length > 0) {
            const firstButton = starterPromptButtons[0] as HTMLButtonElement;
            if (firstButton && !firstButton.disabled) {
              firstButton.click();
            } else {
              toast.error(
                "Could not send message automatically. Please click a starter prompt manually."
              );
            }
          } else {
            toast.error(
              "No starter prompts available. Please type a message manually."
            );
          }
        }, 1000); // Wait for page to load and messages to render
      },
      4: () => {
        // Step 4: Check if tour is completed
        if (effectiveProfile?.viewedIntro && effectiveProfile?.viewedChat) {
          // Tour is completed - close it, reset attemptId, and navigate home
          setAttemptId(null); // Reset attemptId since tour is complete
          closeTour();
          router.push("/home");
        } else {
          // Tour not completed - click the End Session/End Chat button

          // Dispatch endChatButtonPressed event when Complete button is clicked on step 4
          // This will set the navigating state to true
          window.dispatchEvent(
            new CustomEvent("endChatButtonPressed", {
              detail: {
                chatId: "tour-step-4",
                attemptId: tourState.attemptId,
              },
            })
          );

          // If we have an attemptId, navigate to the attempt page first
          if (tourState.attemptId) {
            router.push(`/practice/a/${tourState.attemptId}`);
          }

          // Click the End Session/End Chat button after a short delay to ensure page is loaded
          setTimeout(() => {
            const endChatButton = document.querySelector(
              "[data-tour-end-chat]"
            ) as HTMLButtonElement;

            if (endChatButton && !endChatButton.disabled) {
              endChatButton.click();
            } else {
              toast.error(
                "Could not end chat automatically. Please click the End Session button manually."
              );
            }
          }, 1000); // Wait for page to load
        }
      },
    };
  }, [
    handleStepComplete,
    nextStep,
    handleNavigateToCohortLeaderboard,
    handleNavigateToPractice,
    router,
    tourState.attemptId,
    closeTour,
    effectiveProfile?.viewedIntro,
    effectiveProfile?.viewedChat,
    setAttemptId,
    startingSimulationId,
  ]);

  // Set up global action handlers for the tour context
  useEffect(() => {
    if (isFullEmulation) return; // Skip during full emulation

    const handleTourAction = (event: CustomEvent) => {
      const { stepIndex } = event.detail;

      const action =
        customStepActions[stepIndex as keyof typeof customStepActions];
      if (action) {
        action();
      } else {
        toast.error("No action found for tour step");
      }
    };

    window.addEventListener("tourAction", handleTourAction as EventListener);
    return () => {
      window.removeEventListener(
        "tourAction",
        handleTourAction as EventListener
      );
    };
  }, [
    isFullEmulation,
    customStepActions,
    tourState.currentStep,
    tourState.isOpen,
    tourState.steps.length,
  ]);

  // Show guide button when appropriate
  useEffect(() => {
    if (effectiveProfile?.role === "ta") {
      // Don't show guide button if user has officially completed the tour
      if (
        effectiveProfile.viewedIntro &&
        effectiveProfile.viewedChat &&
        !tourState.attemptId
      ) {
        setShowGuideButton(false);
      } else {
        setShowGuideButton(true);
      }
    } else {
      setShowGuideButton(false);
    }
  }, [effectiveProfile, setShowGuideButton, tourState.attemptId]);

  // Don't render anything during full emulation
  if (isFullEmulation) {
    return null;
  }

  // Render the guide button
  return (
    <>
      <GuideButton />
    </>
  );
}
