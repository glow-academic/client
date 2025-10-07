/**
 * TATour.tsx
 * Tour launcher component for TA users that triggers the persistent sidebar tour
 * @AshokSaravanan222 & @siladiea
 * 01/15/2025
 */
"use client";
import { log } from "@/utils/logger";
import { useQueryClient } from "@tanstack/react-query";
import { HelpCircle, Play } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useDepartments } from "@/contexts/departments-context";
import { useProfile } from "@/contexts/profile-context";
import { useTour } from "@/contexts/tour-context";
import { useWebSocket } from "@/contexts/websocket-context";
import { useCohortsByDepartmentIdBatch } from "@/lib/api/hooks/cohorts";
import { useUpdateProfile } from "@/lib/api/hooks/profiles";
import {
  profileKeys,
  simulationAttemptKeys,
  simulationChatFeedbackKeys,
  simulationChatGradeKeys,
  simulationChatKeysByAttemptId,
  simulationMessageKeys,
} from "@/lib/api/keys";
import { createTATourSteps } from "@/utils/tour-steps";

// Guide Button Component
function GuideButton() {
  const { effectiveProfile, activeProfile } = useProfile();
  const { openGuide, getGuideButtonState } = useTour();

  const buttonState = getGuideButtonState();

  // Don't render if hidden or no profile
  const isEmulatingAnother = Boolean(
    effectiveProfile?.id &&
      activeProfile?.id &&
      effectiveProfile.id !== activeProfile.id,
  );

  if (buttonState === "hidden" || !effectiveProfile || isEmulatingAnother) {
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
  const { effectiveProfile, activeProfile } = useProfile();
  const { selectedDepartmentIds } = useDepartments();
  const { isConnected, emitStartSimulation, startingSimulationId } =
    useWebSocket();
  const queryClient = useQueryClient();
  const updateProfileMutation = useUpdateProfile();

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
    setHasAssignedCohorts,
  } = useTour();

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const tourStateRef = useRef(tourState);
  const expectedPathnameRef = useRef<string | null>(null);

  // Update ref when tour state changes
  useEffect(() => {
    tourStateRef.current = tourState;
  }, [tourState]);

  const { data: cohorts = [] } = useCohortsByDepartmentIdBatch(
    selectedDepartmentIds,
  );

  // Get TA's assigned cohorts
  const taCohorts = useMemo(() => {
    if (!effectiveProfile || !cohorts) return [];
    return cohorts.filter((cohort) =>
      cohort.profileIds?.includes(effectiveProfile.id),
    );
  }, [effectiveProfile, cohorts]);

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
        log.error("tour.step.complete.failed", {
          message: "No effective profile",
          context: {
            component: "TATour",
            function: "handleStepComplete",
            stepIndex,
          },
        });
        return;
      }

      log.info("tour.step.complete", {
        message: "Completing tour step",
        actor: { profileId: effectiveProfile.id },
        subject: { entityType: "tour", entityId: "ta" },
        context: {
          component: "TATour",
          function: "handleStepComplete",
          stepIndex,
          stepTitle: tourState.steps[stepIndex]?.title,
          currentViewedIntro: effectiveProfile.viewedIntro,
          currentViewedChat: effectiveProfile.viewedChat,
        },
      });
      completeStep(stepIndex);

      // Get current steps from tour state ref to avoid dependency issues
      const currentSteps = tourStateRef.current.steps;

      // Update profile based on completed steps
      const updatedSteps = currentSteps.map((step, index) =>
        index === stepIndex ? { ...step, isCompleted: true } : step,
      );

      // Step 1 is tracked by viewedIntro (Cohort Leaderboard)
      const introStepsComplete = updatedSteps[1]?.isCompleted;

      // Step 4 is tracked by viewedChat (End Chat)
      const chatStepsComplete = updatedSteps[4]?.isCompleted;

      try {
        let profileUpdated = false;

        if (introStepsComplete && !effectiveProfile.viewedIntro) {
          await updateProfileMutation.mutateAsync({
            id: effectiveProfile.id,
            viewedIntro: true,
          });
          log.info("tour.profile.flag.updated", {
            message: "Updated profile viewedIntro",
            actor: { profileId: effectiveProfile.id },
            subject: { entityType: "profile", entityId: effectiveProfile.id },
            context: {
              component: "TATour",
              function: "handleStepComplete",
              flag: "viewedIntro",
              value: true,
            },
          });
          profileUpdated = true;
        }

        if (chatStepsComplete && !effectiveProfile.viewedChat) {
          await updateProfileMutation.mutateAsync({
            id: effectiveProfile.id,
            viewedChat: true,
          });
          log.info("tour.profile.flag.updated", {
            message: "Updated profile viewedChat",
            actor: { profileId: effectiveProfile.id },
            subject: { entityType: "profile", entityId: effectiveProfile.id },
            context: {
              component: "TATour",
              function: "handleStepComplete",
              flag: "viewedChat",
              value: true,
            },
          });
          profileUpdated = true;
        }

        // Invalidate profile queries to ensure immediate UI updates
        if (profileUpdated) {
          // Invalidate the specific profile query
          queryClient.invalidateQueries({
            queryKey: profileKeys.detail(effectiveProfile.id),
          });

          // Invalidate all profiles query to update any lists that show this profile
          queryClient.invalidateQueries({
            queryKey: profileKeys.all,
          });

          log.debug("tour.profile.invalidate_queries", {
            message: "Invalidated profile queries after update",
            actor: { profileId: effectiveProfile.id },
            context: {
              component: "TATour",
              function: "handleStepComplete",
              viewedIntro: introStepsComplete,
              viewedChat: chatStepsComplete,
            },
          });
        }
      } catch (error) {
        log.error("tour.profile.update.failed", {
          message: "Error updating profile for tour completion",
          error,
          actor: { profileId: effectiveProfile.id },
          context: {
            component: "TATour",
            function: "handleStepComplete",
            stepIndex,
          },
        });
      }
    },
    [
      effectiveProfile,
      completeStep,
      tourState.steps,
      updateProfileMutation,
      queryClient,
    ],
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

    log.debug("tour.navigate.start", {
      message: "Navigating to cohort leaderboard",
      subject: { entityType: "cohort", entityId: firstCohort.id },
      context: {
        component: "TATour",
        function: "handleNavigateToCohortLeaderboard",
        targetPath,
      },
    });
    router.push(targetPath);

    // Set a fallback timeout in case navigation fails
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      if (expectedPathnameRef.current === targetPath) {
        log.debug("tour.navigate.timeout", {
          message: "Navigation timeout",
          context: {
            component: "TATour",
            function: "handleNavigateToCohortLeaderboard",
            targetPath,
          },
        });
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
      //   log.info("tour.simulation.use_stored_attempt", {
      //     message: "Using stored attemptId for tour",
      //     context: { component: "TATour", attemptId: tourState.attemptId },
      //   });
      //   router.push(`/practice/a/${tourState.attemptId}`);
      //   return;
      // }

      setLoadingSimulation(simulationId);
      const toastId = toast.loading("Starting practice simulation...", {
        dismissible: true,
      });

      try {
        log.info("tour.simulation.start", {
          message: "Starting practice simulation for tour",
          subject: { entityType: "simulation", entityId: simulationId },
          context: {
            component: "TATour",
            function: "handleStartPracticeSimulation",
          },
        });
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
        log.error("tour.simulation.start.failed", {
          message: "Error starting simulation",
          error,
          subject: { entityType: "simulation", entityId: simulationId },
          context: {
            component: "TATour",
            function: "handleStartPracticeSimulation",
          },
        });
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
    ],
  );

  const handleNavigateToPractice = useCallback(async () => {
    setNavigating(true);
    const targetPath = "/practice";
    expectedPathnameRef.current = targetPath;

    log.debug("tour.navigate.start", {
      message: "Navigating to practice page",
      context: {
        component: "TATour",
        function: "handleNavigateToPractice",
        targetPath,
      },
    });

    // Navigate to practice page
    router.push(targetPath);

    // Set a fallback timeout in case navigation fails
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      if (expectedPathnameRef.current === targetPath) {
        log.debug("tour.navigate.timeout", {
          message: "Navigation timeout",
          context: {
            component: "TATour",
            function: "handleNavigateToPractice",
            targetPath,
          },
        });
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

    log.debug("tour.navigate.back", {
      message: "Navigating back to practice page",
      context: {
        component: "TATour",
        function: "handleNavigateBackToPractice",
        targetPath,
      },
    });

    // Navigate back to practice page
    router.push(targetPath);

    // Set a fallback timeout in case navigation fails
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      if (expectedPathnameRef.current === targetPath) {
        log.debug("tour.navigate.timeout", {
          message: "Back navigation timeout",
          context: {
            component: "TATour",
            function: "handleNavigateBackToPractice",
            targetPath,
          },
        });
        setNavigating(false);
        expectedPathnameRef.current = null;
      }
    }, 3000); // 3 second fallback timeout for back navigation
  }, [router, setNavigating]);

  const handleNavigateBackToHome = useCallback(async () => {
    setNavigating(true);
    const targetPath = "/home";
    expectedPathnameRef.current = targetPath;

    log.debug("tour.navigate.back", {
      message: "Navigating back to home page",
      context: {
        component: "TATour",
        function: "handleNavigateBackToHome",
        targetPath,
      },
    });

    // Navigate back to home page
    router.push(targetPath);

    // Set a fallback timeout in case navigation fails
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      if (expectedPathnameRef.current === targetPath) {
        log.debug("tour.navigate.timeout", {
          message: "Back navigation timeout",
          context: {
            component: "TATour",
            function: "handleNavigateBackToHome",
            targetPath,
          },
        });
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

    log.debug("tour.navigate.back", {
      message: "Navigating back to cohort leaderboard",
      subject: { entityType: "cohort", entityId: firstCohort.id },
      context: {
        component: "TATour",
        function: "handleNavigateBackToCohortLeaderboard",
        targetPath,
      },
    });
    router.push(targetPath);

    // Set a fallback timeout in case navigation fails
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      if (expectedPathnameRef.current === targetPath) {
        log.debug("tour.navigate.timeout", {
          message: "Back navigation timeout",
          context: {
            component: "TATour",
            function: "handleNavigateBackToCohortLeaderboard",
            targetPath,
          },
        });
        setNavigating(false);
        expectedPathnameRef.current = null;
      }
    }, 5000); // 5 second fallback timeout for back navigation
  }, [taCohorts, router, setNavigating]);

  // Initialize tour steps and launch tour
  useEffect(() => {
    const evt1: {
      message: string;
      actor?: { profileId: string };
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
    if (effectiveProfile?.id) evt1.actor = { profileId: effectiveProfile.id };
    log.debug("tour.effect", evt1);

    const isEmulatingAnother = Boolean(
      effectiveProfile?.id &&
        activeProfile?.id &&
        effectiveProfile.id !== activeProfile.id,
    );

    // If emulating another user, ensure the tour is closed and guide hidden
    if (isEmulatingAnother) {
      setShowGuideButton(false);
      closeTour();
      setAttemptId(null);
      return;
    }

    if (!effectiveProfile || effectiveProfile.role !== "ta") {
      const evt2: {
        message: string;
        actor?: { profileId: string };
        context: Record<string, unknown>;
      } = {
        message: "Skipping initialization",
        context: { component: "TATour", role: effectiveProfile?.role },
      };
      if (effectiveProfile?.id) evt2.actor = { profileId: effectiveProfile.id };
      log.debug("tour.init.skip", evt2);
      return;
    }

    // If TA has no cohorts, don't initialize or show the tour at all
    if (taCohorts.length === 0) {
      log.info("tour.init.no_cohorts", {
        message: "TA has no cohorts; not initializing or showing tour",
        actor: { profileId: effectiveProfile?.id },
      });
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
      log.debug("tour.init.already_initialized", {
        message: "Already initialized for this profile",
        actor: { profileId: effectiveProfile.id },
        context: {
          component: "TATour",
          stepsLength: tourState.steps.length,
          isOpen: tourState.isOpen,
          viewedIntro: effectiveProfile.viewedIntro,
          viewedChat: effectiveProfile.viewedChat,
          attemptId: tourState.attemptId ?? undefined,
        },
      });

      // Check if tour should be closed based on completion status
      // Note: We no longer auto-close completed tours - they show completion screen
      if (
        effectiveProfile.viewedIntro &&
        effectiveProfile.viewedChat &&
        tourState.isOpen
      ) {
        log.info("tour.completed", {
          message: "User completed tour, keeping open for completion screen",
          actor: { profileId: effectiveProfile.id },
          context: { component: "TATour" },
        });
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
        actor?: { profileId: string };
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
      if (effectiveProfile.id) evt3.actor = { profileId: effectiveProfile.id };
      log.info("tour.completed", evt3);
      return;
    }

    // Create tour steps for TAs (we know they have at least one cohort here)
    const steps = createTATourSteps(
      effectiveProfile,
      () => router.push("/home"),
      (cohortId: string) => router.push(`/cohorts/c/${cohortId}`),
      (simulationId: string) => handleStartPracticeSimulation(simulationId),
      () => {}, // End chat is handled by WebSocket events
      taCohorts && taCohorts.length > 0 && taCohorts[0]
        ? taCohorts[0].id
        : undefined,
      tourState.attemptId || undefined,
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

    log.debug("tour.steps.created", {
      message: "Created steps",
      context: { component: "TATour", stepsLength: steps.length, initialStep },
    });

    // Always initialize the tour with steps (this sets up the guide button)
    openTour(steps, effectiveProfile, initialStep);
    log.info("tour.opened", {
      actor: { profileId: effectiveProfile.id },
      context: { component: "TATour" },
    });

    // Navigate to the correct page for the initial step
    if (initialStep >= 0 && initialStep < steps.length) {
      const targetStep = steps[initialStep];
      if (targetStep && targetStep.page && targetStep.page !== pathname) {
        const targetPage = targetStep.page;
        log.debug("tour.navigate.start", {
          message: "Navigating to correct page for tour step",
          context: {
            component: "TATour",
            stepIndex: initialStep,
            targetPage,
            currentPath: pathname,
          },
        });
        router.push(targetPage);
      }
    }

    // If user has completed the tour, show completion screen instead of closing
    if (effectiveProfile.viewedIntro && effectiveProfile.viewedChat) {
      const evt4: {
        message: string;
        actor?: { profileId: string };
        context: Record<string, unknown>;
      } = {
        message: "User completed tour, showing completion screen",
        context: { component: "TATour" },
      };
      if (effectiveProfile.id) evt4.actor = { profileId: effectiveProfile.id };
      log.info("tour.completed", evt4);
      // Don't close the tour - let it show the completion screen
    }
  }, [
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
            log.info("tour.navigate.skip_no_attempt", {
              message: "Skipping navigation to attempt page - no attemptId yet",
              context: {
                component: "TATour",
                stepIndex,
                targetPage: step.page,
                attemptId: tourState.attemptId,
              },
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

          log.debug("tour.navigate.to_step", {
            message: "Navigating to page for tour step",
            context: {
              component: "TATour",
              stepIndex,
              targetPage,
              currentPath: pathname,
            },
          });
          expectedPathnameRef.current = targetPage;
          router.push(targetPage);
        }
      }
    },
    [tourState.steps, pathname, router, tourState.attemptId],
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
      log.debug("tour.attempt.available", {
        message: "AttemptId available",
        context: {
          component: "TATour",
          attemptId: tourState.attemptId,
          currentStep: tourState.currentStep,
          currentStepPage: currentStep?.page,
          pathname,
        },
      });

      if (
        currentStep &&
        (tourState.currentStep === 3 || tourState.currentStep === 4) &&
        currentStep.page === "/practice"
      ) {
        log.debug("tour.navigate.start", {
          message: "Navigating to attempt page",
          context: {
            component: "TATour",
            attemptId: tourState.attemptId,
            currentStep: tourState.currentStep,
            targetPage: `/practice/a/${tourState.attemptId}`,
          },
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

  // Monitor pathname changes to set navigating to false when we reach expected destination
  useEffect(() => {
    log.debug("tour.path.monitor", {
      message: "Pathname monitoring",
      context: {
        component: "TATour",
        expectedPath: expectedPathnameRef.current ?? undefined,
        currentPath: pathname,
        isNavigating: tourState.isNavigating,
        tourOpen: tourState.isOpen,
      },
    });

    if (
      expectedPathnameRef.current &&
      pathname === expectedPathnameRef.current
    ) {
      log.debug("tour.navigate.reached", {
        message: "Reached expected destination",
        context: {
          component: "TATour",
          expectedPath: expectedPathnameRef.current ?? undefined,
          currentPath: pathname,
        },
      });
      setNavigating(false);
      expectedPathnameRef.current = null;

      // Clear the fallback timeout since we've reached our destination
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    }
  }, [pathname, setNavigating, tourState.isNavigating, tourState.isOpen]);

  // Fallback mechanism: set navigating to false after a delay if it's still true
  useEffect(() => {
    if (tourState.isNavigating) {
      const fallbackTimeout = setTimeout(() => {
        log.debug("tour.navigate.timeout", {
          message: "Fallback timeout setting navigating false",
          context: {
            component: "TATour",
            currentPath: pathname,
            expectedPath: expectedPathnameRef.current ?? undefined,
          },
        });
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
  }, [tourState.isNavigating, pathname, setNavigating]);

  // Handle automatic step completion based on current location
  useEffect(() => {
    if (!tourState.isOpen || !effectiveProfile) return;

    const currentStep = tourState.steps[tourState.currentStep];
    if (!currentStep || currentStep.isCompleted) return;

    log.debug("tour.step.check_auto_complete", {
      message: "Checking auto-completion for step",
      context: {
        component: "TATour",
        stepIndex: tourState.currentStep,
        pathname,
        stepId: currentStep.id,
        stepPage: currentStep.page,
        attemptId: tourState.attemptId ?? undefined,
      },
    });

    // Step 0: Home overview - auto-complete when on home page
    if (
      tourState.currentStep === 0 &&
      pathname === "/home" &&
      !tourState.steps[0]?.isCompleted
    ) {
      log.info("tour.step.auto_complete", {
        message: "Auto-completing home step",
        context: { component: "TATour", function: "autoComplete", step: 0 },
      });
      handleStepComplete(0);
      // Don't auto-advance - let user control progression
    }

    // Step 1: Cohort leaderboard - auto-complete when on cohort leaderboard page
    if (
      tourState.currentStep === 1 &&
      pathname.includes("/cohorts/c/") &&
      !tourState.steps[1]?.isCompleted
    ) {
      log.info("tour.step.auto_complete", {
        message: "Auto-completing cohort leaderboard step",
        context: { component: "TATour", function: "autoComplete", step: 1 },
      });
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
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      const { attemptId } = event.detail;
      log.info("tour.simulation.started", {
        message: "Simulation started for tour",
        context: { component: "TATour", attemptId },
      });

      // Only store attemptId for persistence if user hasn't completed the tour
      // This prevents the tour from showing when users have already completed it
      if (!effectiveProfile?.viewedIntro || !effectiveProfile?.viewedChat) {
        setAttemptId(attemptId);
      }
      setLoadingSimulation(null);

      // Invalidate simulation context queries to ensure fresh data when navigating to step 3
      if (attemptId) {
        log.debug("tour.simulation.invalidate_queries", {
          message: "Invalidating simulation context queries for new attempt",
          context: { component: "TATour", attemptId },
        });

        // Invalidate attempt-specific queries
        queryClient.invalidateQueries({
          queryKey: simulationAttemptKeys.detail(attemptId),
        });
        queryClient.invalidateQueries({
          queryKey: simulationChatKeysByAttemptId.one(attemptId),
        });

        // Invalidate related simulation data queries
        queryClient.invalidateQueries({
          queryKey: simulationChatGradeKeys.all,
        });
        queryClient.invalidateQueries({
          queryKey: simulationChatFeedbackKeys.all,
        });
        queryClient.invalidateQueries({
          queryKey: simulationMessageKeys.all,
        });
      }

      // Complete step 2 and advance to step 3 when simulation is actually started
      if (
        tourState.isOpen &&
        tourState.currentStep === 2 &&
        !tourState.steps[2]?.isCompleted
      ) {
        log.info("tour.step.advance", {
          message:
            "Simulation started - completing step 2 and advancing to step 3",
          context: { component: "TATour" },
        });
        handleStepComplete(2);
        nextStep();
        // Don't set navigating to false here - let the pathname monitoring handle it
        // when we actually reach the attempt page
      } else if (tourState.isOpen && tourState.currentStep === 3) {
        // If we're already on step 3, just reset navigating state
        log.debug("tour.step.already_advanced", {
          message:
            "Simulation started - already on step 3, just resetting navigation",
          context: { component: "TATour" },
        });
        setNavigating(false);
      } else if (tourState.isOpen && tourState.currentStep === 2) {
        // Just reset navigating state if step is already completed
        log.debug("tour.step.already_completed", {
          message: "Simulation started - step 2 already completed",
          context: { component: "TATour" },
        });
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
      log.debug("tour.simulation.button_pressed", {
        context: {
          component: "TATour",
          simulationId: event.detail?.simulationId,
          tourOpen: tourState.isOpen,
          currentStep: tourState.currentStep,
        },
      });

      // Set navigating state to true when simulation button is pressed (but don't complete step yet)
      if (tourState.isOpen && tourState.currentStep === 2) {
        setNavigating(true);
        log.debug("tour.navigate.set_navigating", {
          message: "Simulation button pressed - navigating true",
          context: { component: "TATour" },
        });
      }
    };

    // Listen for message sent events (step 3) - when user sends their first message
    const handleMessageSent = (event: CustomEvent) => {
      log.debug("tour.message.sent_event", {
        context: {
          component: "TATour",
          tourOpen: tourState.isOpen,
          currentStep: tourState.currentStep,
          step3Completed: tourState.steps[3]?.isCompleted,
          messageId: event.detail?.messageId,
          chatId: event.detail?.chatId,
          message: event.detail?.message,
          isTourMessage: event.detail?.isTourMessage,
          totalSteps: tourState.steps.length,
          step3Exists: !!tourState.steps[3],
        },
      });

      // Set navigating to true when a message is sent (but don't complete step yet)
      if (tourState.isOpen && tourState.currentStep === 3) {
        setNavigating(true);
        log.debug("tour.navigate.set_navigating", {
          message: "Message sent - navigating true",
          context: { component: "TATour" },
        });
      }
    };

    // Listen for response complete events - when we receive the full response from backend
    const handleResponseComplete = (event: CustomEvent) => {
      log.debug("tour.response.complete_event", {
        context: {
          component: "TATour",
          tourOpen: tourState.isOpen,
          currentStep: tourState.currentStep,
          chatId: event.detail?.chatId,
          messageId: event.detail?.messageId,
        },
      });

      // Set navigating to false and complete step 3 when response is complete
      if (
        tourState.isOpen &&
        tourState.currentStep === 3 &&
        !tourState.steps[3]?.isCompleted
      ) {
        setNavigating(false);
        log.info("tour.step.advance", {
          message: "Response complete - navigating false and completing step 3",
          context: { component: "TATour" },
        });
        handleStepComplete(3);
        nextStep();
      } else if (tourState.isOpen && tourState.currentStep === 3) {
        // Just reset navigating state if step is already completed
        setNavigating(false);
        log.debug("tour.navigate.set_navigating", {
          message:
            "Response complete - navigating false (step already completed)",
          context: { component: "TATour" },
        });
      }
    };

    // Listen for end chat button pressed events (step 4) - when user clicks End Chat button
    const handleEndChatButtonPressed = (event: CustomEvent) => {
      log.debug("tour.chat.end_button_event", {
        context: {
          component: "TATour",
          tourOpen: tourState.isOpen,
          currentStep: tourState.currentStep,
          step4Completed: tourState.steps[4]?.isCompleted,
          chatId: event.detail?.chatId,
          attemptId: event.detail?.attemptId,
        },
      });

      // Set navigating to true when end chat button is pressed
      if (tourState.isOpen && tourState.currentStep === 4) {
        setNavigating(true);
        log.debug("tour.navigate.set_navigating", {
          message: "End chat button pressed - navigating true",
          context: { component: "TATour" },
        });
      }
    };

    // Listen for chat ended events (step 4) - when chat is actually ended by backend
    const handleChatEnded = (event: CustomEvent) => {
      log.debug("tour.chat.ended_event", {
        context: {
          component: "TATour",
          tourOpen: tourState.isOpen,
          currentStep: tourState.currentStep,
          step4Completed: tourState.steps[4]?.isCompleted,
          chatId: event.detail?.chatId,
        },
      });

      // Set navigating to false and complete step 4 when chat is ended
      if (
        tourState.isOpen &&
        tourState.currentStep === 4 &&
        !tourState.steps[4]?.isCompleted
      ) {
        setNavigating(false);
        log.info("tour.step.advance", {
          message: "Chat ended - navigating false and completing step 4",
          context: { component: "TATour" },
        });
        handleStepComplete(4);
        nextStep();
      } else if (tourState.isOpen && tourState.currentStep === 4) {
        // Just reset navigating state if step is already completed
        setNavigating(false);
        log.debug("tour.navigate.set_navigating", {
          message: "Chat ended - navigating false (step already completed)",
          context: { component: "TATour" },
        });
      }
    };

    // Listen for back navigation events
    const handleBackNavigation = (event: CustomEvent) => {
      const { fromStep, toStep } = event.detail;
      log.debug("tour.navigate.back_event", {
        context: {
          component: "TATour",
          tourOpen: tourState.isOpen,
          fromStep,
          toStep,
          currentStep: tourState.currentStep,
          currentPathname: pathname,
        },
      });

      // Handle back navigation from step 3 to step 2
      if (tourState.isOpen && fromStep === 3 && toStep === 2) {
        setNavigating(true);
        log.debug("tour.navigate.set_navigating", {
          message: "Back navigation from step 3 to step 2 - navigating true",
          context: { component: "TATour" },
        });
        // Clear attemptId when going back from step 3 to step 2
        // This allows the user to create a new simulation when they press next again
        setAttemptId(null);
        log.debug("tour.attempt.cleared", {
          message: "Cleared attemptId for new simulation",
          context: { component: "TATour" },
        });

        handleNavigateBackToPractice();
      }
      // Handle back navigation from step 2 to step 1
      else if (tourState.isOpen && fromStep === 2 && toStep === 1) {
        setNavigating(true);
        log.debug("tour.navigate.set_navigating", {
          message: "Back navigation from step 2 to step 1 - navigating true",
          context: { component: "TATour" },
        });
        handleNavigateBackToCohortLeaderboard();
      }
      // Handle back navigation from step 1 to step 0
      else if (tourState.isOpen && fromStep === 1 && toStep === 0) {
        setNavigating(true);
        log.debug("tour.navigate.set_navigating", {
          message: "Back navigation from step 1 to step 0 - navigating true",
          context: { component: "TATour" },
        });
        handleNavigateBackToHome();
      }
    };

    // Listen for existing simulation navigation events
    const handleExistingSimulationNavigation = (event: CustomEvent) => {
      log.debug("tour.navigate.existing_simulation_event", {
        context: {
          component: "TATour",
          tourOpen: tourState.isOpen,
          currentStep: tourState.currentStep,
          attemptId: event.detail?.attemptId,
        },
      });

      // Set navigating to false when we navigate to an existing simulation
      if (tourState.isOpen && tourState.currentStep === 2) {
        setNavigating(false);
        log.debug("tour.navigate.set_navigating", {
          message: "Existing simulation navigation - navigating false",
          context: { component: "TATour" },
        });
      }

      // Invalidate simulation context queries when navigating to existing simulation
      if (event.detail?.attemptId) {
        log.debug("tour.simulation.invalidate_existing_navigation", {
          message:
            "Invalidating simulation context queries for existing simulation navigation",
          context: { component: "TATour", attemptId: event.detail.attemptId },
        });

        // Invalidate attempt-specific queries
        queryClient.invalidateQueries({
          queryKey: simulationAttemptKeys.detail(event.detail.attemptId),
        });
        queryClient.invalidateQueries({
          queryKey: simulationChatKeysByAttemptId.one(event.detail.attemptId),
        });

        // Invalidate related simulation data queries
        queryClient.invalidateQueries({
          queryKey: simulationChatGradeKeys.all,
        });
        queryClient.invalidateQueries({
          queryKey: simulationChatFeedbackKeys.all,
        });
        queryClient.invalidateQueries({
          queryKey: simulationMessageKeys.all,
        });
      }
    };

    window.addEventListener(
      "simulationStarted",
      handleSimulationStarted as EventListener,
    );
    window.addEventListener("simulationError", handleSimulationError);
    window.addEventListener(
      "simulationButtonPressed",
      handleSimulationButtonPressed as EventListener,
    );
    window.addEventListener("messageSent", handleMessageSent as EventListener);
    window.addEventListener(
      "responseComplete",
      handleResponseComplete as EventListener,
    );
    window.addEventListener(
      "endChatButtonPressed",
      handleEndChatButtonPressed as EventListener,
    );
    window.addEventListener("chatEnded", handleChatEnded as EventListener);
    window.addEventListener(
      "backNavigation",
      handleBackNavigation as EventListener,
    );
    window.addEventListener(
      "existingSimulationNavigation",
      handleExistingSimulationNavigation as EventListener,
    );

    return () => {
      window.removeEventListener(
        "simulationStarted",
        handleSimulationStarted as EventListener,
      );
      window.removeEventListener("simulationError", handleSimulationError);
      window.removeEventListener(
        "simulationButtonPressed",
        handleSimulationButtonPressed as EventListener,
      );
      window.removeEventListener(
        "messageSent",
        handleMessageSent as EventListener,
      );
      window.removeEventListener(
        "responseComplete",
        handleResponseComplete as EventListener,
      );
      window.removeEventListener(
        "endChatButtonPressed",
        handleEndChatButtonPressed as EventListener,
      );
      window.removeEventListener("chatEnded", handleChatEnded as EventListener);
      window.removeEventListener(
        "backNavigation",
        handleBackNavigation as EventListener,
      );
      window.removeEventListener(
        "existingSimulationNavigation",
        handleExistingSimulationNavigation as EventListener,
      );
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
          }),
        );

        // Check if we already have an attemptId
        if (tourState.attemptId) {
          // If we have an attemptId, navigate directly to the simulation
          log.info("tour.simulation.use_existing_attempt", {
            message: "Using existing attemptId for tour navigation",
            context: { component: "TATour", attemptId: tourState.attemptId },
          });

          // Invalidate simulation context queries to ensure fresh data
          log.debug("tour.simulation.invalidate_existing_attempt", {
            message:
              "Invalidating simulation context queries for existing attempt",
            context: { component: "TATour", attemptId: tourState.attemptId },
          });

          // Invalidate attempt-specific queries
          queryClient.invalidateQueries({
            queryKey: simulationAttemptKeys.detail(tourState.attemptId),
          });
          queryClient.invalidateQueries({
            queryKey: simulationChatKeysByAttemptId.one(tourState.attemptId),
          });

          // Invalidate related simulation data queries
          queryClient.invalidateQueries({
            queryKey: simulationChatGradeKeys.all,
          });
          queryClient.invalidateQueries({
            queryKey: simulationChatFeedbackKeys.all,
          });
          queryClient.invalidateQueries({
            queryKey: simulationMessageKeys.all,
          });

          // Dispatch existingSimulationNavigation event to set navigating to false
          window.dispatchEvent(
            new CustomEvent("existingSimulationNavigation", {
              detail: { attemptId: tourState.attemptId },
            }),
          );

          router.push(`/practice/a/${tourState.attemptId}`);
        } else {
          // If no attemptId, trigger the first practice simulation card click
          // Use startingSimulationId as loading state instead of timer
          const triggerSimulationStart = () => {
            // Look for practice simulation cards (permanent-simulation-card) first
            let practiceCards = document.querySelectorAll(
              '[data-testid="permanent-simulation-card"]',
            );

            // If no permanent cards found, try regular simulation cards as fallback
            if (practiceCards.length === 0) {
              practiceCards = document.querySelectorAll(
                '[data-testid="simulation-card"]',
              );
            }

            if (practiceCards.length > 0) {
              const firstCard = practiceCards[0];
              if (firstCard) {
                // Look for the start button using data-testid
                const startButton = firstCard.querySelector(
                  '[data-testid^="start-simulation-"]',
                ) as HTMLButtonElement;
                if (startButton && !startButton.disabled) {
                  log.debug("tour.simulation.autoclick_start", {
                    context: {
                      component: "TATour",
                      buttonText: startButton.textContent ?? undefined,
                      cardTitle: firstCard.querySelector(
                        '[data-testid="simulation-title"]',
                      )?.textContent,
                      simulationId: startButton
                        .getAttribute("data-testid")
                        ?.replace("start-simulation-", ""),
                    },
                  });
                  startButton.click();
                  // Don't auto-advance - let WebSocket events handle progression
                } else {
                  log.error("tour.simulation.autoclick_start_failed", {
                    message:
                      "Could not find start button on first practice simulation card",
                    context: {
                      component: "TATour",
                      buttonFound: !!startButton,
                      buttonText: startButton?.textContent ?? undefined,
                      buttonDisabled: startButton?.disabled,
                    },
                  });
                  toast.error(
                    "Could not start simulation automatically. Please click the Start button manually.",
                  );
                }
              } else {
                log.error("tour.simulation.card_null", {
                  message: "First practice simulation card is null",
                  context: { component: "TATour" },
                });
                toast.error(
                  "Could not start simulation automatically. Please click the Start button manually.",
                );
              }
            } else {
              log.error("tour.simulation.cards_not_found", {
                message: "No practice simulation cards found",
                context: { component: "TATour" },
              });
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
        log.debug("tour.step3.autoclick_prompt", {
          message: "Step 3 action triggered - navigating to attempt page",
          context: { component: "TATour" },
        });

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
            'button[class*="outline"][class*="h-auto"][class*="p-4"]',
          );

          if (starterPromptButtons.length > 0) {
            const firstButton = starterPromptButtons[0] as HTMLButtonElement;
            if (firstButton && !firstButton.disabled) {
              log.debug("tour.step3.autoclick_prompt_click", {
                context: {
                  component: "TATour",
                  buttonText: firstButton.textContent?.trim(),
                },
              });
              firstButton.click();
            } else {
              log.error("tour.step3.autoclick_prompt_failed", {
                message: "First starter prompt button is disabled or not found",
                context: {
                  component: "TATour",
                  buttonFound: !!firstButton,
                  buttonDisabled: firstButton?.disabled,
                  buttonText: firstButton?.textContent ?? undefined,
                },
              });
              toast.error(
                "Could not send message automatically. Please click a starter prompt manually.",
              );
            }
          } else {
            log.error("tour.step3.prompts_not_found", {
              message: "No starter prompt buttons found",
              context: { component: "TATour" },
            });
            toast.error(
              "No starter prompts available. Please type a message manually.",
            );
          }
        }, 1000); // Wait for page to load and messages to render
      },
      4: () => {
        // Step 4: Check if tour is completed
        if (effectiveProfile?.viewedIntro && effectiveProfile?.viewedChat) {
          // Tour is completed - close it, reset attemptId, and navigate home
          log.info("tour.step4.completed", {
            message:
              "Step 4 action triggered - tour completed, closing and navigating home",
            context: { component: "TATour" },
          });
          setAttemptId(null); // Reset attemptId since tour is complete
          closeTour();
          router.push("/home");
        } else {
          // Tour not completed - click the End Session/End Chat button
          log.debug("tour.step4.autoclick_end", {
            message:
              "Step 4 action triggered - clicking End Session/End Chat button",
            context: { component: "TATour" },
          });

          // Dispatch endChatButtonPressed event when Complete button is clicked on step 4
          // This will set the navigating state to true
          window.dispatchEvent(
            new CustomEvent("endChatButtonPressed", {
              detail: {
                chatId: "tour-step-4",
                attemptId: tourState.attemptId,
              },
            }),
          );

          // If we have an attemptId, navigate to the attempt page first
          if (tourState.attemptId) {
            router.push(`/practice/a/${tourState.attemptId}`);
          }

          // Click the End Session/End Chat button after a short delay to ensure page is loaded
          setTimeout(() => {
            const endChatButton = document.querySelector(
              "[data-tour-end-chat]",
            ) as HTMLButtonElement;

            if (endChatButton && !endChatButton.disabled) {
              log.debug("tour.step4.autoclick_end_click", {
                context: {
                  component: "TATour",
                  buttonText: endChatButton.textContent?.trim(),
                },
              });
              endChatButton.click();
            } else {
              log.error("tour.step4.autoclick_end_failed", {
                message: "End Session/End Chat button is disabled or not found",
                context: {
                  component: "TATour",
                  buttonFound: !!endChatButton,
                  buttonDisabled: endChatButton?.disabled,
                  buttonText: endChatButton?.textContent ?? undefined,
                },
              });
              toast.error(
                "Could not end chat automatically. Please click the End Session button manually.",
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
    queryClient,
  ]);

  // Set up global action handlers for the tour context
  useEffect(() => {
    const handleTourAction = (event: CustomEvent) => {
      const { stepIndex } = event.detail;
      log.debug("tour.action.triggered", {
        context: {
          component: "TATour",
          stepIndex,
          currentStep: tourState.currentStep,
          tourOpen: tourState.isOpen,
          stepsLength: tourState.steps.length,
        },
      });

      const action =
        customStepActions[stepIndex as keyof typeof customStepActions];
      if (action) {
        log.debug("tour.action.execute", {
          context: { component: "TATour", stepIndex },
        });
        action();
      } else {
        log.error("tour.action.missing", {
          message: "No action found for tour step",
          context: { component: "TATour", stepIndex },
        });
      }
    };

    window.addEventListener("tourAction", handleTourAction as EventListener);
    return () => {
      window.removeEventListener(
        "tourAction",
        handleTourAction as EventListener,
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
