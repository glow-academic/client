import { Profile } from "@/types";

export interface TourStep {
  id: string;
  title: string;
  content: string;
  selector?: string;
  position?: "top" | "bottom" | "left" | "right";
  action?: () => void;
  isCompleted: boolean;
  requiresAction: boolean;
}

export interface TourState {
  isActive: boolean;
  currentStep: number;
  steps: TourStep[];
  profile: Profile | null;
}

export const createTATourSteps = (
  profile: Profile | null,
  _onNavigateToHome: () => void,
  _onNavigateToCohort: (cohortId: string) => void,
  _onStartPracticeSimulation: (simulationId: string) => void,
  _onEndChat: () => void
): TourStep[] => {
  if (!profile) return [];

  return [
    {
      id: "home-overview",
      title: "Welcome to GLOW! 🌟",
      content:
        "This is your home dashboard where you can see your progress, overall completion status, and access your assigned simulations. You'll find your cohorts, practice simulations, and history here.",
      isCompleted: false,
      requiresAction: false,
    },
    {
      id: "cohorts-page",
      title: "Your Cohorts 📚",
      content:
        "Let's check out your assigned cohorts. These are the simulations you need to complete for your training. Each cohort contains specific scenarios you'll be graded on.",
      action: () => {
        // Navigate to the first cohort the TA is assigned to
        // This will be handled by the tour component
      },
      isCompleted: false,
      requiresAction: true,
    },
    {
      id: "start-chat",
      title: "Practice Simulation 💬",
      content:
        "Let's start a practice simulation! This will help you get familiar with the chat interface. We'll start with a practice scenario so you can learn without pressure.",
      action: () => {
        // Start the first practice simulation
        // This will be handled by the tour component
      },
      isCompleted: false,
      requiresAction: true,
    },
    {
      id: "send-message",
      title: "Send a Message 💬",
      content:
        "Great! Now let's send a message in the chat. Type something in the chat input and press Enter to send your first message.",
      action: () => {
        // Send a message
        // This will be handled by the tour component
      },
      isCompleted: false,
      requiresAction: true,
    },
    {
      id: "end-chat",
      title: "Complete the Chat ✅",
      content:
        "Excellent! Now let's finish this simulation. Click the 'End Chat' button in the top right corner to complete this practice session.",
      isCompleted: false,
      requiresAction: true,
    },
  ];
};

export const getTourProgress = (steps: TourStep[]): number => {
  const completedSteps = steps.filter((step) => step.isCompleted).length;
  return Math.round((completedSteps / steps.length) * 100);
};

export const isTourComplete = (steps: TourStep[]): boolean => {
  return steps.every((step) => step.isCompleted);
};

export const getNextIncompleteStep = (steps: TourStep[]): number => {
  return steps.findIndex((step) => !step.isCompleted);
};
