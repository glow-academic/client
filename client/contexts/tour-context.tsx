/**
 * tour-context.tsx
 * Global tour state management with persistent sidebar tour
 * @AshokSaravanan222 & @siladiea
 * 01/15/2025
 */
"use client";
import { logInfo } from "@/utils/logger";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
} from "react";

import { Profile } from "@/types";
import { TourStep } from "@/utils/tour-steps";

// Tour state interface
interface TourContextState {
  isOpen: boolean;
  currentStep: number;
  steps: TourStep[];
  profile: Profile | null;
  isNavigating: boolean;
  loadingSimulation: string | null;
  showGuideButton: boolean;
  attemptId: string | null; // Store attemptId for persistence
}

// Tour actions
type TourAction =
  | {
      type: "OPEN";
      payload: { steps: TourStep[]; profile: Profile; initialStep?: number };
    }
  | { type: "CLOSE" }
  | { type: "NEXT" }
  | { type: "PREV" }
  | { type: "SET_STEP"; payload: number }
  | { type: "COMPLETE_STEP"; payload: number }
  | { type: "SET_NAVIGATING"; payload: boolean }
  | { type: "SET_LOADING_SIMULATION"; payload: string | null }
  | { type: "SET_SHOW_GUIDE_BUTTON"; payload: boolean }
  | { type: "SET_ATTEMPT_ID"; payload: string | null };

// Initial state
const initialState: TourContextState = {
  isOpen: false,
  currentStep: 0,
  steps: [],
  profile: null,
  isNavigating: false,
  loadingSimulation: null,
  showGuideButton: false,
  attemptId: null,
};

// Reducer
function tourReducer(
  state: TourContextState,
  action: TourAction
): TourContextState {
  switch (action.type) {
    case "OPEN":
      return {
        ...state,
        isOpen: true,
        currentStep: action.payload.initialStep || 0,
        steps: action.payload.steps,
        profile: action.payload.profile,
        showGuideButton: true,
      };
    case "CLOSE":
      return {
        ...state,
        isOpen: false,
        isNavigating: false,
        loadingSimulation: null,
        showGuideButton: true, // Keep guide button visible after tour closes
        // Keep steps, profile, and attemptId so tour can be reopened
      };
    case "NEXT":
      return {
        ...state,
        currentStep: Math.min(state.currentStep + 1, state.steps.length - 1),
      };
    case "PREV":
      return {
        ...state,
        currentStep: Math.max(state.currentStep - 1, 0),
      };
    case "SET_STEP":
      return {
        ...state,
        currentStep: action.payload,
      };
    case "COMPLETE_STEP":
      return {
        ...state,
        steps: state.steps.map((step, index) =>
          index === action.payload ? { ...step, isCompleted: true } : step
        ),
      };
    case "SET_NAVIGATING":
      return {
        ...state,
        isNavigating: action.payload,
      };
    case "SET_LOADING_SIMULATION":
      return {
        ...state,
        loadingSimulation: action.payload,
      };
    case "SET_SHOW_GUIDE_BUTTON":
      return {
        ...state,
        showGuideButton: action.payload,
      };
    case "SET_ATTEMPT_ID":
      return {
        ...state,
        attemptId: action.payload,
      };
    default:
      return state;
  }
}

// Context
interface TourContextValue {
  state: TourContextState;
  openTour: (steps: TourStep[], profile: Profile, initialStep?: number) => void;
  closeTour: () => void;
  nextStep: () => void;
  prevStep: () => void;
  setStep: (step: number) => void;
  completeStep: (stepIndex: number) => void;
  setNavigating: (isNavigating: boolean) => void;
  setLoadingSimulation: (simulationId: string | null) => void;
  setShowGuideButton: (show: boolean) => void;
  setAttemptId: (attemptId: string | null) => void;
  openGuide: () => void;
  goBack: () => void;
  getGuideButtonState: () => "start" | "resume" | "complete" | "hidden";
}

const TourContext = createContext<TourContextValue | undefined>(undefined);

// Provider component
interface TourProviderProps {
  children: React.ReactNode;
}

