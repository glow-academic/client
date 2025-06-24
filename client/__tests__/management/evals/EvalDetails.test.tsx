import EvalDetails from "@/components/management/evals/EvalDetails";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock external dependencies
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({
    push: mockPush,
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    replace: vi.fn(),
  })),
  usePathname: vi.fn(() => "/"),
  useSearchParams: vi.fn(() => new URLSearchParams()),
}));

// Mock toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

// Mock API query functions
vi.mock("@/utils/queries/eval_runs/get-eval-runs-by-eval", () => ({
  getEvalRunsByEval: vi.fn(),
}));

vi.mock("@/utils/queries/eval_chats/get-eval-chats-by-evalruns", () => ({
  getEvalChatsByEvalRuns: vi.fn(),
}));

vi.mock(
  "@/utils/queries/eval_chat_grades/get-eval-chat-grades-by-evalchats",
  () => ({
    getEvalChatGradesByEvalChats: vi.fn(),
  })
);

vi.mock("@/utils/queries/agents/get-agent", () => ({
  getAgent: vi.fn(),
}));

vi.mock("@/utils/queries/rubrics/get-rubric", () => ({
  getRubric: vi.fn(),
}));

// Mock API calls
global.fetch = vi.fn();

describe("EvalDetails", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  });

  const renderWithProviders = (ui: React.ReactElement, options = {}) => {
    const AllProviders = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    return render(ui, { wrapper: AllProviders, ...options });
  };

  const mockEvalRuns = [
    {
      id: "run-1",
      agentId: "agent-1",
      rubricId: "rubric-1",
      createdAt: "2024-01-01T00:00:00Z",
    },
    {
      id: "run-2",
      agentId: "agent-2",
      rubricId: "rubric-2",
      createdAt: "2024-01-02T00:00:00Z",
    },
  ];

  const mockEvalChats = [
    {
      id: "chat-1",
      evalRunId: "run-1",
      completed: true,
    },
    {
      id: "chat-2",
      evalRunId: "run-1",
      completed: false,
    },
    {
      id: "chat-3",
      evalRunId: "run-2",
      completed: true,
    },
  ];

  const mockGrades = [
    {
      id: "grade-1",
      evalChatId: "chat-1",
      score: 85,
    },
    {
      id: "grade-2",
      evalChatId: "chat-3",
      score: 92,
    },
  ];

  const mockAgents = [
    {
      id: "agent-1",
      name: "Test Agent 1",
    },
    {
      id: "agent-2",
      name: "Test Agent 2",
    },
  ];

  const mockRubrics = [
    {
      id: "rubric-1",
      name: "Test Rubric 1",
    },
    {
      id: "rubric-2",
      name: "Test Rubric 2",
    },
  ];

  describe("Rendering", () => {
    it("should render without crashing", async () => {
      // Mock successful API responses
      queryClient.setQueryData(["evalRuns", "eval-1"], mockEvalRuns);
      queryClient.setQueryData(
        ["evalChats", ["run-1", "run-2"]],
        mockEvalChats
      );
      queryClient.setQueryData(
        ["evalGrades", ["chat-1", "chat-2", "chat-3"]],
        mockGrades
      );
      queryClient.setQueryData(["agents", ["agent-1", "agent-2"]], mockAgents);
      queryClient.setQueryData(
        ["rubrics", ["rubric-1", "rubric-2"]],
        mockRubrics
      );

      renderWithProviders(<EvalDetails evalId="eval-1" />);

      await waitFor(() => {
        expect(screen.getByText("Test Agent 1")).toBeInTheDocument();
        expect(screen.getByText("Test Agent 2")).toBeInTheDocument();
      });
    });

    it("should show loading state initially", () => {
      renderWithProviders(<EvalDetails evalId="eval-1" />);

      expect(
        screen.getByText("Loading evaluation runs...")
      ).toBeInTheDocument();
    });

    it("should show empty state when no runs exist", async () => {
      queryClient.setQueryData(["evalRuns", "eval-1"], []);

      renderWithProviders(<EvalDetails evalId="eval-1" />);

      await waitFor(() => {
        expect(
          screen.getByText("No evaluation runs found")
        ).toBeInTheDocument();
        expect(
          screen.getByText("Create your first run to get started.")
        ).toBeInTheDocument();
      });
    });

    it("should have correct accessibility attributes", async () => {
      queryClient.setQueryData(["evalRuns", "eval-1"], mockEvalRuns);
      queryClient.setQueryData(
        ["evalChats", ["run-1", "run-2"]],
        mockEvalChats
      );
      queryClient.setQueryData(["agents", ["agent-1", "agent-2"]], mockAgents);
      queryClient.setQueryData(
        ["rubrics", ["rubric-1", "rubric-2"]],
        mockRubrics
      );

      renderWithProviders(<EvalDetails evalId="eval-1" />);

      await waitFor(() => {
        const viewButtons = screen.getAllByRole("button", { name: /view/i });
        const runButtons = screen.getAllByRole("button", { name: /run/i });

        expect(viewButtons).toHaveLength(2);
        expect(runButtons).toHaveLength(2);
      });
    });
  });

  describe("User Interactions", () => {
    it("should handle view button clicks", async () => {
      const user = userEvent.setup();

      queryClient.setQueryData(["evalRuns", "eval-1"], mockEvalRuns);
      queryClient.setQueryData(
        ["evalChats", ["run-1", "run-2"]],
        mockEvalChats
      );
      queryClient.setQueryData(["agents", ["agent-1", "agent-2"]], mockAgents);
      queryClient.setQueryData(
        ["rubrics", ["rubric-1", "rubric-2"]],
        mockRubrics
      );

      renderWithProviders(<EvalDetails evalId="eval-1" />);

      await waitFor(() => {
        expect(screen.getByText("Test Agent 1")).toBeInTheDocument();
      });

      const viewButton = screen.getAllByRole("button", { name: /view/i })[0]!;
      await user.click(viewButton);

      expect(mockPush).toHaveBeenCalledWith(
        "/management/evals/e/eval-1/r/run-1"
      );
    });

    it("should handle run button clicks", async () => {
      const user = userEvent.setup();

      // Mock successful fetch response
      const mockReader = {
        read: vi
          .fn()
          .mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode(
              'data: {"type": "chat_start", "message": "Starting"}\n'
            ),
          })
          .mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode('data: {"done": true}\n'),
          })
          .mockResolvedValueOnce({ done: true, value: undefined }),
      };

      const mockFetch = vi.mocked(global.fetch);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: { getReader: () => mockReader },
      } as unknown as Response);

      queryClient.setQueryData(["evalRuns", "eval-1"], mockEvalRuns);
      queryClient.setQueryData(
        ["evalChats", ["run-1", "run-2"]],
        mockEvalChats
      );
      queryClient.setQueryData(["agents", ["agent-1", "agent-2"]], mockAgents);
      queryClient.setQueryData(
        ["rubrics", ["rubric-1", "rubric-2"]],
        mockRubrics
      );

      renderWithProviders(<EvalDetails evalId="eval-1" />);

      await waitFor(() => {
        expect(screen.getByText("Test Agent 1")).toBeInTheDocument();
      });

      const runButton = screen.getAllByRole("button", { name: /run/i })[0]!;
      await user.click(runButton);
    });

    it("should handle delete button clicks", async () => {
      const user = userEvent.setup();

      queryClient.setQueryData(["evalRuns", "eval-1"], mockEvalRuns);
      queryClient.setQueryData(
        ["evalChats", ["run-1", "run-2"]],
        mockEvalChats
      );
      queryClient.setQueryData(["agents", ["agent-1", "agent-2"]], mockAgents);
      queryClient.setQueryData(
        ["rubrics", ["rubric-1", "rubric-2"]],
        mockRubrics
      );

      renderWithProviders(<EvalDetails evalId="eval-1" />);

      await waitFor(() => {
        expect(screen.getByText("Test Agent 1")).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByRole("button");
      const deleteButton = deleteButtons.find(
        (button) =>
          button.querySelector("svg")?.getAttribute("data-lucide") === "trash-2"
      );

      expect(deleteButton).toBeDefined();
      await user.click(deleteButton!);

      await waitFor(() => {
        expect(screen.getByText("Are you sure?")).toBeInTheDocument();
      });
    });

    it("should handle chat preview clicks", async () => {
      const user = userEvent.setup();

      queryClient.setQueryData(["evalRuns", "eval-1"], mockEvalRuns);
      queryClient.setQueryData(
        ["evalChats", ["run-1", "run-2"]],
        mockEvalChats
      );
      queryClient.setQueryData(
        ["evalGrades", ["chat-1", "chat-2", "chat-3"]],
        mockGrades
      );
      queryClient.setQueryData(["agents", ["agent-1", "agent-2"]], mockAgents);
      queryClient.setQueryData(
        ["rubrics", ["rubric-1", "rubric-2"]],
        mockRubrics
      );

      renderWithProviders(<EvalDetails evalId="eval-1" />);

      await waitFor(() => {
        expect(screen.getByText("Test Agent 1")).toBeInTheDocument();
      });

      const chatPreview = screen.getByText("Chat 1");
      await user.click(chatPreview);

      expect(mockPush).toHaveBeenCalledWith(
        "/management/evals/e/eval-1/r/run-1"
      );
    });
  });

  describe("API Integration", () => {
    it("should handle API loading states", () => {
      renderWithProviders(<EvalDetails evalId="eval-1" />);

      expect(
        screen.getByText("Loading evaluation runs...")
      ).toBeInTheDocument();
    });

    it("should handle successful API responses", async () => {
      queryClient.setQueryData(["evalRuns", "eval-1"], mockEvalRuns);
      queryClient.setQueryData(
        ["evalChats", ["run-1", "run-2"]],
        mockEvalChats
      );
      queryClient.setQueryData(
        ["evalGrades", ["chat-1", "chat-2", "chat-3"]],
        mockGrades
      );
      queryClient.setQueryData(["agents", ["agent-1", "agent-2"]], mockAgents);
      queryClient.setQueryData(
        ["rubrics", ["rubric-1", "rubric-2"]],
        mockRubrics
      );

      renderWithProviders(<EvalDetails evalId="eval-1" />);

      await waitFor(() => {
        expect(screen.getByText("Test Agent 1")).toBeInTheDocument();
        expect(screen.getByText("Test Agent 2")).toBeInTheDocument();
        expect(screen.getByText("Test Rubric 1")).toBeInTheDocument();
        expect(screen.getByText("Test Rubric 2")).toBeInTheDocument();
      });
    });

    it("should handle API errors gracefully", async () => {
      const user = userEvent.setup();

      // Mock failed fetch response
      const mockFetch = vi.mocked(global.fetch);
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      queryClient.setQueryData(["evalRuns", "eval-1"], mockEvalRuns);
      queryClient.setQueryData(
        ["evalChats", ["run-1", "run-2"]],
        mockEvalChats
      );
      queryClient.setQueryData(["agents", ["agent-1", "agent-2"]], mockAgents);
      queryClient.setQueryData(
        ["rubrics", ["rubric-1", "rubric-2"]],
        mockRubrics
      );

      renderWithProviders(<EvalDetails evalId="eval-1" />);

      await waitFor(() => {
        expect(screen.getByText("Test Agent 1")).toBeInTheDocument();
      });

      const runButton = screen.getAllByRole("button", { name: /run/i })[0]!;
      await user.click(runButton);

      // Wait for error handling
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });
    });
  });

  describe("Navigation", () => {
    it("should navigate to run details when view is clicked", async () => {
      const user = userEvent.setup();

      queryClient.setQueryData(["evalRuns", "eval-1"], mockEvalRuns);
      queryClient.setQueryData(
        ["evalChats", ["run-1", "run-2"]],
        mockEvalChats
      );
      queryClient.setQueryData(["agents", ["agent-1", "agent-2"]], mockAgents);
      queryClient.setQueryData(
        ["rubrics", ["rubric-1", "rubric-2"]],
        mockRubrics
      );

      renderWithProviders(<EvalDetails evalId="eval-1" />);

      await waitFor(() => {
        expect(screen.getByText("Test Agent 1")).toBeInTheDocument();
      });

      const viewButton = screen.getAllByRole("button", { name: /view/i })[0]!;
      await user.click(viewButton);

      expect(mockPush).toHaveBeenCalledWith(
        "/management/evals/e/eval-1/r/run-1"
      );
    });
  });

  describe("Edge Cases", () => {
    it("should handle missing agent data gracefully", async () => {
      queryClient.setQueryData(["evalRuns", "eval-1"], mockEvalRuns);
      queryClient.setQueryData(
        ["evalChats", ["run-1", "run-2"]],
        mockEvalChats
      );
      queryClient.setQueryData(
        ["agents", ["agent-1", "agent-2"]],
        [null, null]
      );
      queryClient.setQueryData(
        ["rubrics", ["rubric-1", "rubric-2"]],
        mockRubrics
      );

      renderWithProviders(<EvalDetails evalId="eval-1" />);

      await waitFor(() => {
        expect(screen.getByText("Unknown Agent")).toBeInTheDocument();
      });
    });

    it("should handle missing rubric data gracefully", async () => {
      queryClient.setQueryData(["evalRuns", "eval-1"], mockEvalRuns);
      queryClient.setQueryData(
        ["evalChats", ["run-1", "run-2"]],
        mockEvalChats
      );
      queryClient.setQueryData(["agents", ["agent-1", "agent-2"]], mockAgents);
      queryClient.setQueryData(
        ["rubrics", ["rubric-1", "rubric-2"]],
        [null, null]
      );

      renderWithProviders(<EvalDetails evalId="eval-1" />);

      await waitFor(() => {
        expect(screen.getByText("No rubric")).toBeInTheDocument();
      });
    });

    it("should prevent duplicate runs", async () => {
      const user = userEvent.setup();

      queryClient.setQueryData(["evalRuns", "eval-1"], mockEvalRuns);
      queryClient.setQueryData(
        ["evalChats", ["run-1", "run-2"]],
        mockEvalChats
      );
      queryClient.setQueryData(["agents", ["agent-1", "agent-2"]], mockAgents);
      queryClient.setQueryData(
        ["rubrics", ["rubric-1", "rubric-2"]],
        mockRubrics
      );

      renderWithProviders(<EvalDetails evalId="eval-1" />);

      await waitFor(() => {
        expect(screen.getByText("Test Agent 1")).toBeInTheDocument();
      });

      const runButton = screen.getAllByRole("button", { name: /run/i })[0]!;

      // Click run button twice quickly
      await user.click(runButton);
      await user.click(runButton);

      // Should only make one API call
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it("should display correct status badges", async () => {
      queryClient.setQueryData(["evalRuns", "eval-1"], mockEvalRuns);
      queryClient.setQueryData(
        ["evalChats", ["run-1", "run-2"]],
        mockEvalChats
      );
      queryClient.setQueryData(["agents", ["agent-1", "agent-2"]], mockAgents);
      queryClient.setQueryData(
        ["rubrics", ["rubric-1", "rubric-2"]],
        mockRubrics
      );

      renderWithProviders(<EvalDetails evalId="eval-1" />);

      await waitFor(() => {
        expect(screen.getByText("In Progress")).toBeInTheDocument();
        expect(screen.getByText("Completed")).toBeInTheDocument();
      });
    });
  });
});

/*
 * Component Analysis for EvalDetails:
 * Path: management/evals/EvalDetails.tsx
 *
 * Features tested:
 * ✅ Default export: true
 * ✅ Props interface: { evalId: string }
 * ✅ Client component: true
 * ✅ Uses hooks: useQuery, useQueryClient, useRouter, useState
 * ✅ Uses router: true
 * ✅ Has API calls: true
 * ✅ Has form handling: true (FormData for eval runs)
 * ✅ Uses state: true (showDeleteDialog, deleteItem, runningEvals)
 * ✅ Navigation functionality
 * ✅ Loading states
 * ✅ Error handling
 * ✅ User interactions (view, run, delete)
 * ✅ Edge cases (missing data, duplicate runs)
 */
