/**
 * EvaluationRun.test.tsx
 * Test suite for the EvaluationRun component
 */

import EvaluationRun from "@/components/common/chat/EvaluationRun";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useRouter } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
}));

// Mock sonner
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock all query functions
vi.mock("@/utils/queries/eval_runs/get-eval-run", () => ({
  getEvalRun: vi.fn(),
}));

vi.mock("@/utils/queries/evals/get-eval", () => ({
  getEval: vi.fn(),
}));

vi.mock("@/utils/queries/eval_runs/get-eval-runs-by-eval", () => ({
  getEvalRunsByEval: vi.fn(),
}));

vi.mock("@/utils/queries/simulation_attempts/get-simulation-attempt", () => ({
  getSimulationAttempt: vi.fn(),
}));

vi.mock(
  "@/utils/queries/simulation_chats/get-simulation-chats-by-attempt",
  () => ({
    getSimulationChatsByAttempt: vi.fn(),
  })
);

vi.mock(
  "@/utils/queries/simulation_messages/get-simulation-messages-by-chat",
  () => ({
    getSimulationMessagesByChat: vi.fn(),
  })
);

vi.mock(
  "@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-simulationchats",
  () => ({
    getSimulationChatGradesBySimulationChats: vi.fn(),
  })
);

vi.mock(
  "@/utils/queries/simulation_chat_feedbacks/get-simulation-chat-feedbacks-by-simulationchatgrades",
  () => ({
    getSimulationChatFeedbacksBySimulationChatGrades: vi.fn(),
  })
);

// Import mocked functions
import { getEvalRun } from "@/utils/queries/eval_runs/get-eval-run";
import { getEvalRunsByEval } from "@/utils/queries/eval_runs/get-eval-runs-by-eval";
import { getEval } from "@/utils/queries/evals/get-eval";
import { getSimulationAttempt } from "@/utils/queries/simulation_attempts/get-simulation-attempt";
import { getSimulationChatFeedbacksBySimulationChatGrades } from "@/utils/queries/simulation_chat_feedbacks/get-simulation-chat-feedbacks-by-simulationchatgrades";
import { getSimulationChatGradesBySimulationChats } from "@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-simulationchats";
import { getSimulationChatsByAttempt } from "@/utils/queries/simulation_chats/get-simulation-chats-by-attempt";
import { getSimulationMessagesByChat } from "@/utils/queries/simulation_messages/get-simulation-messages-by-chat";

// Mock components
vi.mock("@/components/common/chat/Markdown", () => ({
  default: ({ children }: { children: string }) => <div>{children}</div>,
}));

// Mock data
const mockEvaluationRun = {
  id: "run1",
  createdAt: new Date().toISOString(),
  evalId: "eval1",
  agentId: "agent1",
  rubricId: "rubric1",
};

const mockEval = {
  id: "eval1",
  createdAt: new Date().toISOString(),
  name: "Test Evaluation",
  description: "A test evaluation",
  baseAgentId: "agent1",
  scenarioIds: ["scenario1"],
  agentIds: ["agent1"],
  rubricIds: ["rubric1"],
  evalType: "ta" as const,
  maxTurns: 10,
  maxParallelRuns: 5,
};

const mockResults = [
  {
    id: "result1",
    createdAt: new Date().toISOString(),
    evalId: "eval1",
    agentId: "agent1",
    rubricId: "rubric1",
  },
];

const mockAttempts = [
  {
    id: "attempt1",
    createdAt: new Date().toISOString(),
    profileId: "profile1",
    simulationId: "simulation1",
  },
];

const mockChats = [
  {
    id: "chat1",
    createdAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    title: "Test Chat",
    scenarioId: "scenario1",
    attemptId: "attempt1",
    completed: true,
  },
];

const mockGrades = [
  {
    id: "grade1",
    createdAt: new Date().toISOString(),
    passed: true,
    score: 85,
    timeTaken: 300,
    rubricId: "rubric1",
    simulationChatId: "chat1",
  },
];

