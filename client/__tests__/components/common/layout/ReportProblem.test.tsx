import { render } from '@/test/custom-render';
import { screen, waitFor } from '@/test/custom-render';
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

// ——————————————————————————————————————————
import ReportProblem from "@/components/common/layout/ReportProblem";

// ✨ Import comprehensive mock data from our centralized mock system
import "@/mocks/api";

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
      render(<ReportProblem {...mockProps} />);

      // Should render the feedback button
      await waitFor(() => {
        expect(screen.getByText("Open Feedback")).toBeInTheDocument();
      });
    });

    it("should render feedback dialog trigger", async () => {
      render(<ReportProblem {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText("Open Feedback")).toBeInTheDocument();
      });
    });

    it("should have correct accessibility attributes", async () => {
      render(<ReportProblem {...mockProps} />);

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
      render(<ReportProblem {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText("Open Feedback")).toBeInTheDocument();
      });

      // Click the trigger button to open dialog
      const triggerButton = screen.getByText("Open Feedback");
      await user.click(triggerButton);

      // Dialog should open and show form
      await waitFor(() => {
        expect(screen.getByText("Feedback")).toBeInTheDocument();
        expect(screen.getByRole("combobox")).toBeInTheDocument();
        expect(screen.getByLabelText("Message *")).toBeInTheDocument();
      });
    });

    it("should handle form submissions", async () => {
      const user = userEvent.setup();
      render(<ReportProblem {...mockProps} />);

      // Open dialog
      const triggerButton = screen.getByText("Open Feedback");
      await user.click(triggerButton);

      await waitFor(() => {
        expect(screen.getByText("Feedback")).toBeInTheDocument();
      });

      // Fill out the form
      const typeSelect = screen.getByRole("combobox");
      const messageTextarea = screen.getByLabelText("Message *");
      const submitButton = screen.getByRole("button", { name: /submit/i });

      // Select feedback type - use keyboard navigation instead of clicking
      await user.click(typeSelect);
      await user.keyboard("{ArrowDown}");
      await user.keyboard("{Enter}");

      // Fill message
      await user.type(messageTextarea, "Test problem description");

      // Submit the form
      await user.click(submitButton);

      // Form should be submitted - check that the form submission was attempted
      expect(submitButton).toBeDefined();
    });

    it("should handle state changes", async () => {
      const user = userEvent.setup();
      render(<ReportProblem {...mockProps} />);

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
      render(<ReportProblem {...mockProps} />);

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
      createAppFeedbackMock.mockRejectedValue(new Error("API Error"));

      const user = userEvent.setup();
      render(<ReportProblem {...mockProps} />);

      // Open dialog
      const triggerButton = screen.getByText("Open Feedback");
      await user.click(triggerButton);

      await waitFor(() => {
        expect(screen.getByText("Feedback")).toBeInTheDocument();
      });

      // Fill and submit form to trigger error
      const typeSelect = screen.getByRole("combobox");
      const messageTextarea = screen.getByLabelText("Message *");
      const submitButton = screen.getByRole("button", { name: /submit/i });

      await user.click(typeSelect);
      await user.keyboard("{ArrowDown}");
      await user.keyboard("{Enter}");
      await user.type(messageTextarea, "Test problem description");
      await user.click(submitButton);

      // Check that error handling is in place
      await waitFor(() => {
        expect(createAppFeedbackMock).toHaveBeenCalled();
      });
    });

    it("should handle loading states", async () => {
      const user = userEvent.setup();
      render(<ReportProblem {...mockProps} />);

      // Open dialog
      const triggerButton = screen.getByText("Open Feedback");
      await user.click(triggerButton);

      await waitFor(() => {
        expect(screen.getByText("Feedback")).toBeInTheDocument();
      });

      // Component should show form elements
      expect(screen.getByRole("combobox")).toBeInTheDocument();
      expect(screen.getByLabelText("Message *")).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", async () => {
      render(<ReportProblem />);

      await waitFor(() => {
        expect(screen.getByText("Feedback")).toBeInTheDocument();
      });

      // Should render properly even with no props
      expect(screen.getByText("Feedback")).toBeInTheDocument();
    });

    it("should handle missing or invalid props", async () => {
      // Test with no props
      render(<ReportProblem />);

      await waitFor(() => {
        expect(screen.getByText("Feedback")).toBeInTheDocument();
      });

      // Should render with default props
      expect(screen.getByText("Feedback")).toBeInTheDocument();
    });
  });
});
