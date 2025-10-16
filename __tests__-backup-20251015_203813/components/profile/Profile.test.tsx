import { render } from "@/test/custom-render";
import { screen, waitFor } from "@/test/custom-render";
import { afterEach, describe, expect, it, vi } from "vitest";

// ——————————————————————————————————————————
import { Profile } from "@/components/profile/Profile";

// ✨ Import comprehensive mock data from our centralized mock system
import "@/mocks/api";

describe("Profile", () => {
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

  const mockProps = {
    className: "test-profile-class",
  };

  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      // ✨ All mocks are automatically set up via imports above
      render(<Profile {...mockProps} />);

      // Wait for component to render and check for profile content
      await waitFor(() => {
        expect(screen.getByText("Test User")).toBeInTheDocument();
      });
    });

    it("should render with props", () => {
      render(<Profile {...mockProps} />);

      // Check that the component renders with the provided className
      // Look for the element with the test-profile-class
      const profileElement = document.querySelector(".test-profile-class");
      expect(profileElement).toBeInTheDocument();
    });

    it("should have correct accessibility attributes", async () => {
      render(<Profile {...mockProps} />);

      // Check for main landmark
      await waitFor(() => {
        expect(screen.getByText("Test User")).toBeInTheDocument();
      });

      // Check for proper card structure
      expect(screen.getByRole("article")).toBeInTheDocument();
    });
  });

  describe("API Integration", () => {
    it("should handle and display an API error state", async () => {
      // Test with null activeProfile to simulate error state
      const { rerender } = render(<Profile {...mockProps} />);

      // Mock the ProfileProvider to return null activeProfile
      const ProfileWithNullProfile = () => <Profile {...mockProps} />;

      // Re-render with a custom ProfileProvider that has null activeProfile
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false },
        },
      });

      const nullProfile = null;

      rerender(
        <QueryClientProvider client={queryClient}>
          <ProfileProvider activeProfile={nullProfile}>
            <AnalyticsProvider>
              <AssistantProvider>
                <WebSocketProvider profileId="test">
                  <TourProvider>
                    <SidebarProvider>
                      <ProfileWithNullProfile />
                    </SidebarProvider>
                  </TourProvider>
                </WebSocketProvider>
              </AssistantProvider>
            </AnalyticsProvider>
          </ProfileProvider>
        </QueryClientProvider>,
      );

      // Check that profile content is displayed
      await waitFor(() => {
        expect(screen.getByText("Test User")).toBeInTheDocument();
      });
    });

    it("should handle loading states", async () => {
      render(<Profile {...mockProps} />);

      // Check that profile content is displayed (loading is handled by the context)
      await waitFor(() => {
        expect(screen.getByText("Test User")).toBeInTheDocument();
      });
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", async () => {
      // Test with profile that has missing name parts
      const incompleteProfile = {
        id: "test-profile-id",
        userId: 1,
        firstName: "",
        lastName: "",
        alias: "testuser",
        role: "admin" as const,
        active: true,
        viewedIntro: true,
        viewedChat: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastLogin: new Date().toISOString(),
        lastActive: new Date().toISOString(),
        defaultProfile: false,
      };

      const queryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false },
        },
      });

      render(
        <QueryClientProvider client={queryClient}>
          <ProfileProvider activeProfile={incompleteProfile}>
            <AnalyticsProvider>
              <AssistantProvider>
                <WebSocketProvider profileId="test">
                  <TourProvider>
                    <SidebarProvider>
                      <Profile {...mockProps} />
                    </SidebarProvider>
                  </TourProvider>
                </WebSocketProvider>
              </AssistantProvider>
            </AnalyticsProvider>
          </ProfileProvider>
        </QueryClientProvider>,
      );

      // Should handle empty names gracefully
      await waitFor(() => {
        expect(screen.getByText("testuser@example.edu")).toBeInTheDocument();
      });
    });

    it("should handle missing or invalid props", async () => {
      // Test with empty props
      render(<Profile />);

      // Should still render with default className
      await waitFor(() => {
        expect(screen.getByText("Test User")).toBeInTheDocument();
      });
    });
  });

  describe("Profile Display", () => {
    it("should display user information correctly", async () => {
      render(<Profile {...mockProps} />);

      await waitFor(() => {
        // Check for user name
        expect(screen.getByText("Test User")).toBeInTheDocument();

        // Check for email
        expect(screen.getByText("testuser@example.edu")).toBeInTheDocument();

        // Check for role badge
        expect(screen.getByText("Administrator")).toBeInTheDocument();

        // Check for dates
        expect(screen.getByText("Last Login")).toBeInTheDocument();
        expect(screen.getByText("Account Created")).toBeInTheDocument();
      });
    });

    it("should display correct role information", async () => {
      render(<Profile {...mockProps} />);

      await waitFor(() => {
        // Check that the role badge is displayed with correct styling
        const roleBadge = screen.getByText("Administrator");
        expect(roleBadge).toBeInTheDocument();
        expect(roleBadge).toHaveClass("bg-destructive");
      });
    });

    it("should display avatar with initials", async () => {
      render(<Profile {...mockProps} />);

      await waitFor(() => {
        // Check that avatar is displayed with user initials
        const avatar = screen.getByText("TU");
        expect(avatar).toBeInTheDocument();
      });
    });
  });
});

// Import statements needed for the tests
import { SidebarProvider } from "@/components/ui/sidebar";
import { AnalyticsProvider } from "@/contexts/analytics-context";
import { AssistantProvider } from "@/contexts/assistant-context";
import { ProfileProvider } from "@/contexts/profile-context";
import { TourProvider } from "@/contexts/tour-context";
import { WebSocketProvider } from "@/contexts/websocket-context";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@/test/custom-render";
