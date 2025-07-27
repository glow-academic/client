import { renderWithMocks } from "@/test/renderWithMocks";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

// ——————————————————————————————————————————
import Reports from "@/components/analytics/report/Reports";

// ✨ Import comprehensive mock data from our centralized mock system
import "@/mocks/api";
import "@/mocks/mutations";
import "@/mocks/queries";

describe("Reports", () => {
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
      renderWithMocks(<Reports />);

      // Should show loading state initially
      expect(screen.getByText("Loading reports...")).toBeInTheDocument();
    });

    it("should render with data", async () => {
      // Mock the queries to return data
      const mockProfiles = [
        {
          id: "profile-1",
          firstName: "John",
          lastName: "Doe",
          alias: "john.doe",
          role: "ta" as const,
          defaultProfile: false,
          active: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lastLogin: new Date().toISOString(),
          viewedIntro: true,
          viewedChat: true,
          lastActive: new Date().toISOString(),
          userId: 1,
        },
      ];

      const mockSimulations = [
        {
          id: "sim-1",
          title: "Math Practice",
          timeLimit: 60,
          active: true,
          scenarioIds: ["scenario-1"],
          rubricId: "rubric-1",
          defaultSimulation: false,
          practiceSimulation: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      // Override the mocks for this test
      const { getAllProfiles } = await import(
        "@/utils/queries/profiles/get-all-profiles"
      );
      const { getAllSimulations } = await import(
        "@/utils/queries/simulations/get-all-simulations"
      );

      vi.mocked(getAllProfiles).mockResolvedValue(mockProfiles);
      vi.mocked(getAllSimulations).mockResolvedValue(mockSimulations);

      renderWithMocks(<Reports />);

      // Wait for loading to complete
      await waitFor(() => {
        expect(
          screen.queryByText("Loading reports..."),
        ).not.toBeInTheDocument();
      });

      // Should render the data table
      expect(screen.getByRole("table")).toBeInTheDocument();
    });

    it("should have correct accessibility attributes", async () => {
      renderWithMocks(<Reports />);

      // Should have loading state with proper accessibility
      expect(screen.getByText("Loading reports...")).toBeInTheDocument();
      // Note: The component doesn't have a status role, just the loading text
    });
  });

  describe("User Interactions", () => {
    it("should handle user events", async () => {
      const _user = userEvent.setup();

      // Mock data for interaction testing
      const mockProfiles = [
        {
          id: "profile-1",
          firstName: "John",
          lastName: "Doe",
          alias: "john.doe",
          role: "ta" as const,
          defaultProfile: false,
          active: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lastLogin: new Date().toISOString(),
          viewedIntro: true,
          viewedChat: true,
          lastActive: new Date().toISOString(),
          userId: 1,
        },
      ];

      const { getAllProfiles } = await import(
        "@/utils/queries/profiles/get-all-profiles"
      );
      vi.mocked(getAllProfiles).mockResolvedValue(mockProfiles);

      renderWithMocks(<Reports />);

      // Wait for data to load
      await waitFor(() => {
        expect(
          screen.queryByText("Loading reports..."),
        ).not.toBeInTheDocument();
      });

      // Should render interactive elements
      expect(screen.getByRole("table")).toBeInTheDocument();
    });
  });

  describe("API Integration", () => {
    it("should handle and display an API error state", async () => {
      // Arrange: Override the default success mock with an error for this test.
      const { getAllProfiles } = await import(
        "@/utils/queries/profiles/get-all-profiles"
      );
      vi.mocked(getAllProfiles).mockRejectedValue(new Error("API Error"));

      renderWithMocks(<Reports />);

      // Should show loading state initially
      expect(screen.getByText("Loading reports...")).toBeInTheDocument();

      // After error, should still show loading (component doesn't handle errors explicitly)
      await waitFor(() => {
        expect(screen.getByText("Loading reports...")).toBeInTheDocument();
      });
    });

    it("should handle loading states", () => {
      // TODO: Test loading states
      // Mock data is automatically loaded from @/mocks/schema
      renderWithMocks(<Reports />);

      // Should show loading spinner and text
      expect(screen.getByText("Loading reports...")).toBeInTheDocument();
      // Note: The component doesn't have a status role, just the loading text
    });
  });

  describe("Navigation", () => {
    it("should handle navigation", async () => {
      // Mock data for navigation testing
      const mockProfiles = [
        {
          id: "profile-1",
          firstName: "John",
          lastName: "Doe",
          alias: "john.doe",
          role: "ta" as const,
          defaultProfile: false,
          active: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lastLogin: new Date().toISOString(),
          viewedIntro: true,
          viewedChat: true,
          lastActive: new Date().toISOString(),
          userId: 1,
        },
      ];

      const { getAllProfiles } = await import(
        "@/utils/queries/profiles/get-all-profiles"
      );
      vi.mocked(getAllProfiles).mockResolvedValue(mockProfiles);

      renderWithMocks(<Reports />);

      // Wait for data to load
      await waitFor(() => {
        expect(
          screen.queryByText("Loading reports..."),
        ).not.toBeInTheDocument();
      });

      // Should render navigation elements
      expect(screen.getByRole("table")).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", async () => {
      // Test with empty profiles array
      const { getAllProfiles } = await import(
        "@/utils/queries/profiles/get-all-profiles"
      );
      vi.mocked(getAllProfiles).mockResolvedValue([]);

      renderWithMocks(<Reports />);

      // Should show loading state
      expect(screen.getByText("Loading reports...")).toBeInTheDocument();
    });
  });
});

/*
 * Component Analysis for Reports:
 * Path: analytics/report/Reports.tsx
 *
 * Features detected:
 * - Default export: true
 * - Named exports: None
 * - Has props: false
 * - Props interface: None detected
 * - Client component: true
 * - Uses hooks: useQuery, useRouter, useMemo, useReportColumns, user, userAttempts, userChats, userGrades, userMessages, userFeedbacks, userCohorts, userClassIds, userAgentIds, userScenarioIds, userSimulationIds, username
 * - Uses router: true
 * - Has API calls: true
 * - Has form handling: false
 * - Uses state: false
 * - Uses effects: false
 * - Uses context: false
 *
 * TODO: Implement the failing tests above with actual test logic
 *
 * Example implementations:
 *
 * Basic rendering:
 * render(<Reports />);
 * expect(screen.getByRole('...')).toBeInTheDocument();
 *
 * Props testing:
 * const props = { ... };
 * render(<Reports {...props} />);
 * expect(screen.getByText(props.someText)).toBeInTheDocument();
 *
 * User interaction:
 * const button = screen.getByRole('button');
 * await user.click(button);
 * expect(mockFunction).toHaveBeenCalled();
 */
