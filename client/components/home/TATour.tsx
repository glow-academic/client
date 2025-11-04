/**
 * TATour.tsx
 * Tour launcher component for TA users that triggers the persistent sidebar tour
 * @AshokSaravanan222 & @siladiea
 * 01/15/2025
 */
"use client";
import { useQueryClient } from "@tanstack/react-query";
import { HelpCircle, Play } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useProfile } from "@/contexts/profile-context";
import { useTour } from "@/contexts/tour-context";
import { useWebSocket } from "@/contexts/websocket-context";
import {
  useMarkChatComplete,
  useMarkIntroComplete,
} from "@/lib/api/v2/hooks/profile";
import { attemptsFullKeys, layoutContextKeys } from "@/lib/api/v2/keys";
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
  const {
    effectiveProfile,
    activeProfile,
    cohorts: taCohorts,
    isFullEmulation,
  } = useProfile();
  const { isConnected, emitStartSimulation, startingSimulationId } =
    useWebSocket();
  const queryClient = useQueryClient();
  const markIntroCompleteMutation = useMarkIntroComplete();
  const markChatCompleteMutation = useMarkChatComplete();

  // Debug logging removed - no client-side logging
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
          await markIntroCompleteMutation.mutateAsync({
            profileId: effectiveProfile.id,
          });
          profileUpdated = true;
        }

        if (chatStepsComplete && !effectiveProfile.viewedChat) {
          await markChatCompleteMutation.mutateAsync({
            profileId: effectiveProfile.id,
          });
          profileUpdated = true;
        }

        // Invalidate profile queries to ensure immediate UI updates
        if (profileUpdated) {
          // Invalidate layout context (includes profile data)
          queryClient.invalidateQueries({
            queryKey: layoutContextKeys.all,
          });

        }
      } catch {
        // Error handling - profile update failed silently
      }
    },
    [
      effectiveProfile,
      completeStep,
      tourState.steps,
      markIntroCompleteMutation,
      markChatCompleteMutation,
      queryClient,
    ]
  );

  // Navigation handlers with proper delays
  const handleNavigateToCohortLeaderboard = useCallback(async () => {
    if (taCohorts.length === 0) {
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

      try {

        emitStartSimulation({
          simulation_id: simulationId,
          profile_id: String(effectiveProfile.id),
        });

        // Set timeout for simulation start
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
          toast.dismiss(toastId);
        toast.dismiss(toastId);

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

    const evt1: {
      message: string;
      context: Record<string, unknown>;
    } = {
      message: "TATour effect",
      context: {
        component: "TATour",
        role: effectiveProfile?.role,
        viewedIntro: effectiveProfile?.viewedIntro,
        viewedChat: effectiveProfile?.viewedChat,
        isOpen: tourState.isOpen,
        currentStep: tourState.currentStep,
        stepsLength: tourState.steps.length,
        tourProfileId: tourState.profile?.id,
        attemptId: tourState.attemptId ?? undefined,
      },
    };

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
      const evt3: {
        message: string;
        context: Record<string, unknown>;
      } = {
        message: "User has officially completed tour, not initializing",
        context: {
          component: "TATour",
          viewedIntro: effectiveProfile.viewedIntro,
          viewedChat: effectiveProfile.viewedChat,
          attemptId: tourState.attemptId ?? undefined,
        },
      };

    // Always initialize the tour with steps (this sets up the guide button)
    openTour(steps, effectiveProfile, initialStep);

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
      const evt4: {
        message: string;
        context: Record<string, unknown>;
      } = {
        message: "User completed tour, showing completion screen",
        context: { component: "TATour" },
      };
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

      // Invalidate simulation context queries to ensure fresh data when navigating to step 3
      if (attemptId) {

        // Invalidate v2 attempts (includes chats, messages, grades, feedbacks)
        queryClient.invalidateQueries({
          queryKey: attemptsFullKeys.all,
        });

        // Invalidate v2 layout context (for updated simulations list)
        queryClient.invalidateQueries({
          queryKey: layoutContextKeys.all,
        });
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

      // Set navigating state to true when simulation button is pressed (but don't complete step yet)
      if (tourState.isOpen && tourState.currentStep === 2) {
        setNavigating(true);
      }
    };

    // Listen for message sent events (step 3) - when user sends their first message
    const handleMessageSent = (event: CustomEvent) => {

      // Set navigating to true when a message is sent (but don't complete step yet)
      if (tourState.isOpen && tourState.currentStep === 3) {
        setNavigating(true);
      }
    };

    // Listen for response complete events - when we receive the full response from backend
    const handleResponseComplete = (event: CustomEvent) => {

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
    const handleEndChatButtonPressed = (event: CustomEvent) => {

      // Set navigating to true when end chat button is pressed
      if (tourState.isOpen && tourState.currentStep === 4) {
        setNavigating(true);
      }
    };

    // Listen for chat ended events (step 4) - when chat is actually ended by backend
    const handleChatEnded = (event: CustomEvent) => {

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

      // Invalidate simulation context queries when navigating to existing simulation
      if (event.detail?.attemptId) {

        // Invalidate v2 attempts (includes chats, messages, grades, feedbacks)
        queryClient.invalidateQueries({
          queryKey: attemptsFullKeys.all,
        });

        // Invalidate v2 layout context (for updated simulations list)
        queryClient.invalidateQueries({
          queryKey: layoutContextKeys.all,
        });
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
    queryClient,
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

          // Invalidate simulation context queries to ensure fresh data

          // Invalidate v2 attempts (includes chats, messages, grades, feedbacks)
          queryClient.invalidateQueries({
            queryKey: attemptsFullKeys.all,
          });

          // Invalidate v2 layout context (for updated simulations list)
          queryClient.invalidateQueries({
            queryKey: layoutContextKeys.all,
          });

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

      const action =
        customStepActions[stepIndex as keyof typeof customStepActions];
      if (action) {
        action();
      } else {
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
