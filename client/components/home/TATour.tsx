/**
 * TATour.tsx
 * Tour launcher component for TA users that triggers the persistent sidebar tour
 * @AshokSaravanan222 & @siladiea
 * 01/15/2025
 */
"use client";
import { logError, logInfo } from "@/utils/logger";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
import { createTATourSteps } from "@/utils/tour-steps";

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
    buttonState === "start" && (
      <div className="fixed bottom-4 right-4 z-50">
        <Button
          onClick={openGuide}
          variant={variant}
          size="sm"
          className="shadow-lg hover:shadow-xl transition-all duration-200"
        >
          {icon}
          <span className="ml-2">{text}</span>
        </Button>
      </div>
    )
  );
}

export default function TATour() {
  const router = useRouter();
  const pathname = usePathname();
  const { effectiveProfile } = useProfile();
  const { isConnected, emitStartSimulation } = useWebSocket();
  const queryClient = useQueryClient();

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

  // Get TA's assigned cohorts
  const taCohorts = useMemo(() => {
    if (!effectiveProfile || !cohorts) return [];
    return cohorts.filter((cohort) =>
      cohort.profileIds?.includes(effectiveProfile.id)
    );
  }, [effectiveProfile, cohorts]);

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

      // Step 1 is tracked by viewedIntro (Cohort Leaderboard)
      const introStepsComplete = updatedSteps[1]?.isCompleted;

      // Step 4 is tracked by viewedChat (End Chat)
      const chatStepsComplete = updatedSteps[4]?.isCompleted;

      try {
        let profileUpdated = false;

        if (introStepsComplete && !effectiveProfile.viewedIntro) {
          await updateProfile(effectiveProfile.id, { viewedIntro: true });
          logInfo("Updated profile: viewedIntro = true");
          profileUpdated = true;
        }

        if (chatStepsComplete && !effectiveProfile.viewedChat) {
          await updateProfile(effectiveProfile.id, { viewedChat: true });
          logInfo("Updated profile: viewedChat = true");
          profileUpdated = true;
        }

        // Invalidate relevant profile queries to ensure UI updates
        if (profileUpdated) {
          // Invalidate the specific profile query
          queryClient.invalidateQueries({
            queryKey: ["profile", effectiveProfile.id],
          });

          // Invalidate the simulated profile query if this is a simulated profile
          if (tourState.profile?.id === effectiveProfile.id) {
            queryClient.invalidateQueries({
              queryKey: ["simulatedProfile", effectiveProfile.id],
            });
          }

          // Invalidate all profiles query to update any lists that show this profile
          queryClient.invalidateQueries({
            queryKey: ["profiles"],
          });

          logInfo("Invalidated profile queries after update", {
            profileId: effectiveProfile.id,
            viewedIntro: introStepsComplete,
            viewedChat: chatStepsComplete,
          });
        }
      } catch (error) {
        logError("Error updating profile for tour completion:", error);
      }
    },
    [
      effectiveProfile,
      completeStep,
      tourState.steps,
      tourState.profile?.id,
      queryClient,
    ] // queryClient is stable and doesn't need to be in dependencies
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
    ]
  );

  const handleNavigateToPractice = useCallback(async () => {
    setNavigating(true);
    logInfo("Navigating to practice page");

    // Navigate to practice page
    router.push("/practice");

    // Wait for navigation to complete
    setTimeout(() => {
      setNavigating(false);
    }, 1500);
  }, [router, setNavigating]);

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
        attemptId: tourState.attemptId,
      });

      // Check if tour should be closed based on completion status
      // Note: We no longer auto-close completed tours - they show completion screen
      if (
        effectiveProfile.viewedIntro &&
        effectiveProfile.viewedChat &&
        tourState.isOpen
      ) {
        logInfo(
          "TATour: User completed tour, keeping open for completion screen",
          {
            viewedIntro: effectiveProfile.viewedIntro,
            viewedChat: effectiveProfile.viewedChat,
          }
        );
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
      logInfo("TATour: User has officially completed tour, not initializing", {
        profileId: effectiveProfile.id,
        viewedIntro: effectiveProfile.viewedIntro,
        viewedChat: effectiveProfile.viewedChat,
        attemptId: tourState.attemptId,
      });
      return;
    }

    // Create tour steps for TAs
    const steps = createTATourSteps(
      effectiveProfile,
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
      // User hasn't completed intro steps - start from beginning
      initialStep = 0;
    } else if (effectiveProfile.viewedIntro && !effectiveProfile.viewedChat) {
      // User has completed intro steps (0-1) but not chat steps (2-4)
      initialStep = 2; // Start at practice simulation step (step 2)
    } else if (effectiveProfile.viewedIntro && effectiveProfile.viewedChat) {
      // User has completed everything - show completion screen
      // Always show completion screen when both flags are true, regardless of attemptId
      initialStep = 4; // Show the final step (end chat) as completion screen
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

    // If user has completed the tour, show completion screen instead of closing
    if (effectiveProfile.viewedIntro && effectiveProfile.viewedChat) {
      logInfo("TATour: User completed tour, showing completion screen");
      // Don't close the tour - let it show the completion screen
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
          // For steps 3-4 (send-message and end-chat), check if we need to wait for attemptId
          if ((stepIndex === 3 || stepIndex === 4) && !tourState.attemptId) {
            logInfo("Skipping navigation to attempt page - no attemptId yet", {
              stepIndex,
              targetPage: step.page,
              attemptId: tourState.attemptId,
            });
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

          logInfo("Navigating to page for tour step", {
            stepIndex,
            targetPage,
            currentPath: pathname,
          });
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
    if (tourState.isOpen && tourState.attemptId && tourState.steps.length > 0) {
      const currentStep = tourState.steps[tourState.currentStep];
      logInfo("AttemptId available - checking if navigation needed", {
        attemptId: tourState.attemptId,
        currentStep: tourState.currentStep,
        currentStepPage: currentStep?.page,
        pathname,
      });

      if (
        currentStep &&
        (tourState.currentStep === 3 || tourState.currentStep === 4) &&
        currentStep.page === "/practice"
      ) {
        logInfo("AttemptId available - navigating to attempt page", {
          attemptId: tourState.attemptId,
          currentStep: tourState.currentStep,
          targetPage: `/practice/a/${tourState.attemptId}`,
        });
        router.push(`/practice/a/${tourState.attemptId}`);
      }
    }
  }, [
    tourState.attemptId,
    tourState.isOpen,
    tourState.currentStep,
    tourState.steps,
    router,
    pathname,
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
      stepPage: currentStep.page,
      attemptId: tourState.attemptId,
    });

    // Step 0: Home overview - auto-complete when on home page
    if (
      tourState.currentStep === 0 &&
      pathname === "/home" &&
      !tourState.steps[0]?.isCompleted
    ) {
      logInfo("Auto-completing home step");
      handleStepComplete(0);
      // Don't auto-advance - let user control progression
    }

    // Step 1: Cohort leaderboard - auto-complete when on cohort leaderboard page
    if (
      tourState.currentStep === 1 &&
      pathname.includes("/cohorts/c/") &&
      !tourState.steps[1]?.isCompleted
    ) {
      logInfo("Auto-completing cohort leaderboard step");
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
    const handleSimulationStarted = (event: CustomEvent) => {
      setNavigating(false); // Reset navigating state
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      const { attemptId } = event.detail;
      logInfo("Simulation started for tour", { attemptId });

      // Store attemptId for persistence
      setAttemptId(attemptId);
      setLoadingSimulation(null);

      // Complete step 2 and advance to step 3 when simulation is actually started
      if (
        tourState.isOpen &&
        tourState.currentStep === 2 &&
        !tourState.steps[2]?.isCompleted
      ) {
        logInfo(
          "Simulation started - completing step 2 and advancing to step 3"
        );
        handleStepComplete(2);
        nextStep();
      } else if (tourState.isOpen && tourState.currentStep === 2) {
        // Just reset navigating state if step is already completed
        logInfo("Simulation started - step 2 already completed");
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
    const handleSimulationButtonPressed = (event: CustomEvent) => {
      logInfo("Simulation button pressed for tour", {
        simulationId: event.detail?.simulationId,
        tourOpen: tourState.isOpen,
        currentStep: tourState.currentStep,
      });

      // Set navigating state to true when simulation button is pressed (but don't complete step yet)
      if (tourState.isOpen && tourState.currentStep === 2) {
        setNavigating(true);
        logInfo("Simulation button pressed - setting navigating to true");
      }
    };

    // Listen for message sent events (step 3) - when user sends their first message
    const handleMessageSent = (event: CustomEvent) => {
      logInfo("Message sent event received", {
        tourOpen: tourState.isOpen,
        currentStep: tourState.currentStep,
        step3Completed: tourState.steps[3]?.isCompleted,
        messageId: event.detail?.messageId,
        chatId: event.detail?.chatId,
        message: event.detail?.message,
        isTourMessage: event.detail?.isTourMessage,
        totalSteps: tourState.steps.length,
        step3Exists: !!tourState.steps[3],
      });

      // Set navigating to true when a message is sent (but don't complete step yet)
      if (tourState.isOpen && tourState.currentStep === 3) {
        setNavigating(true);
        logInfo("Message sent - setting navigating to true");
      }
    };

    // Listen for response complete events - when we receive the full response from backend
    const handleResponseComplete = (event: CustomEvent) => {
      logInfo("Response complete event received", {
        tourOpen: tourState.isOpen,
        currentStep: tourState.currentStep,
        chatId: event.detail?.chatId,
        messageId: event.detail?.messageId,
      });

      // Set navigating to false and complete step 3 when response is complete
      if (
        tourState.isOpen &&
        tourState.currentStep === 3 &&
        !tourState.steps[3]?.isCompleted
      ) {
        setNavigating(false);
        logInfo(
          "Response complete - setting navigating to false and completing step 3"
        );
        handleStepComplete(3);
        nextStep();
      } else if (tourState.isOpen && tourState.currentStep === 3) {
        // Just reset navigating state if step is already completed
        setNavigating(false);
        logInfo(
          "Response complete - setting navigating to false (step already completed)"
        );
      }
    };

    // Listen for end chat button pressed events (step 4) - when user clicks End Chat button
    const handleEndChatButtonPressed = (event: CustomEvent) => {
      logInfo("End chat button pressed event received", {
        tourOpen: tourState.isOpen,
        currentStep: tourState.currentStep,
        step4Completed: tourState.steps[4]?.isCompleted,
        chatId: event.detail?.chatId,
        attemptId: event.detail?.attemptId,
      });

      // Set navigating to true when end chat button is pressed
      if (tourState.isOpen && tourState.currentStep === 4) {
        setNavigating(true);
        logInfo("End chat button pressed - setting navigating to true");
      }
    };

    // Listen for chat ended events (step 4) - when chat is actually ended by backend
    const handleChatEnded = (event: CustomEvent) => {
      logInfo("Chat ended event received", {
        tourOpen: tourState.isOpen,
        currentStep: tourState.currentStep,
        step4Completed: tourState.steps[4]?.isCompleted,
        chatId: event.detail?.chatId,
      });

      // Set navigating to false and complete step 4 when chat is ended
      if (
        tourState.isOpen &&
        tourState.currentStep === 4 &&
        !tourState.steps[4]?.isCompleted
      ) {
        setNavigating(false);
        logInfo(
          "Chat ended - setting navigating to false and completing step 4"
        );
        handleStepComplete(4);
        nextStep();
      } else if (tourState.isOpen && tourState.currentStep === 4) {
        // Just reset navigating state if step is already completed
        setNavigating(false);
        logInfo(
          "Chat ended - setting navigating to false (step already completed)"
        );
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
    setNavigating,
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
        // Step 2: Handle practice simulation start - just click the button and let WebSocket events handle progression
        nextStep();

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
          logInfo("Using existing attemptId for tour navigation", {
            attemptId: tourState.attemptId,
          });
          router.push(`/practice/a/${tourState.attemptId}`);
        } else {
          // If no attemptId, trigger the first practice simulation card click
          setTimeout(() => {
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
                  logInfo(
                    "Clicking first practice simulation card button on step 2",
                    {
                      buttonText: startButton.textContent,
                      cardTitle: firstCard.querySelector(
                        '[data-testid="simulation-title"]'
                      )?.textContent,
                      simulationId: startButton
                        .getAttribute("data-testid")
                        ?.replace("start-simulation-", ""),
                    }
                  );
                  startButton.click();
                  // Don't auto-advance - let WebSocket events handle progression
                } else {
                  logError(
                    "Could not find start button on first practice simulation card",
                    {
                      buttonFound: !!startButton,
                      buttonText: startButton?.textContent,
                      buttonDisabled: startButton?.disabled,
                    }
                  );
                  toast.error(
                    "Could not start simulation automatically. Please click the Start button manually."
                  );
                }
              } else {
                logError("First practice simulation card is null");
                toast.error(
                  "Could not start simulation automatically. Please click the Start button manually."
                );
              }
            } else {
              logError("No practice simulation cards found");
              toast.error("No practice simulations available.");
            }
          }, 500); // Small delay to ensure page is loaded
        }
      },
      3: () => {
        // Step 3: User is now in the simulation - click the first starter prompt
        logInfo("Step 3 action triggered - clicking first starter prompt");

        // If we have an attemptId, navigate to the attempt page first
        if (tourState.attemptId) {
          router.push(`/practice/a/${tourState.attemptId}`);
        }

        // Click the first starter prompt button after a short delay to ensure page is loaded
        setTimeout(() => {
          // Look for starter prompt buttons - they are buttons with variant="outline" in the attempt messages
          const starterPromptButtons = document.querySelectorAll(
            'button[class*="outline"][class*="h-auto"][class*="p-4"]'
          );

          if (starterPromptButtons.length > 0) {
            const firstButton = starterPromptButtons[0] as HTMLButtonElement;
            if (firstButton && !firstButton.disabled) {
              logInfo("Clicking first starter prompt button", {
                buttonText: firstButton.textContent?.trim(),
              });
              firstButton.click();
            } else {
              logError("First starter prompt button is disabled or not found", {
                buttonFound: !!firstButton,
                buttonDisabled: firstButton?.disabled,
                buttonText: firstButton?.textContent,
              });
              toast.error(
                "Could not send message automatically. Please click a starter prompt manually."
              );
            }
          } else {
            logError("No starter prompt buttons found");
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
          logInfo(
            "Step 4 action triggered - tour completed, closing and navigating home"
          );
          setAttemptId(null); // Reset attemptId since tour is complete
          closeTour();
          router.push("/home");
        } else {
          // Tour not completed - click the End Session/End Chat button
          logInfo(
            "Step 4 action triggered - clicking End Session/End Chat button"
          );

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
              logInfo("Clicking End Session/End Chat button", {
                buttonText: endChatButton.textContent?.trim(),
              });
              endChatButton.click();
            } else {
              logError("End Session/End Chat button is disabled or not found", {
                buttonFound: !!endChatButton,
                buttonDisabled: endChatButton?.disabled,
                buttonText: endChatButton?.textContent,
              });
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
  ]);

  // Set up global action handlers for the tour context
  useEffect(() => {
    const handleTourAction = (event: CustomEvent) => {
      const { stepIndex } = event.detail;
      logInfo("Tour action triggered", {
        stepIndex,
        currentStep: tourState.currentStep,
        tourOpen: tourState.isOpen,
        stepsLength: tourState.steps.length,
      });

      const action =
        customStepActions[stepIndex as keyof typeof customStepActions];
      if (action) {
        logInfo("Executing tour action for step", { stepIndex });
        action();
      } else {
        logError("No action found for tour step", { stepIndex });
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

  // Render the guide button
  return (
    <>
      <GuideButton />
    </>
  );
}
