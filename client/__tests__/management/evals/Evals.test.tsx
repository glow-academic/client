import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Evals from "@/components/management/evals/Evals";

// Mock external dependencies
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
  },
}));

vi.mock("@/utils/queries/evals/get-all-evals", () => ({
  getAllEvals: vi.fn(),
}));

vi.mock("@/utils/mutations/evals/delete-eval", () => ({
  deleteEval: vi.fn(),
}));

vi.mock("@/utils/queries/classes/get-all-classes", () => ({
  getAllClasses: vi.fn(),
}));

vi.mock("@/utils/queries/eval_runs/get-eval-runs-by-evals", () => ({
  getEvalRunsByEvals: vi.fn(),
}));

vi.mock("@/utils/queries/rubrics/get-all-rubrics", () => ({
  getAllRubrics: vi.fn(),
}));

vi.mock("@/utils/queries/standard_groups/get-standard-groups-by-rubrics", () => ({
  getStandardGroupsByRubrics: vi.fn(),
}));

vi.mock("@/utils/queries/standards/get-standards-by-standardgroups", () => ({
  getStandardsByStandardGroups: vi.fn(),
}));

vi.mock("@/utils/queries/eval_chats/get-eval-chats-by-evalruns", () => ({
  getEvalChatsByEvalRuns: vi.fn(),
}));

vi.mock("@/utils/queries/eval_chat_grades/get-eval-chat-grades-by-evalchats", () => ({
  getEvalChatGradesByEvalChats: vi.fn(),
}));

vi.mock("@/utils/queries/eval_chat_feedbacks/get-eval-chat-feedbacks-by-evalchatgrades", () => ({
  getEvalChatFeedbacksByEvalChatGrades: vi.fn(),
}));

// Import mocked functions
import { getAllEvals } from "@/utils/queries/evals/get-all-evals";
import { deleteEval } from "@/utils/mutations/evals/delete-eval";
import { getAllClasses } from "@/utils/queries/classes/get-all-classes";
import { getEvalRunsByEvals } from "@/utils/queries/eval_runs/get-eval-runs-by-evals";
import { getAllRubrics } from "@/utils/queries/rubrics/get-all-rubrics";
import { getStandardGroupsByRubrics } from "@/utils/queries/standard_groups/get-standard-groups-by-rubrics";
import { getStandardsByStandardGroups } from "@/utils/queries/standards/get-standards-by-standardgroups";
import { getEvalChatsByEvalRuns } from "@/utils/queries/eval_chats/get-eval-chats-by-evalruns";
import { getEvalChatGradesByEvalChats } from "@/utils/queries/eval_chat_grades/get-eval-chat-grades-by-evalchats";
import { getEvalChatFeedbacksByEvalChatGrades } from "@/utils/queries/eval_chat_feedbacks/get-eval-chat-feedbacks-by-evalchatgrades";

const mockPush = vi.fn();
const mockRouter = {
  push: mockPush,
  back: vi.fn(),
  forward: vi.fn(),
  refresh: vi.fn(),
  replace: vi.fn(),
};

// Mock data
const mockEvals = [
  {
    id: "eval-1",
    name: "Student Assessment 1",
    description: "Basic student evaluation for math concepts",
    classId: "class-1",
    baseAgentId: "agent-base",
    scenarioIds: ["scenario-1", "scenario-2"],
    agentIds: ["agent-1", "agent-2"],
    evalType: "student" as const,
    maxTurns: 10,
    numParallelRuns: 3,
    rubricIds: ["rubric-1"],
    createdAt: "2024-01-15T10:00:00Z",
  },
  {
    id: "eval-2",
    name: "TA Evaluation Complex",
    description: "Advanced TA evaluation with multiple scenarios and rubrics",
    classId: "class-2",
    baseAgentId: "agent-base-2",
    scenarioIds: [
      "scenario-1",
      "scenario-2",
      "scenario-3",
      "scenario-4",
      "scenario-5",
    ],
    agentIds: ["agent-1", "agent-2", "agent-3", "agent-4"],
    evalType: "ta" as const,
    maxTurns: 15,
    numParallelRuns: 5,
    rubricIds: ["rubric-1", "rubric-2", "rubric-3"],
    createdAt: "2024-01-20T14:30:00Z",
  },
];

