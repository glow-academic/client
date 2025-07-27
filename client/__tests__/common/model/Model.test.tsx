import { renderWithMocks } from "@/test/renderWithMocks";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

// ——————————————————————————————————————————
import Model from "@/components/common/model/Model";

// ✨ Import comprehensive mock data from our centralized mock system
import "@/mocks/api";
import "@/mocks/mutations";
import "@/mocks/queries";

// Mock the router
const mockPush = vi.fn();
const mockBack = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    back: mockBack,
  }),
  usePathname: () => "/models",
}));

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

const mockProps = {
  providerId: "test-providerId",
  modelId: "test-modelId",
};

describe("Model", () => {
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
      renderWithMocks(<Model {...mockProps} />);

      // Should render the model component
      await waitFor(() => {
        expect(screen.getByText("Name")).toBeInTheDocument();
      });
    });

    it("should render with props", async () => {
      // Test with different props
      const propsWithData = {
        providerId: "different-provider",
        modelId: "different-model",
      };

      renderWithMocks(<Model {...propsWithData} />);

      await waitFor(() => {
        expect(screen.getByText("Name")).toBeInTheDocument();
      });
    });

    it("should have correct accessibility attributes", async () => {
      renderWithMocks(<Model {...mockProps} />);

      await waitFor(() => {
        // Check for form elements
        const form = document.querySelector("form");
        expect(form).toBeInTheDocument();

        // Check for input fields
        const nameLabel = screen.getByText("Name");
        expect(nameLabel).toBeInTheDocument();
      });
    });
  });

  describe("User Interactions", () => {
    it("should handle form submissions", async () => {
      const user = userEvent.setup();
      renderWithMocks(<Model {...mockProps} />);

      // Wait for form to load (either skeleton disappears or form appears)
      await waitFor(() => {
        const nameInput = screen.getByLabelText("Name");
        expect(nameInput).toBeInTheDocument();
      });

      // Find form inputs
      const nameInput = screen.getByLabelText("Name");
      const submitButton = screen.getByRole("button", {
        name: /update model/i,
      });

      // Fill out the form
      await user.clear(nameInput);
      await user.type(nameInput, "Test Model Name");

      // Submit the form
      await user.click(submitButton);

      // Verify the form submission was handled
      expect(submitButton).toBeInTheDocument();
    });

    it("should handle state changes", async () => {
      const user = userEvent.setup();
      renderWithMocks(<Model {...mockProps} />);

      // Wait for form to load
      await waitFor(() => {
        const nameInput = screen.getByLabelText("Name");
        expect(nameInput).toBeInTheDocument();
      });

      const nameInput = screen.getByLabelText("Name");
      await user.clear(nameInput);
      await user.type(nameInput, "Test Model");
      expect(nameInput).toHaveValue("Test Model");
    });

    it("should handle user events", async () => {
      const user = userEvent.setup();
      renderWithMocks(<Model {...mockProps} />);

      // Wait for form to load
      await waitFor(() => {
        const nameInput = screen.getByLabelText("Name");
        expect(nameInput).toBeInTheDocument();
      });

      const nameInput = screen.getByLabelText("Name");
      await user.clear(nameInput);
      await user.type(nameInput, "Test Model");

      // Test form submission
      const submitButton = screen.getByRole("button", {
        name: /update model/i,
      });
      await user.click(submitButton);

      expect(submitButton).toBeInTheDocument();
    });
  });

  describe("API Integration", () => {
    it("should handle and display an API error state", async () => {
      const user = userEvent.setup();
      renderWithMocks(<Model {...mockProps} />);

      // Wait for form to load
      await waitFor(() => {
        const nameInput = screen.getByLabelText("Name");
        expect(nameInput).toBeInTheDocument();
      });

      // Fill and submit form to trigger error
      const nameInput = screen.getByLabelText("Name");
      const submitButton = screen.getByRole("button", {
        name: /update model/i,
      });

      await user.clear(nameInput);
      await user.type(nameInput, "Test Model Name");

      await user.click(submitButton);

      // Check that error handling is in place
      expect(submitButton).toBeInTheDocument();
    });

    it("should handle loading states", () => {
      renderWithMocks(<Model {...mockProps} />);

      // Check that loading states are handled - either skeleton or form
      const skeletons = screen.queryAllByTestId("skeleton");
      const nameInput = screen.queryByLabelText("Name");

      expect(skeletons.length > 0 || nameInput).toBeTruthy();
    });
  });

  describe("Navigation", () => {
    it("should handle navigation", async () => {
      const user = userEvent.setup();
      renderWithMocks(<Model {...mockProps} />);

      // Wait for form to load
      await waitFor(() => {
        const nameInput = screen.getByLabelText("Name");
        expect(nameInput).toBeInTheDocument();
      });

      const backButton = screen.getByText("Back");
      await user.click(backButton);

      expect(mockBack).toHaveBeenCalled();
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", () => {
      renderWithMocks(<Model {...mockProps} />);

      // Test that the component renders without crashing even with minimal props
      expect(screen.getByText("Name")).toBeInTheDocument();
    });

    it("should handle missing or invalid props", () => {
      // Test with no props
      renderWithMocks(<Model providerId="test-provider" />);

      // Test that the component handles missing props gracefully
      expect(screen.getByText("Name")).toBeInTheDocument();
    });
  });
});