describe("EvaluationRun", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    // Mock router
    vi.mocked(useRouter).mockReturnValue({
      push: vi.fn(),
      back: vi.fn(),
      forward: vi.fn(),
      refresh: vi.fn(),
      replace: vi.fn(),
      prefetch: vi.fn(),
    });

    // Mock all query functions
    vi.mocked(getEvalRun).mockResolvedValue(mockEvaluationRun);
    vi.mocked(getEval).mockResolvedValue(mockEval);
    vi.mocked(getEvalRunsByEval).mockResolvedValue(mockResults);
    vi.mocked(getSimulationAttempt).mockResolvedValue(mockAttempts[0] || null);
    vi.mocked(getSimulationChatsByAttempt).mockResolvedValue(mockChats);
    vi.mocked(getSimulationChatGradesBySimulationChats).mockResolvedValue(
      mockGrades
    );
    vi.mocked(getSimulationMessagesByChat).mockResolvedValue([]);
    vi.mocked(
      getSimulationChatFeedbacksBySimulationChatGrades
    ).mockResolvedValue([]);

    // Mock fetch for starting evaluation
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    } as Response);
  });

  const renderEvaluationRun = (runId = "run1") => {
    return render(
      <QueryClientProvider client={queryClient}>
        <EvaluationRun runId={runId} />
      </QueryClientProvider>
    );
  };

  it("renders loading state initially", () => {
    renderEvaluationRun();
    expect(screen.getByText("Loading evaluation...")).toBeInTheDocument();
  });

  it("displays evaluation run information when loaded", async () => {
    renderEvaluationRun();

    await waitFor(() => {
      expect(screen.getByText("Test Evaluation")).toBeInTheDocument();
    });
  });

  it("shows running status correctly", async () => {
    const runningEvaluationRun = {
      ...mockEvaluationRun,
      status: "running",
    };

    vi.mocked(getEvalRun).mockResolvedValue(runningEvaluationRun);

    renderEvaluationRun();

    await waitFor(() => {
      expect(screen.getByText("Running")).toBeInTheDocument();
    });
  });

  it("shows completed status correctly", async () => {
    const completedEvaluationRun = {
      ...mockEvaluationRun,
      status: "completed",
    };

    vi.mocked(getEvalRun).mockResolvedValue(completedEvaluationRun);

    renderEvaluationRun();

    await waitFor(() => {
      expect(screen.getByText("Completed")).toBeInTheDocument();
    });
  });

  it("displays rubric when toggle is enabled", async () => {
    const completedEvaluationRun = {
      ...mockEvaluationRun,
      status: "completed",
    };

    vi.mocked(getEvalRun).mockResolvedValue(completedEvaluationRun);

    renderEvaluationRun();

    await waitFor(() => {
      expect(screen.getByText("Show Rubric")).toBeInTheDocument();
    });

    const rubricToggle = screen.getByText("Show Rubric");
    fireEvent.click(rubricToggle);

    await waitFor(() => {
      expect(screen.getByText("Rubric Results")).toBeInTheDocument();
    });
  });

  it("handles status updates correctly", async () => {
    const runningEvaluationRun = {
      ...mockEvaluationRun,
      status: "running",
    };

    const completedEvaluationRun = {
      ...mockEvaluationRun,
      status: "completed",
    };

    vi.mocked(getEvalRun)
      .mockResolvedValueOnce(runningEvaluationRun)
      .mockResolvedValueOnce(completedEvaluationRun);

    renderEvaluationRun();

    await waitFor(() => {
      expect(screen.getByText("Running")).toBeInTheDocument();
    });

    // Simulate status update
    await waitFor(() => {
      expect(screen.getByText("Completed")).toBeInTheDocument();
    });
  });

  it("handles failed evaluation runs", async () => {
    const failedEvaluationRun = {
      ...mockEvaluationRun,
      status: "failed",
    };

    vi.mocked(getEvalRun).mockResolvedValue(failedEvaluationRun);

    renderEvaluationRun();

    await waitFor(() => {
      expect(screen.getByText("Failed")).toBeInTheDocument();
    });
  });

  it("displays conversation correctly", async () => {
    const completedEvaluationRun = {
      ...mockEvaluationRun,
      status: "completed",
    };

    vi.mocked(getEvalRun).mockResolvedValue(completedEvaluationRun);

    renderEvaluationRun();

    await waitFor(() => {
      expect(screen.getByText("Conversation")).toBeInTheDocument();
    });
  });

  it("handles error when evaluation run not found", async () => {
    vi.mocked(getEvalRun).mockRejectedValue(new Error("Not found"));

    renderEvaluationRun("invalid-run");

    await waitFor(() => {
      expect(screen.getByText("Error loading evaluation")).toBeInTheDocument();
    });
  });

  it("handles start evaluation button click", async () => {
    const runningEvaluationRun = {
      ...mockEvaluationRun,
      status: "pending",
    };

    vi.mocked(getEvalRun).mockResolvedValue(runningEvaluationRun);

    renderEvaluationRun();

    await waitFor(() => {
      expect(screen.getByText("Start Evaluation")).toBeInTheDocument();
    });

    const startButton = screen.getByText("Start Evaluation");
    fireEvent.click(startButton);

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/evaluations/start"),
      expect.objectContaining({
        method: "POST",
      })
    );
  });
});
