// Eval.test.tsx
import Eval from "@/components/common/eval/Eval";
import { createEvalMock, updateEvalMock } from "@/mocks/mutations";
import { agents, evals, rubrics, scenarios } from "@/mocks/schema";
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

    it("should render for instructional users", () => {
      renderWithProviders(<Eval />, "instructional");
      expect(screen.getByText(/basic information/i)).toBeVisible();
    });

    // Test that non-admin roles can't access (even though not implemented yet)
    it("should eventually restrict access for instructor users", () => {
      // This test documents the expected behavior even though not implemented
      renderWithProviders(<Eval />, "instructor");
      // For now, it renders (no restriction implemented)
      expect(screen.getByText(/basic information/i)).toBeVisible();
      // TODO: When role restrictions are implemented, this should show access denied
    });

    it("should eventually restrict access for TA users", () => {
      renderWithProviders(<Eval />, "ta");
      // For now, it renders (no restriction implemented)
      expect(screen.getByText(/basic information/i)).toBeVisible();
      // TODO: When role restrictions are implemented, this should show access denied
    });

    it("should handle guest users appropriately", () => {
      // Mock unauthenticated session
      vi.mocked(useSession).mockReturnValue({
        data: null,
        status: "unauthenticated",
        update: vi.fn(),
      });

      renderWithProviders(<Eval />, "guest", { session: null });
      // Component should still render but with no user context
      expect(screen.getByText(/basic information/i)).toBeVisible();
    });
  });

  describe("Create Mode", () => {
    it("renders create form with correct initial state", () => {
      renderWithProviders(<Eval />);

      // Check form elements are present
      expect(screen.getByLabelText(/evaluation name/i)).toBeVisible();
      expect(screen.getByLabelText(/description/i)).toBeVisible();
      expect(screen.getByLabelText(/base agent/i)).toBeVisible();
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
      renderWithProviders(<Eval />);

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

    it("validates max turns field correctly", async () => {
      const user = userEvent.setup();
      renderWithProviders(<Eval />);

      const maxTurnsInput = screen.getByLabelText(/max turns/i);

      // Test invalid values
      await user.clear(maxTurnsInput);
      await user.type(maxTurnsInput, "0");
      await user.click(
        screen.getByRole("button", { name: /create evaluation/i })
      );

      expect(
        await screen.findByText(/max turns must be between 1 and 100/i)
      ).toBeVisible();

      await user.clear(maxTurnsInput);
      await user.type(maxTurnsInput, "101");
      await user.click(
        screen.getByRole("button", { name: /create evaluation/i })
      );

      expect(
        screen.getByText(/max turns must be between 1 and 100/i)
      ).toBeVisible();
    });

    it("handles form interactions with selects", () => {
      renderWithProviders(<Eval />);

      // Test that select elements are present and interactive
      expect(screen.getByDisplayValue("Add scenario")).toBeVisible();
      expect(screen.getByDisplayValue("Add agent")).toBeVisible();
      expect(screen.getByDisplayValue("Add rubric")).toBeVisible();
    });
  });

  describe("Edit Mode", () => {
    const mockEvalData = {
      ...evals[0],
      scenarioIds: [scenarios[0]!.id],
      agentIds: [agents[0]!.id],
      rubricIds: [rubrics[0]!.id],
    };

    beforeEach(() => {
      // Mock the getEval query to return our test data
      vi.doMock("@/utils/queries/evals/get-eval", () => ({
        getEval: vi.fn(() => Promise.resolve(mockEvalData)),
      }));
    });

    it("renders edit form with prefilled data", async () => {
      renderWithProviders(<Eval evalId="test-eval-id" mode="edit" />);

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
      renderWithProviders(<Eval evalId="test-eval-id" mode="edit" />);

      // Should show loading spinner
      expect(screen.getByRole("generic", { name: "" })).toHaveClass(
        "animate-spin"
      );
    });

    it("updates evaluation with modified data", async () => {
      const user = userEvent.setup();
      renderWithProviders(<Eval evalId="test-eval-id" mode="edit" />);

      // Wait for form to be populated
      const nameInput = await screen.findByDisplayValue(
        mockEvalData.name || ""
      );

      // Modify the name
      await user.clear(nameInput);
      await user.type(nameInput, "Updated Evaluation Name");

      // Submit the form
      await user.click(
        screen.getByRole("button", { name: /update evaluation/i })
      );

      await waitFor(() => {
        expect(updateEvalMock).toHaveBeenCalledWith({
          id: "test-eval-id",
          data: expect.objectContaining({
            name: "Updated Evaluation Name",
          }),
        });
      });
    });
  });

  describe("Loading States", () => {
    it("shows loading state while submitting create form", async () => {
      const user = userEvent.setup();

      // Make the mutation hang to test loading state
      createEvalMock.mockImplementation(() => new Promise(() => {}));

      renderWithProviders(<Eval />);

      // Fill minimum required fields quickly
      await user.type(screen.getByLabelText(/evaluation name/i), "Test");
      await user.type(screen.getByLabelText(/description/i), "Test");

      // Click submit
      await user.click(
        screen.getByRole("button", { name: /create evaluation/i })
      );

      // Should show loading state
      expect(
        screen.getByRole("button", { name: /creating.../i })
      ).toBeDisabled();
    });
  });

  describe("Error Handling", () => {
    it("handles create mutation errors gracefully", async () => {
      const user = userEvent.setup();
      const mockError = new Error("Failed to create evaluation");
      createEvalMock.mockRejectedValue(mockError);

      renderWithProviders(<Eval />);

      // Fill out form with valid data
      await user.type(screen.getByLabelText(/evaluation name/i), "Test");
      await user.type(screen.getByLabelText(/description/i), "Test");

      // Submit form
      await user.click(
        screen.getByRole("button", { name: /create evaluation/i })
      );

      // Form should still be available for retry
      expect(
        screen.getByRole("button", { name: /create evaluation/i })
      ).not.toBeDisabled();
    });
  });

  describe("Accessibility", () => {
    it("has proper form labels and structure", () => {
      renderWithProviders(<Eval />);

      // Check that form fields have proper labels
      expect(screen.getByLabelText(/evaluation name/i)).toBeVisible();
      expect(screen.getByLabelText(/description/i)).toBeVisible();
      expect(screen.getByLabelText(/base agent/i)).toBeVisible();
      expect(screen.getByLabelText(/max turns/i)).toBeVisible();

      // Check that required fields are marked
      expect(screen.getByText(/evaluation name \*/i)).toBeVisible();
      expect(screen.getByText(/description \*/i)).toBeVisible();
    });

    it("provides clear error messages", async () => {
      const user = userEvent.setup();
      renderWithProviders(<Eval />);

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

  describe("Form Sections", () => {
    it("renders all required form sections", () => {
      renderWithProviders(<Eval />);

      expect(screen.getByText(/basic information/i)).toBeVisible();
      expect(screen.getByText(/configuration settings/i)).toBeVisible();
      expect(screen.getByText(/scenarios/i)).toBeVisible();
      expect(screen.getByText(/evaluation agents/i)).toBeVisible();
      expect(screen.getByText(/evaluation rubrics/i)).toBeVisible();
    });

    it("shows appropriate empty states for collections", () => {
      renderWithProviders(<Eval />);

      expect(screen.getByText(/no scenarios selected/i)).toBeVisible();
      expect(screen.getByText(/no agents selected/i)).toBeVisible();
      expect(screen.getByText(/no rubrics selected/i)).toBeVisible();
    });
  });
});
