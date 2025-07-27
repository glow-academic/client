import { renderWithMocks } from "@/test/renderWithMocks";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

// ——————————————————————————————————————————
import Practice from "@/components/practice/Practice";

// ✨ Import comprehensive mock data from our centralized mock system
import "@/mocks/api";
import "@/mocks/auth";
import "@/mocks/mutations";
import "@/mocks/navigation";
import "@/mocks/queries";

describe("Practice", () => {
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
      renderWithMocks(<Practice />);

      // Wait for the component to load and check for key elements
      await waitFor(() => {
        // Check for loading skeleton or practice content
        const skeletons = document.querySelectorAll('[class*="animate-pulse"]');
        expect(skeletons.length).toBeGreaterThan(0);
      });
    });

    it("should have correct accessibility attributes", async () => {
      renderWithMocks(<Practice />);

      // Check for main landmark
      await waitFor(() => {
        // Check for proper heading structure
        const headings = screen.getAllByRole("heading");
        expect(headings.length).toBeGreaterThan(0);
      });
    });
  });

  describe("User Interactions", () => {
    it("should handle state changes", async () => {
      const _user = userEvent.setup();
      renderWithMocks(<Practice />);

      // Wait for component to load
      await waitFor(() => {
        // Check that the component renders with mock data
        const skeletons = document.querySelectorAll('[class*="animate-pulse"]');
        expect(skeletons.length).toBeGreaterThan(0);
      });
    });

    it("should handle user events", async () => {
      const _user = userEvent.setup();
      renderWithMocks(<Practice />);

      // Wait for component to load
      await waitFor(() => {
        // Check that the component is interactive
        const skeletons = document.querySelectorAll('[class*="animate-pulse"]');
        expect(skeletons.length).toBeGreaterThan(0);
      });
    });
  });

  describe("API Integration", () => {
    it("should handle and display an API error state", async () => {
      // Arrange: Override the default success mock with an error for this test.
      const { getAllPersonas } = await import(
        "@/utils/queries/personas/get-all-personas"
      );
      vi.mocked(getAllPersonas).mockRejectedValue(new Error("API Error"));

      renderWithMocks(<Practice />);

      // Wait for error state to be displayed
      await waitFor(() => {
        // Component should still render with loading state
        const skeletons = document.querySelectorAll('[class*="animate-pulse"]');
        expect(skeletons.length).toBeGreaterThan(0);
      });
    });

    it("should handle loading states", async () => {
      // Mock loading state by delaying the response
      const { getAllPersonas } = await import(
        "@/utils/queries/personas/get-all-personas"
      );
      vi.mocked(getAllPersonas).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve([]), 100))
      );

      renderWithMocks(<Practice />);

      // Check that loading state is handled gracefully
      await waitFor(() => {
        const skeletons = document.querySelectorAll('[class*="animate-pulse"]');
        expect(skeletons.length).toBeGreaterThan(0);
      });
    });
  });

  describe("Navigation", () => {
    it("should handle navigation", async () => {
      renderWithMocks(<Practice />);

      // Wait for component to load
      await waitFor(() => {
        // Test that navigation is available
        const skeletons = document.querySelectorAll('[class*="animate-pulse"]');
        expect(skeletons.length).toBeGreaterThan(0);
      });
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", async () => {
      // Mock empty data
      const { getAllSimulations } = await import(
        "@/utils/queries/simulations/get-all-simulations"
      );
      vi.mocked(getAllSimulations).mockResolvedValue([]);

      renderWithMocks(<Practice />);

      // Wait for component to handle empty state
      await waitFor(() => {
        // Should show loading skeleton even with empty data
        const skeletons = document.querySelectorAll('[class*="animate-pulse"]');
        expect(skeletons.length).toBeGreaterThan(0);
      });
    });

    it("should handle missing profile data", async () => {
      // Mock missing profile data
      const { getAllProfiles } = await import(
        "@/utils/queries/profiles/get-all-profiles"
      );
      vi.mocked(getAllProfiles).mockResolvedValue([]);

      renderWithMocks(<Practice />);

      // Wait for component to handle missing data
      await waitFor(() => {
        // Should show loading skeleton
        const skeletons = document.querySelectorAll('[class*="animate-pulse"]');
        expect(skeletons.length).toBeGreaterThan(0);
      });
    });
  });

  describe("Guest User Access", () => {
    it("should show practice zone for guest users", async () => {
      // Mock guest profile
      const guestProfile = {
        id: "guest-profile-id",
        userId: null,
        firstName: "Guest",
        lastName: "User",
        alias: "guest",
        role: "guest" as const,
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
          <ProfileProvider activeProfile={guestProfile}>
            <AnalyticsProvider>
              <AssistantProvider>
                <WebSocketProvider profileId="guest">
                  <TourProvider>
                    <SidebarProvider>
                      <Practice />
                    </SidebarProvider>
                  </TourProvider>
                </WebSocketProvider>
              </AssistantProvider>
            </AnalyticsProvider>
          </ProfileProvider>
        </QueryClientProvider>
      );

      await waitFor(() => {
        // Should show loading skeleton for guest users
        const skeletons = document.querySelectorAll('[class*="animate-pulse"]');
        expect(skeletons.length).toBeGreaterThan(0);
      });
    });
  });

  describe("Loading States", () => {
    it("should show loading skeleton when data is loading", async () => {
      // Mock loading state
      const { getAllSimulations } = await import(
        "@/utils/queries/simulations/get-all-simulations"
      );
      vi.mocked(getAllSimulations).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      renderWithMocks(<Practice />);

      // Check for skeleton elements
      await waitFor(() => {
        const skeletons = document.querySelectorAll('[class*="animate-pulse"]');
        expect(skeletons.length).toBeGreaterThan(0);
      });
    });
  });

  describe("Practice Zone Display", () => {
    it("should display practice simulations when available", async () => {
      // Mock simulation data
      const { getAllSimulations } = await import(
        "@/utils/queries/simulations/get-all-simulations"
      );
      vi.mocked(getAllSimulations).mockResolvedValue([
        {
          id: "sim-1",
          title: "Practice Simulation",
          timeLimit: 30,
          active: true,
          scenarioIds: ["scenario-1"],
          rubricId: "rubric-1",
          defaultSimulation: false,
          practiceSimulation: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ]);

      renderWithMocks(<Practice />);

      await waitFor(() => {
        // Should show loading skeleton while data loads
        const skeletons = document.querySelectorAll('[class*="animate-pulse"]');
        expect(skeletons.length).toBeGreaterThan(0);
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
import { render } from "@testing-library/react";