export function TourProvider({ children }: TourProviderProps) {
  const [state, dispatch] = useReducer(tourReducer, initialState);

  // Actions
  const openTour = useCallback(
    (steps: TourStep[], profile: Profile, initialStep?: number) => {
      const payload: {
        steps: TourStep[];
        profile: Profile;
        initialStep?: number;
      } = { steps, profile };
      if (initialStep !== undefined) {
        payload.initialStep = initialStep;
      }
      dispatch({ type: "OPEN", payload });
    },
    []
  );

  const closeTour = useCallback(() => {
    dispatch({ type: "CLOSE" });
  }, []);

  const nextStep = useCallback(() => {
    dispatch({ type: "NEXT" });
  }, []);

  const prevStep = useCallback(() => {
    dispatch({ type: "PREV" });
  }, []);

  const setStep = useCallback((step: number) => {
    dispatch({ type: "SET_STEP", payload: step });
  }, []);

  const completeStep = useCallback((stepIndex: number) => {
    dispatch({ type: "COMPLETE_STEP", payload: stepIndex });
  }, []);

  const setNavigating = useCallback((isNavigating: boolean) => {
    dispatch({ type: "SET_NAVIGATING", payload: isNavigating });
  }, []);

  const setLoadingSimulation = useCallback((simulationId: string | null) => {
    dispatch({ type: "SET_LOADING_SIMULATION", payload: simulationId });
  }, []);

  const setShowGuideButton = useCallback((show: boolean) => {
    dispatch({ type: "SET_SHOW_GUIDE_BUTTON", payload: show });
  }, []);

  const setAttemptId = useCallback((attemptId: string | null) => {
    dispatch({ type: "SET_ATTEMPT_ID", payload: attemptId });
  }, []);

  const openGuide = useCallback(() => {
    if (!state.isOpen && state.steps.length > 0 && state.profile) {
      dispatch({
        type: "OPEN",
        payload: {
          steps: state.steps,
          profile: state.profile,
          initialStep: state.currentStep,
        },
      });
    }
  }, [state.isOpen, state.steps, state.profile, state.currentStep]);

  const goBack = useCallback(() => {
    // Navigate back based on current step
    switch (state.currentStep) {
      case 0: // Home overview - stay on home
        break;
      case 1: // Cohort leaderboard - go back to home
        window.history.back();
        break;
      case 2: // Practice simulation - go back to home
        window.history.back();
        break;
      case 3: // Send message - stay in simulation
        break;
      case 4: // End chat - stay in simulation
        break;
    }
  }, [state.currentStep]);

  // Get guide button state
  const getGuideButtonState = useCallback(():
    | "start"
    | "resume"
    | "complete"
    | "hidden" => {
    if (!state.profile) {
      return "hidden";
    }

    // Check if we're on a simulation chat page
    if (
      typeof window !== "undefined" &&
      window.location.pathname.includes("/practice/a/")
    ) {
      return "hidden";
    }

    // Check tour completion status
    if (state.profile.viewedIntro && state.profile.viewedChat) {
      return "complete";
    }

    if (state.isOpen) {
      return "resume";
    }

    return "start";
  }, [state.profile, state.isOpen]);

  // Context value
  const value = useMemo(
    () => ({
      state,
      openTour,
      closeTour,
      nextStep,
      prevStep,
      setStep,
      completeStep,
      setNavigating,
      setLoadingSimulation,
      setShowGuideButton,
      setAttemptId,
      openGuide,
      goBack,
      getGuideButtonState,
    }),
    [
      state,
      openTour,
      closeTour,
      nextStep,
      prevStep,
      setStep,
      completeStep,
      setNavigating,
      setLoadingSimulation,
      setShowGuideButton,
      setAttemptId,
      openGuide,
      goBack,
      getGuideButtonState,
    ]
  );

  // Handle body class for tour open state
  useEffect(() => {
    if (state.isOpen) {
      document.body.classList.add("tour-open");
    } else {
      document.body.classList.remove("tour-open");
    }

    return () => {
      document.body.classList.remove("tour-open");
    };
  }, [state.isOpen]);

  // Handle keyboard events
  useEffect(() => {
    if (!state.isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeTour();
      } else if (event.key === "ArrowRight") {
        nextStep();
      } else if (event.key === "ArrowLeft") {
        prevStep();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [state.isOpen, closeTour, nextStep, prevStep]);

  // Custom sidebar component with improved styling
  const TourSidebar = useMemo(() => {
    if (!state.isOpen || state.steps.length === 0) return null;

    const currentStep = state.steps[state.currentStep];
    if (!currentStep) return null;

    return (
      <aside className="tour-sidebar">
        <div className="tour-sidebar-content">
          <header className="tour-sidebar-header">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-foreground">
                {currentStep.title}
              </h3>
              <button
                onClick={closeTour}
                className="p-2 hover:bg-muted rounded-md transition-colors text-muted-foreground hover:text-foreground"
                aria-label="Close tour"
              >
                ✕
              </button>
            </div>
          </header>

          <div className="tour-sidebar-body">
            <div className="text-sm text-muted-foreground leading-relaxed">
              {currentStep.content}
            </div>
          </div>

          <footer className="tour-sidebar-footer">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
              <span>
                Step {state.currentStep + 1} of {state.steps.length}
              </span>
              <span>
                {Math.round(
                  ((state.currentStep + 1) / state.steps.length) * 100
                )}
                %
              </span>
            </div>

            <div className="w-full bg-muted rounded-full h-1.5 mb-4">
              <div
                className="bg-primary h-1.5 rounded-full transition-all duration-300"
                style={{
                  width: `${((state.currentStep + 1) / state.steps.length) * 100}%`,
                }}
              />
            </div>

            <div className="flex justify-between gap-2">
              <button
                onClick={prevStep}
                disabled={state.currentStep === 0}
                className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Back
              </button>
              <button
                onClick={() => {
                  // Dispatch custom event for tour action
                  window.dispatchEvent(
                    new CustomEvent("tourAction", {
                      detail: { stepIndex: state.currentStep },
                    })
                  );
                  logInfo("Tour Next button clicked", {
                    stepIndex: state.currentStep,
                  });
                }}
                disabled={state.isNavigating || !!state.loadingSimulation}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors flex-1"
              >
                {state.isNavigating
                  ? "Navigating..."
                  : state.loadingSimulation
                    ? "Starting..."
                    : state.currentStep + 1 === state.steps.length
                      ? "Finish"
                      : "Next"}
              </button>
            </div>
          </footer>
        </div>
      </aside>
    );
  }, [state, closeTour, prevStep]);

  return (
    <TourContext.Provider value={value}>
      {children}
      {state.isOpen && state.steps.length > 0 && (
        <>
          {/* Tour overlay that replaces/overlays the sidebar */}
          <div className="tour-overlay" />
          {TourSidebar}
        </>
      )}
    </TourContext.Provider>
  );
}

// Hook
export function useTour() {
  const context = useContext(TourContext);
  if (context === undefined) {
    throw new Error("useTour must be used within a TourProvider");
  }
  return context;
}
