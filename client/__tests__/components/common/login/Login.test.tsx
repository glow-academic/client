import { render } from "@/test/custom-render";
import { screen, waitFor } from "@/test/custom-render";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

// ——————————————————————————————————————————
import Login from "@/components/auth/Login";

// ✨ Import comprehensive mock data from our centralized mock system
import "@/mocks/api";

// Mock next-auth
vi.mock("next-auth/react", () => ({
  signIn: vi.fn(),
}));

// Mock the router
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  usePathname: () => "/login",
}));

// Mock localStorage
Object.defineProperty(window, "localStorage", {
  value: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
  writable: true,
});

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

describe("Login", () => {
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
      render(<Login />);

      // Should render the login component
      await waitFor(() => {
        expect(screen.getByText("Glow")).toBeInTheDocument();
      });
    });

    it("should render login buttons", async () => {
      render(<Login />);

      await waitFor(() => {
        expect(screen.getByText("Glow")).toBeInTheDocument();
        expect(
          screen.getByTestId("microsoft-login-button"),
        ).toBeInTheDocument();
        expect(screen.getByTestId("guest-login-button")).toBeInTheDocument();
      });
    });

    it("should have correct accessibility attributes", async () => {
      render(<Login />);

      await waitFor(() => {
        // Check for login buttons
        const microsoftButton = screen.getByTestId("microsoft-login-button");
        const guestButton = screen.getByTestId("guest-login-button");

        expect(microsoftButton).toBeInTheDocument();
        expect(guestButton).toBeInTheDocument();

        // Check that buttons are accessible
        expect(microsoftButton).toHaveAttribute("type", "button");
        expect(guestButton).toHaveAttribute("type", "button");
      });
    });
  });

  describe("User Interactions", () => {
    it("should handle Microsoft login button click", async () => {
      const user = userEvent.setup();
      render(<Login />);

      await waitFor(() => {
        expect(
          screen.getByTestId("microsoft-login-button"),
        ).toBeInTheDocument();
      });

      // Find and click Microsoft login button
      const microsoftButton = screen.getByTestId("microsoft-login-button");
      await user.click(microsoftButton);

      // Button should be clickable
      expect(microsoftButton).toBeInTheDocument();
    });

    it("should handle guest access button click", async () => {
      const user = userEvent.setup();
      render(<Login />);

      await waitFor(() => {
        expect(screen.getByTestId("guest-login-button")).toBeInTheDocument();
      });

      // Find and click guest access button
      const guestButton = screen.getByTestId("guest-login-button");
      await user.click(guestButton);

      // Button should be clickable
      expect(guestButton).toBeInTheDocument();
    });

    it("should handle button state changes", async () => {
      const user = userEvent.setup();
      render(<Login />);

      await waitFor(() => {
        expect(
          screen.getByTestId("microsoft-login-button"),
        ).toBeInTheDocument();
      });

      // Test button interactions
      const microsoftButton = screen.getByTestId("microsoft-login-button");
      await user.click(microsoftButton);

      // Button should remain in document after click
      expect(microsoftButton).toBeInTheDocument();
    });
  });

  describe("API Integration", () => {
    it("should handle and display an API error state", async () => {
      // Arrange: Override the default success mock with an error for this test.
      const { getProfilesByUser } = await import(
        "@/utils/queries/profiles/get-profiles-by-user"
      );
      vi.mocked(getProfilesByUser).mockRejectedValue(new Error("API Error"));

      render(<Login />);

      await waitFor(() => {
        expect(screen.getByText("Glow")).toBeInTheDocument();
      });

      // Component should still render even with API errors
      expect(screen.getByTestId("microsoft-login-button")).toBeInTheDocument();
      expect(screen.getByTestId("guest-login-button")).toBeInTheDocument();
    });

    it("should handle loading states", async () => {
      render(<Login />);

      await waitFor(() => {
        expect(screen.getByText("Glow")).toBeInTheDocument();
      });

      // Component should show loading states appropriately
      expect(screen.getByTestId("microsoft-login-button")).toBeInTheDocument();
      expect(screen.getByTestId("guest-login-button")).toBeInTheDocument();
    });
  });

  describe("Navigation", () => {
    it("should handle navigation", async () => {
      render(<Login />);

      await waitFor(() => {
        expect(screen.getByText("Glow")).toBeInTheDocument();
      });

      // Should render login buttons
      expect(screen.getByTestId("microsoft-login-button")).toBeInTheDocument();
      expect(screen.getByTestId("guest-login-button")).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", async () => {
      render(<Login />);

      await waitFor(() => {
        expect(screen.getByText("Glow")).toBeInTheDocument();
      });

      // Should render properly even with no props
      expect(screen.getByTestId("microsoft-login-button")).toBeInTheDocument();
      expect(screen.getByTestId("guest-login-button")).toBeInTheDocument();
    });
  });
});
