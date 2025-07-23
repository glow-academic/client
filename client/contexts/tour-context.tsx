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
}

// Tour actions
type TourAction =
  | { type: "OPEN"; payload: { steps: TourStep[]; profile: Profile } }
  | { type: "CLOSE" }
  | { type: "NEXT" }
  | { type: "PREV" }
  | { type: "SET_STEP"; payload: number }
  | { type: "COMPLETE_STEP"; payload: number }
  | { type: "SET_NAVIGATING"; payload: boolean }
  | { type: "SET_LOADING_SIMULATION"; payload: string | null }
  | { type: "SET_SHOW_GUIDE_BUTTON"; payload: boolean };

// Initial state
const initialState: TourContextState = {
  isOpen: false,
  currentStep: 0,
  steps: [],
  profile: null,
  isNavigating: false,
  loadingSimulation: null,
  showGuideButton: false,
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
        currentStep: 0,
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
        // Keep steps and profile so tour can be reopened
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
    default:
      return state;
  }
}

// Context
interface TourContextValue {
  state: TourContextState;
  openTour: (steps: TourStep[], profile: Profile) => void;
  closeTour: () => void;
  nextStep: () => void;
  prevStep: () => void;
  setStep: (step: number) => void;
  completeStep: (stepIndex: number) => void;
  setNavigating: (isNavigating: boolean) => void;
  setLoadingSimulation: (simulationId: string | null) => void;
  setShowGuideButton: (show: boolean) => void;
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
  const openTour = useCallback((steps: TourStep[], profile: Profile) => {
    dispatch({ type: "OPEN", payload: { steps, profile } });
  }, []);

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

  const openGuide = useCallback(() => {
    if (!state.isOpen && state.steps.length > 0 && state.profile) {
      dispatch({
        type: "OPEN",
        payload: { steps: state.steps, profile: state.profile },
      });
    }
  }, [state.isOpen, state.steps, state.profile]);

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
    if (!state.profile) return "hidden";

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

  // Handle click outside to close
  useEffect(() => {
    if (!state.isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (
        !target.closest(".tour-sidebar") &&
        !target.closest("[data-tour-step]")
      ) {
        closeTour();
      }
    };

    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [state.isOpen, closeTour]);

  // Custom sidebar component
  const TourSidebar = useMemo(() => {
    if (!state.isOpen || state.steps.length === 0) return null;

    const currentStep = state.steps[state.currentStep];
    if (!currentStep) return null;

    return (
      <aside className="tour-sidebar">
        <header className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold">{currentStep.title}</h3>
          <button
            onClick={closeTour}
            className="close-btn p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors"
            aria-label="Close tour"
          >
            ✕
          </button>
        </header>

        <div className="flex-1 space-y-4">
          <div className="prose dark:prose-invert text-sm">
            {currentStep.content}
          </div>

          {currentStep.requiresAction && (
            <div className="flex items-center gap-2 pt-4">
              <button
                onClick={() => {
                  // Dispatch custom event for tour action
                  window.dispatchEvent(
                    new CustomEvent("tourAction", {
                      detail: { stepIndex: state.currentStep },
                    })
                  );
                  logInfo("Tour action triggered", {
                    stepIndex: state.currentStep,
                  });
                }}
                disabled={state.isNavigating || !!state.loadingSimulation}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex-1"
              >
                {state.isNavigating
                  ? "Navigating..."
                  : state.loadingSimulation
                    ? "Starting..."
                    : "Continue"}
              </button>
            </div>
          )}
        </div>

        <footer className="mt-auto pt-6 space-y-3">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              Step {state.currentStep + 1} of {state.steps.length}
            </span>
            <span>
              {Math.round(((state.currentStep + 1) / state.steps.length) * 100)}
              %
            </span>
          </div>
          <progress
            value={state.currentStep + 1}
            max={state.steps.length}
            className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden"
          >
            <div className="h-full bg-primary rounded-full transition-all duration-300" />
          </progress>
          <div className="flex justify-between">
            <button
              onClick={goBack}
              disabled={state.currentStep === 0}
              className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Go Back
            </button>
            <button
              onClick={nextStep}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90"
            >
              {state.currentStep + 1 === state.steps.length ? "Finish" : "Next"}
            </button>
          </div>
        </footer>
      </aside>
    );
  }, [state, closeTour, nextStep, goBack]);

  return (
    <TourContext.Provider value={value}>
      {children}
      {state.isOpen && state.steps.length > 0 && (
        <>
          {/* Disable reactour overlay and just use our custom sidebar */}
          <div
            className="tour-mask"
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(0, 0, 0, 0.5)",
              zIndex: 1000,
              pointerEvents: "auto",
            }}
          />
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
