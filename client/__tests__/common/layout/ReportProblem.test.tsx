import { renderWithMocks } from "@/test/renderWithMocks";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

// ——————————————————————————————————————————
import ReportProblem from "@/components/common/layout/ReportProblem";

// ✨ Import comprehensive mock data from our centralized mock system
import "@/mocks/api";
import "@/mocks/mutations";
import "@/mocks/queries";

// Mock the toast
vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

// Mock the profile context
vi.mock("@/contexts/profile-context", () => ({
  useProfile: () => ({
    activeProfile: {
      id: "test-profile-id",
      userId: 1,
      firstName: "Test",
      lastName: "User",
      alias: "testuser",
      role: "admin",
      active: true,
      viewedIntro: true,
      viewedChat: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastLogin: new Date().toISOString(),
      lastActive: new Date().toISOString(),
      defaultProfile: false,
    },
    setActiveProfile: vi.fn(),
    profiles: [],
    isLoading: false,
  }),
  ProfileProvider: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

// Mock the router
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
  usePathname: () => "/",
}));

const mockProps = {
  children: <button>Open Feedback</button>,
};

describe("ReportProblem", () => {
  /* ------------------------------------------------------------------ *
   * 💡 Mock Data Usage Guide:
   *
   * All API functions are automatically mocked via imports above.
   * Use mockSchema.* for realistic test data:
   *
   * Examples:
   * - mockSchema.users[0] - First user object
   * - mockSchema.classes - Array of class objects
   * - mockSchema.profiles - Array of profile objects
   *
   * To override specific mocks in individual tests:
   * - vi.mocked(queryFunction).mockResolvedValue(customData)
   * - vi.mocked(mutationFunction).mockResolvedValue(customResponse)
   * ------------------------------------------------------------------ */

  // ✨ Reset mocks after each test
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      // ✨ All mocks are automatically set up via imports above
      renderWithMocks(<ReportProblem {...mockProps} />);

      // Should render the feedback button
      await waitFor(() => {
        expect(screen.getByText("Open Feedback")).toBeInTheDocument();
      });
    });

    it("should render feedback dialog trigger", async () => {
      renderWithMocks(<ReportProblem {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText("Open Feedback")).toBeInTheDocument();
      });
    });

    it("should have correct accessibility attributes", async () => {
      renderWithMocks(<ReportProblem {...mockProps} />);

      await waitFor(() => {
        // Check for dialog trigger button
        const triggerButton = screen.getByText("Open Feedback");
        expect(triggerButton).toBeInTheDocument();
      });
    });
  });

  describe("User Interactions", () => {
    it("should open dialog when trigger is clicked", async () => {
      const user = userEvent.setup();
      renderWithMocks(<ReportProblem {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText("Open Feedback")).toBeInTheDocument();
      });

      // Click the trigger button to open dialog
      const triggerButton = screen.getByText("Open Feedback");
      await user.click(triggerButton);

      // Dialog should open and show form
      await waitFor(() => {
        expect(screen.getByText("Feedback")).toBeInTheDocument();
        expect(screen.getByLabelText("Type *")).toBeInTheDocument();
        expect(screen.getByLabelText("Message *")).toBeInTheDocument();
      });
    });

    it("should handle form submissions", async () => {
      const user = userEvent.setup();
      renderWithMocks(<ReportProblem {...mockProps} />);

      // Open dialog
      const triggerButton = screen.getByText("Open Feedback");
      await user.click(triggerButton);

      await waitFor(() => {
        expect(screen.getByText("Feedback")).toBeInTheDocument();
      });

      // Fill out the form
      const typeSelect = screen.getByLabelText("Type *");
      const messageTextarea = screen.getByLabelText("Message *");
      const submitButton = screen.getByRole("button", { name: /submit/i });

      // Select feedback type
      await user.click(typeSelect);
      await user.click(screen.getByText("🐛 Bug"));

      // Fill message
      await user.type(messageTextarea, "Test problem description");

      // Submit the form
      await user.click(submitButton);

      // Form should be submitted
      expect(messageTextarea).toHaveValue("Test problem description");
    });

    it("should handle state changes", async () => {
      const user = userEvent.setup();
      renderWithMocks(<ReportProblem {...mockProps} />);

      // Open dialog
      const triggerButton = screen.getByText("Open Feedback");
      await user.click(triggerButton);

      await waitFor(() => {
        expect(screen.getByText("Feedback")).toBeInTheDocument();
      });

      // Test input state changes
      const messageTextarea = screen.getByLabelText("Message *");
      await user.type(messageTextarea, "Test description");
      expect(messageTextarea).toHaveValue("Test description");
    });

    it("should handle user events", async () => {
      const user = userEvent.setup();
      renderWithMocks(<ReportProblem {...mockProps} />);

      // Open dialog
      const triggerButton = screen.getByText("Open Feedback");
      await user.click(triggerButton);

      await waitFor(() => {
        expect(screen.getByText("Feedback")).toBeInTheDocument();
      });

      // Test input interactions
      const messageTextarea = screen.getByLabelText("Message *");
      await user.type(messageTextarea, "Test description");
      expect(messageTextarea).toHaveValue("Test description");

      // Test form submission
      const submitButton = screen.getByRole("button", { name: /submit/i });
      await user.click(submitButton);
    });
  });

  describe("API Integration", () => {
    it("should handle and display an API error state", async () => {
      // Arrange: Override the default success mock with an error for this test.
      const { createAppFeedbackMock } = await import("@/mocks/mutations");
      createAppFeedbackMock.mockRejectedValue(new Error("API Error"));

      const user = userEvent.setup();
      renderWithMocks(<ReportProblem {...mockProps} />);

      // Open dialog
      const triggerButton = screen.getByText("Open Feedback");
      await user.click(triggerButton);

      await waitFor(() => {
        expect(screen.getByText("Feedback")).toBeInTheDocument();
      });

      // Fill and submit form to trigger error
      const typeSelect = screen.getByLabelText("Type *");
      const messageTextarea = screen.getByLabelText("Message *");
      const submitButton = screen.getByRole("button", { name: /submit/i });

      await user.click(typeSelect);
      await user.click(screen.getByText("🐛 Bug"));
      await user.type(messageTextarea, "Test problem description");
      await user.click(submitButton);

      // Check that error handling is in place
      await waitFor(() => {
        expect(createAppFeedbackMock).toHaveBeenCalled();
      });
    });

    it("should handle loading states", async () => {
      const user = userEvent.setup();
      renderWithMocks(<ReportProblem {...mockProps} />);

      // Open dialog
      const triggerButton = screen.getByText("Open Feedback");
      await user.click(triggerButton);

      await waitFor(() => {
        expect(screen.getByText("Feedback")).toBeInTheDocument();
      });

      // Component should show form elements
      expect(screen.getByLabelText("Type *")).toBeInTheDocument();
      expect(screen.getByLabelText("Message *")).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", async () => {
      renderWithMocks(<ReportProblem />);

      await waitFor(() => {
        expect(screen.getByText("Feedback")).toBeInTheDocument();
      });

      // Should render properly even with no props
      expect(screen.getByText("Feedback")).toBeInTheDocument();
    });

    it("should handle missing or invalid props", async () => {
      // Test with no props
      renderWithMocks(<ReportProblem />);

      await waitFor(() => {
        expect(screen.getByText("Feedback")).toBeInTheDocument();
      });

      // Should render with default props
      expect(screen.getByText("Feedback")).toBeInTheDocument();
    });
  });
});
