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
  page: string; // The page/route this step should be on
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
  _onEndChat: () => void,
  cohortId?: string,
  attemptId?: string,
): TourStep[] => {
  if (!profile) return [];

  // Determine step completion based on profile status
  const introStepsComplete = profile.viewedIntro || false;
  const chatStepsComplete = profile.viewedChat || false;

  // Build dynamic page paths
  const cohortPage = cohortId
    ? `/cohorts/c/${cohortId}`
    : "/cohorts/c/[cohortId]";
  // Use a placeholder page when attemptId is not available
  const attemptPage = attemptId ? `/practice/a/${attemptId}` : "/practice"; // Stay on practice page until attemptId is available

  return [
    {
      id: "home-overview",
      title: "Welcome to GLOW! 🌟",
      content:
        "This is your home dashboard where you can see your assigned simulations and cohorts. Here you'll find all the training materials you need to complete.",
      isCompleted: introStepsComplete, // Step 0 completed if viewedIntro is true
      requiresAction: false,
      page: "/home",
    },
    {
      id: "cohort-leaderboard",
      title: "Cohort Leaderboard 📊",
      content:
        "Let's check your cohort's leaderboard to see how you and your peers are progressing. This shows everyone's completion status and scores.",
      action: () => {
        // Navigate to the first cohort the TA is assigned to
        // This will be handled by the tour component
      },
      isCompleted: introStepsComplete, // Step 1 completed if viewedIntro is true
      requiresAction: true,
      page: cohortPage,
    },
    {
      id: "practice-simulation",
      title: "Practice Simulation 💬",
      content:
        "Now let's start a practice simulation! This will help you get familiar with the chat interface. We'll start with a practice scenario so you can learn without pressure.",
      action: () => {
        // Start the first practice simulation
        // This will be handled by the tour component
      },
      isCompleted: chatStepsComplete, // Step 2 completed if viewedChat is true
      requiresAction: true,
      page: "/practice",
    },
    {
      id: "send-message",
      title: "Send a Message 💬",
      content:
        "Great! Now let's send a message in the chat. Type something in the chat input and press Enter to send your first message.",
      isCompleted: chatStepsComplete, // Step 3 completed if viewedChat is true
      requiresAction: true,
      page: attemptPage,
    },
    {
      id: "end-chat",
      title: "Complete the Chat ✅",
      content:
        "Excellent! Now let's finish this simulation. Click the 'End Chat' button in the top right corner to complete this practice session. Once you've done that, you'll have completed your GLOW tour!",
      isCompleted: chatStepsComplete, // Step 4 completed if viewedChat is true
      requiresAction: true,
      page: attemptPage,
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