const mockClasses = [
  {
    id: "class-1",
    name: "Computer Science 101",
    classCode: "CS101",
    description: "Introduction to Computer Science",
  },
];

const renderWithQueryClient = (component: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>{component}</QueryClientProvider>,
  );
};

describe("Evals", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useRouter as any).mockReturnValue(mockRouter);
    (getAllEvals as any).mockResolvedValue(mockEvals);
    (getAllClasses as any).mockResolvedValue(mockClasses);
    (getEvalRunsByEvals as any).mockResolvedValue([]);
    (getAllRubrics as any).mockResolvedValue([]);
    (getStandardGroupsByRubrics as any).mockResolvedValue([]);
    (getStandardsByStandardGroups as any).mockResolvedValue([]);
    (getEvalChatsByEvalRuns as any).mockResolvedValue([]);
    (getEvalChatGradesByEvalChats as any).mockResolvedValue([]);
    (getEvalChatFeedbacksByEvalChatGrades as any).mockResolvedValue([]);
    (deleteEval as any).mockResolvedValue(undefined);
  });

  describe("Rendering", () => {
    it("should render without crashing", async () => {
      renderWithQueryClient(<Evals />);

      expect(screen.getByText("Evaluations")).toBeInTheDocument();
      expect(
        screen.getByText(
          "Manage your evaluation configurations and run assessments",
        ),
      ).toBeInTheDocument();
    });

    it("should display evaluations when data is loaded", async () => {
      renderWithQueryClient(<Evals />);

      await waitFor(() => {
        expect(screen.getByText("Student Assessment 1")).toBeInTheDocument();
        expect(screen.getByText("TA Evaluation Complex")).toBeInTheDocument();
      });
    });

    it("should show empty state when no evaluations exist", async () => {
      (getAllEvals as any).mockResolvedValue([]);

      renderWithQueryClient(<Evals />);

      await waitFor(() => {
        expect(screen.getByText("No evaluations yet")).toBeInTheDocument();
        expect(
          screen.getByText(
            "Create your first evaluation to start assessing agent performance",
          ),
        ).toBeInTheDocument();
      });
    });

    it("should display evaluation details correctly", async () => {
      renderWithQueryClient(<Evals />);

      await waitFor(() => {
        // Check first evaluation details
        expect(screen.getByText("Student Assessment 1")).toBeInTheDocument();
        expect(
          screen.getByText("Basic student evaluation for math concepts"),
        ).toBeInTheDocument();
        expect(screen.getByText("Student")).toBeInTheDocument();
        expect(screen.getByText("2 scenarios")).toBeInTheDocument();
        expect(screen.getByText("2 agents")).toBeInTheDocument();
        expect(screen.getByText("1 rubrics")).toBeInTheDocument();
        expect(screen.getByText("10 max turns")).toBeInTheDocument();
        expect(screen.getByText("Parallel runs: 3")).toBeInTheDocument();

        // Check second evaluation details
        expect(screen.getByText("TA Evaluation Complex")).toBeInTheDocument();
        expect(screen.getByText("TA")).toBeInTheDocument();
        expect(screen.getByText("5 scenarios")).toBeInTheDocument();
        expect(screen.getByText("4 agents")).toBeInTheDocument();
        expect(screen.getByText("3 rubrics")).toBeInTheDocument();
        expect(screen.getByText("15 max turns")).toBeInTheDocument();
        expect(screen.getByText("Parallel runs: 5")).toBeInTheDocument();
      });
    });

    it("should display complexity badges correctly", async () => {
      renderWithQueryClient(<Evals />);

      await waitFor(() => {
        // First eval: 2 + 2 + 1 = 5 items (Moderate)
        const moderateBadges = screen.getAllByText("Moderate");
        expect(moderateBadges.length).toBeGreaterThan(0);

        // Second eval: 5 + 4 + 3 = 12 items (Complex)
        expect(screen.getByText("Complex")).toBeInTheDocument();
      });
    });

    it("should have correct accessibility attributes", async () => {
      renderWithQueryClient(<Evals />);

      await waitFor(() => {
        const createButton = screen.getByRole("button", {
          name: /create new evaluation/i,
        });
        expect(createButton).toBeInTheDocument();

        const runButtons = screen.getAllByRole("button", { name: /run/i });
        expect(runButtons.length).toBe(2);

        const editButtons = screen.getAllByRole("button", { name: /edit evaluation/i });
        expect(editButtons.length).toBe(2);

        const deleteButtons = screen.getAllByRole("button", {
          name: /delete evaluation/i,
        });
        expect(deleteButtons.length).toBe(2);
      });
    });
  });

  describe("User Interactions", () => {
    it("should navigate to create new evaluation when create button is clicked", async () => {
      const user = userEvent.setup();
      renderWithQueryClient(<Evals />);

      const createButton = screen.getByRole("button", {
        name: /create new evaluation/i,
      });
      await user.click(createButton);

      expect(mockPush).toHaveBeenCalledWith("/management/evals/new");
    });

    it("should navigate to edit evaluation when edit button is clicked", async () => {
      const user = userEvent.setup();
      renderWithQueryClient(<Evals />);

      await waitFor(() => {
        expect(screen.getByText("Student Assessment 1")).toBeInTheDocument();
      });

      const editButtons = screen.getAllByRole("button", { name: /edit evaluation/i });
      await user.click(editButtons[0]);

      expect(mockPush).toHaveBeenCalledWith("/management/evals/e/eval-1");
    });

      it("should start evaluation when run button is clicked", async () => {
    const user = userEvent.setup();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });

    renderWithQueryClient(<Evals />);

    await waitFor(() => {
      expect(screen.getByText("Student Assessment 1")).toBeInTheDocument();
    });

    const runButtons = screen.getAllByRole("button", { name: /run/i });
    await user.click(runButtons[0]);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/evals/start"),
        expect.objectContaining({
          method: "POST",
          body: expect.any(FormData),
        }),
      );
    });
  });

    it("should open delete dialog when delete button is clicked", async () => {
      const user = userEvent.setup();
      renderWithQueryClient(<Evals />);

      await waitFor(() => {
        expect(screen.getByText("Student Assessment 1")).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByRole("button", { name: /delete evaluation/i });
      await user.click(deleteButtons[0]);

      expect(screen.getByText("Are you sure?")).toBeInTheDocument();
      expect(
        screen.getByText(
          /This will permanently delete the evaluation "Student Assessment 1"/,
        ),
      ).toBeInTheDocument();
    });

    it("should cancel delete when cancel button is clicked", async () => {
      const user = userEvent.setup();
      renderWithQueryClient(<Evals />);

      await waitFor(() => {
        expect(screen.getByText("Student Assessment 1")).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByRole("button", { name: /delete evaluation/i });
      await user.click(deleteButtons[0]);

      const cancelButton = screen.getByRole("button", { name: /cancel/i });
      await user.click(cancelButton);

      expect(screen.queryByText("Are you sure?")).not.toBeInTheDocument();
    });

    it("should delete evaluation when delete is confirmed", async () => {
      const user = userEvent.setup();
      renderWithQueryClient(<Evals />);

      await waitFor(() => {
        expect(screen.getByText("Student Assessment 1")).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByRole("button", { name: /delete evaluation/i });
      await user.click(deleteButtons[0]);

      const confirmButton = screen.getByRole("button", { name: /^delete$/i });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(deleteEval).toHaveBeenCalledWith("eval-1");
        expect(toast.success).toHaveBeenCalledWith(
          "Evaluation deleted successfully",
        );
      });
    });

    it("should handle delete error gracefully", async () => {
      const user = userEvent.setup();
      (deleteEval as any).mockRejectedValue(new Error("Delete failed"));

      renderWithQueryClient(<Evals />);

      await waitFor(() => {
        expect(screen.getByText("Student Assessment 1")).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByRole("button", { name: /delete evaluation/i });
      await user.click(deleteButtons[0]);

      const confirmButton = screen.getByRole("button", { name: /^delete$/i });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Failed to delete evaluation");
      });
    });

    it("should navigate to create evaluation from empty state", async () => {
      const user = userEvent.setup();
      (getAllEvals as any).mockResolvedValue([]);

      renderWithQueryClient(<Evals />);

      await waitFor(() => {
        expect(screen.getByText("No evaluations yet")).toBeInTheDocument();
      });

      const createButton = screen.getByRole("button", {
        name: /create your first evaluation/i,
      });
      await user.click(createButton);

      expect(mockPush).toHaveBeenCalledWith("/management/evals/new");
    });
  });

  describe("Data Loading", () => {
    it("should call getAllEvals on mount", async () => {
      renderWithQueryClient(<Evals />);

      await waitFor(() => {
        expect(getAllEvals).toHaveBeenCalled();
      });
    });

    it("should handle loading state", () => {
      (getAllEvals as any).mockImplementation(() => new Promise(() => {})); // Never resolves

      renderWithQueryClient(<Evals />);

      expect(screen.getByText("Evaluations")).toBeInTheDocument();
    });

    it("should filter out RAY placeholder values", async () => {
      const evalWithRAY = {
        ...mockEvals[0],
        scenarioIds: ["scenario-1", "RAY", "scenario-2"],
        agentIds: ["agent-1", "RAY"],
        rubricIds: ["RAY", "rubric-1"],
      };
      (getAllEvals as any).mockResolvedValue([evalWithRAY]);

      renderWithQueryClient(<Evals />);

      await waitFor(() => {
        expect(screen.getByText("2 scenarios")).toBeInTheDocument();
        expect(screen.getByText("1 agents")).toBeInTheDocument();
        expect(screen.getByText("1 rubrics")).toBeInTheDocument();
      });
    });
  });

  describe("Edge Cases", () => {
    it("should handle evaluations without descriptions", async () => {
      const evalWithoutDescription = {
        ...mockEvals[0],
        description: "",
      };
      (getAllEvals as any).mockResolvedValue([evalWithoutDescription]);

      renderWithQueryClient(<Evals />);

      await waitFor(() => {
        expect(screen.getByText("Student Assessment 1")).toBeInTheDocument();
        // Description should not be rendered
        expect(
          screen.queryByText("Basic student evaluation for math concepts"),
        ).not.toBeInTheDocument();
      });
    });

    it("should handle evaluations with zero counts", async () => {
      const evalWithZeroCounts = {
        ...mockEvals[0],
        scenarioIds: ["RAY"],
        agentIds: ["RAY"],
        rubricIds: ["RAY"],
      };
      (getAllEvals as any).mockResolvedValue([evalWithZeroCounts]);

      renderWithQueryClient(<Evals />);

      await waitFor(() => {
        expect(screen.getByText("0 scenarios")).toBeInTheDocument();
        expect(screen.getByText("0 agents")).toBeInTheDocument();
        expect(screen.getByText("0 rubrics")).toBeInTheDocument();
        expect(screen.getByText("Simple")).toBeInTheDocument();
      });
    });

    it("should format dates correctly", async () => {
      renderWithQueryClient(<Evals />);

      await waitFor(() => {
        expect(screen.getByText("Created: Jan 15, 2024")).toBeInTheDocument();
        expect(screen.getByText("Created: Jan 20, 2024")).toBeInTheDocument();
      });
    });

    it("should handle API errors gracefully", async () => {
      (getAllEvals as any).mockRejectedValue(new Error("API Error"));

      renderWithQueryClient(<Evals />);

      // Component should still render header even if data fails to load
      expect(screen.getByText("Evaluations")).toBeInTheDocument();
    });
  });
});

/*
 * Component Analysis for Evals:
 * Path: management/evals/Evals.tsx
 *
 * Features implemented and tested:
 * - Data fetching with React Query
 * - Evaluation cards with comprehensive details
 * - CRUD operations (Create, Read, Update, Delete)
 * - Navigation to create/edit pages
 * - Delete confirmation dialog
 * - Empty state handling
 * - Complexity and type badges
 * - Date formatting
 * - Error handling and toast notifications
 * - Accessibility features
 * - RAY placeholder filtering
 * - Run functionality placeholder
 *
 * Test coverage includes:
 * - Basic rendering and data display
 * - User interactions (create, edit, delete, run)
 * - Data loading and error states
 * - Edge cases and error handling
 * - Accessibility testing
 * - Empty state functionality
 */
