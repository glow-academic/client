// Eval.test.tsx
import Eval from "@/components/common/eval/Eval";
import { createEvalMock, updateEvalMock } from "@/mocks/mutations";
import { renderWithProviders } from "@/mocks/utils";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useSession } from "next-auth/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock the queries
vi.mock("@/utils/queries/evals/get-eval", () => ({
  getEval: vi.fn(() =>
    Promise.resolve({
      id: "test-eval-id",
      name: "Test Eval",
      description: "Test Description",
      baseAgentId: "test-agent-id",
      scenarioIds: ["test-scenario-id"],
      agentIds: ["test-agent-id"],
      maxTurns: 10,
      rubricIds: ["test-rubric-id"],
    })
  ),
}));

describe("Eval Component", () => {
  beforeEach(() => {
    // Reset all mocks before each test
    createEvalMock.mockReset();
    updateEvalMock.mockReset();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Role-based Access Control", () => {
    it("should render for admin users", () => {
      renderWithProviders(<Eval />, "admin");
      expect(screen.getByText(/basic information/i)).toBeVisible();
    });

    it("should show access denied for instructional users", () => {
      renderWithProviders(<Eval />, "instructional");
      expect(screen.getByText(/access denied/i)).toBeVisible();
      expect(screen.getByText(/you need admin privileges/i)).toBeVisible();
    });

    it("should show access denied for instructor users", () => {
      renderWithProviders(<Eval />, "instructor");
      expect(screen.getByText(/access denied/i)).toBeVisible();
      expect(screen.getByText(/you need admin privileges/i)).toBeVisible();
    });

    it("should show access denied for TA users", () => {
      renderWithProviders(<Eval />, "ta");
      expect(screen.getByText(/access denied/i)).toBeVisible();
      expect(screen.getByText(/you need admin privileges/i)).toBeVisible();
    });

    it("should show access denied for guest users", () => {
      renderWithProviders(<Eval />, "guest");
      expect(screen.getByText(/access denied/i)).toBeVisible();
      expect(screen.getByText(/you need admin privileges/i)).toBeVisible();
    });

    it("should handle unauthenticated users", () => {
      // Mock unauthenticated session
      vi.mocked(useSession).mockReturnValue({
        data: null,
        status: "unauthenticated",
        update: vi.fn(),
      });

      renderWithProviders(<Eval />, "guest", { session: null });
      expect(screen.getByText(/access denied/i)).toBeVisible();
    });
  });

  describe("Create Mode (Admin Only)", () => {
    it("renders create form with correct initial state", () => {
      renderWithProviders(<Eval />, "admin");

      // Check form elements are present
      expect(screen.getByLabelText(/evaluation name/i)).toBeVisible();
      expect(screen.getByLabelText(/description/i)).toBeVisible();
      expect(screen.getByLabelText(/max turns/i)).toHaveValue(10);
      expect(
        screen.getByRole("button", { name: /create evaluation/i })
      ).toBeVisible();

      // Check empty state messages
      expect(screen.getByText(/no scenarios selected/i)).toBeVisible();
      expect(screen.getByText(/no agents selected/i)).toBeVisible();
      expect(screen.getByText(/no rubrics selected/i)).toBeVisible();
    });

    it("shows validation errors when required fields are missing", async () => {
      const user = userEvent.setup();
      renderWithProviders(<Eval />, "admin");

      await user.click(
        screen.getByRole("button", { name: /create evaluation/i })
      );

      // Check validation messages appear
      expect(await screen.findByText(/name is required/i)).toBeVisible();
      expect(screen.getByText(/description is required/i)).toBeVisible();
      expect(screen.getByText(/base agent is required/i)).toBeVisible();
      expect(
        screen.getByText(/at least one scenario must be selected/i)
      ).toBeVisible();
      expect(
        screen.getByText(/at least one agent must be selected/i)
      ).toBeVisible();
      expect(
        screen.getByText(/at least one rubric must be selected/i)
      ).toBeVisible();

      // Ensure mutation was not called
      expect(createEvalMock).not.toHaveBeenCalled();
    });

    it("handles basic form input", async () => {
      const user = userEvent.setup();
      renderWithProviders(<Eval />, "admin");

      // Fill out basic form fields
      await user.type(screen.getByLabelText(/evaluation name/i), "Test Eval");
      await user.type(
        screen.getByLabelText(/description/i),
        "Test Description"
      );

      // Check that values were set
      expect(screen.getByDisplayValue("Test Eval")).toBeVisible();
      expect(screen.getByDisplayValue("Test Description")).toBeVisible();
    });
  });

  describe("Edit Mode (Admin Only)", () => {
    const mockEvalData = {
      id: "test-eval-id",
      name: "Test Eval",
      description: "Test Description",
      baseAgentId: "test-agent-id",
      scenarioIds: ["test-scenario-id"],
      agentIds: ["test-agent-id"],
      maxTurns: 10,
      rubricIds: ["test-rubric-id"],
    };

    it("renders edit form with prefilled data", async () => {
      renderWithProviders(<Eval evalId="test-eval-id" mode="edit" />, "admin");

      // Wait for data to load and form to be populated
      expect(
        await screen.findByDisplayValue(mockEvalData.name || "")
      ).toBeVisible();
      expect(
        screen.getByDisplayValue(mockEvalData.description || "")
      ).toBeVisible();
      expect(
        screen.getByRole("button", { name: /update evaluation/i })
      ).toBeVisible();
    });

    it("shows loading state while fetching eval data", () => {
      renderWithProviders(<Eval evalId="test-eval-id" mode="edit" />, "admin");

      // Should show loading spinner
      expect(document.querySelector(".animate-spin")).toBeInTheDocument();
    });
  });

  describe("Error Handling (Admin Only)", () => {
    it("handles create mutation errors gracefully", async () => {
      const user = userEvent.setup();
      const mockError = new Error("Failed to create evaluation");
      createEvalMock.mockRejectedValue(mockError);

      renderWithProviders(<Eval />, "admin");

      // Fill out form with valid data
      await user.type(screen.getByLabelText(/evaluation name/i), "Test");
      await user.type(screen.getByLabelText(/description/i), "Test");

      // Submit form
      await user.click(
        screen.getByRole("button", { name: /create evaluation/i })
      );

      // Form should still be available for retry
      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /create evaluation/i })
        ).not.toBeDisabled();
      });
    });
  });

  describe("Accessibility (Admin Only)", () => {
    it("has proper form labels and structure", () => {
      renderWithProviders(<Eval />, "admin");

      // Check that form fields have proper labels
      expect(screen.getByLabelText(/evaluation name/i)).toBeVisible();
      expect(screen.getByLabelText(/description/i)).toBeVisible();
      expect(screen.getByLabelText(/max turns/i)).toBeVisible();

      // Check that required fields are marked
      expect(screen.getByText(/evaluation name \*/i)).toBeVisible();
      expect(screen.getByText(/description \*/i)).toBeVisible();
    });

    it("provides clear error messages", async () => {
      const user = userEvent.setup();
      renderWithProviders(<Eval />, "admin");

      await user.click(
        screen.getByRole("button", { name: /create evaluation/i })
      );

      // Error messages should be descriptive and helpful
      expect(await screen.findByText(/name is required/i)).toBeVisible();
      expect(screen.getByText(/description is required/i)).toBeVisible();
      expect(
        screen.getByText(/at least one scenario must be selected/i)
      ).toBeVisible();
    });
  });

  describe("Form Sections (Admin Only)", () => {
    it("renders all required form sections", () => {
      renderWithProviders(<Eval />, "admin");

      expect(screen.getByText(/basic information/i)).toBeVisible();
      expect(screen.getByText(/configuration settings/i)).toBeVisible();
      expect(screen.getAllByText(/scenarios/i)[0]).toBeVisible(); // Use getAllByText for multiple matches
      expect(screen.getByText(/evaluation agents/i)).toBeVisible();
      expect(screen.getByText(/evaluation rubrics/i)).toBeVisible();
    });

    it("shows appropriate empty states for collections", () => {
      renderWithProviders(<Eval />, "admin");

      expect(screen.getByText(/no scenarios selected/i)).toBeVisible();
      expect(screen.getByText(/no agents selected/i)).toBeVisible();
      expect(screen.getByText(/no rubrics selected/i)).toBeVisible();
    });
  });
});
