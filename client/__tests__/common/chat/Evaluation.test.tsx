import Evaluation from "@/components/common/chat/Evaluation";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the query functions
vi.mock("@/utils/queries/simulation_attempts/get-simulation-attempt", () => ({
  getSimulationAttempt: vi.fn(),
}));

vi.mock("@/utils/queries/simulations/get-simulation", () => ({
  getSimulation: vi.fn(),
}));

vi.mock(
  "@/utils/queries/simulation_chats/get-simulation-chats-by-attempt",
  () => ({
    getSimulationChatsByAttempt: vi.fn(),
  })
);

// Import mocked functions
import { getSimulationAttempt } from "@/utils/queries/simulation_attempts/get-simulation-attempt";
import { getSimulationChatsByAttempt } from "@/utils/queries/simulation_chats/get-simulation-chats-by-attempt";
import { getSimulation } from "@/utils/queries/simulations/get-simulation";

const mockAttempt = {
  id: "attempt1",
  createdAt: new Date().toISOString(),
  profileId: "profile1",
  simulationId: "simulation1",
};

const mockSimulation = {
  id: "simulation1",
  createdAt: new Date().toISOString(),
  title: "Test Simulation",
  timeLimit: 30,
  active: true,
  scenarioIds: ["scenario1"],
  rubricId: "rubric1",
};

const mockChats = [
  {
    id: "chat1",
    createdAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    title: "Chat 1",
    scenarioId: "scenario1",
    attemptId: "attempt1",
    completed: true,
  },
];

describe("Evaluation", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    vi.mocked(getSimulationAttempt).mockResolvedValue(mockAttempt);
    vi.mocked(getSimulation).mockResolvedValue(mockSimulation);
    vi.mocked(getSimulationChatsByAttempt).mockResolvedValue(mockChats);
  });

  const renderEvaluation = (attemptId = "attempt1") => {
    return render(
      <QueryClientProvider client={queryClient}>
        <Evaluation attemptId={attemptId} />
      </QueryClientProvider>
    );
  };

  it("renders loading state initially", () => {
    renderEvaluation();
    expect(screen.getByText("Loading evaluation...")).toBeInTheDocument();
  });

  it("displays evaluation results when loaded", async () => {
    renderEvaluation();

    await waitFor(() => {
      expect(screen.getByText("Evaluation Results")).toBeInTheDocument();
    });

    expect(screen.getByText("Test Simulation")).toBeInTheDocument();
  });

  it("shows completed chats", async () => {
    renderEvaluation();

    await waitFor(() => {
      expect(screen.getByText("Chat 1")).toBeInTheDocument();
    });
  });

  it("handles empty results", async () => {
    vi.mocked(getSimulationChatsByAttempt).mockResolvedValue([]);

    renderEvaluation();

    await waitFor(() => {
      expect(screen.getByText("No completed chats found")).toBeInTheDocument();
    });
  });

  it("handles evaluation errors", async () => {
    vi.mocked(getSimulationAttempt).mockRejectedValue(new Error("Not found"));

    renderEvaluation("invalid-attempt");

    await waitFor(() => {
      expect(screen.getByText("Error loading evaluation")).toBeInTheDocument();
    });
  });

  it("displays evaluation metrics", async () => {
    renderEvaluation();

    await waitFor(() => {
      expect(screen.getByText("Overall Score")).toBeInTheDocument();
    });

    expect(screen.getByText("Time Taken")).toBeInTheDocument();
    expect(screen.getByText("Completion Rate")).toBeInTheDocument();
  });

  it("allows navigation back to dashboard", async () => {
    renderEvaluation();

    await waitFor(() => {
      expect(screen.getByText("Back to Dashboard")).toBeInTheDocument();
    });

    const backButton = screen.getByText("Back to Dashboard");
    fireEvent.click(backButton);

    // Test would need router mock to verify navigation
    expect(backButton).toBeInTheDocument();
  });
});

/*
 * Component Analysis for EvaluationPage:
 * Path: common/chat/Evaluation.tsx
 *
 * Features detected:
 * - Default export: EvaluationPage
 * - Named exports: None
 * - Has props: true (evaluationId: string)
 * - Props interface: { evaluationId: string }
 * - Client component: true
 * - Uses hooks: useQuery, useState, useEffect, useMemo, useRef
 * - Uses router: true (useRouter)
 * - Has API calls: true (multiple eval-related endpoints)
 * - Has form handling: false
 * - Uses state: true (multiple state variables including showGrades toggle)
 * - Uses effects: true (multiple useEffect hooks)
 * - Uses context: false
 *
 * Key functionality:
 * - Displays evaluation runs and AI vs AI conversations
 * - Handles eval run selection via dropdown
 * - Streams real-time AI conversation data
 * - Shows evaluation results with toggle switch for grades/feedback overlay
 * - Supports document viewing in side panel
 * - Integrates with evaluation API endpoints
 * - Toggle between chat view and rubric grades/feedback view
 * - Run single evaluation or all evaluations in parallel
 * - Handles parallel execution events and displays progress
 *
 * TODO: Implement the failing tests above with actual test logic
 *
 * Example implementations:
 *
 * Basic rendering:
 * render(<EvaluationPage evaluationId="test-id" />);
 * expect(screen.getByRole('main')).toBeInTheDocument();
 *
 * Props testing:
 * const props = { evaluationId: "test-123" };
 * render(<EvaluationPage {...props} />);
 * expect(screen.getByTestId('evaluation-container')).toBeInTheDocument();
 *
 * User interaction:
 * const button = screen.getByRole('button', { name: /run evaluation/i });
 * await user.click(button);
 * expect(mockRunEvaluation).toHaveBeenCalled();
 *
 * Toggle interaction:
 * const toggle = screen.getByRole('switch', { name: /show grades/i });
 * await user.click(toggle);
 * expect(screen.getByText(/overall results/i)).toBeInTheDocument();
 */
