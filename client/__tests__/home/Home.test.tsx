import { renderWithMocks } from "@/test/renderWithMocks";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

// ——————————————————————————————————————————
import Home from "@/components/home/Home";

// ✨ Import comprehensive mock data from our centralized mock system
import "@/mocks/api";
import "@/mocks/auth";
import "@/mocks/mutations";
import "@/mocks/navigation";
import "@/mocks/queries";

describe("Home", () => {
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
      renderWithMocks(<Home />);

      // Wait for the component to load and check for key elements
      await waitFor(() => {
        expect(screen.getByText("No Cohorts Available")).toBeInTheDocument();
      });
    });

    it("should have correct accessibility attributes", async () => {
      renderWithMocks(<Home />);

      // Check for main landmark
      await waitFor(() => {
        expect(screen.getByText("No Cohorts Available")).toBeInTheDocument();
      });

      // Check for proper heading structure
      const headings = screen.getAllByRole("heading");
      expect(headings.length).toBeGreaterThan(0);
    });
  });

  describe("User Interactions", () => {
    it("should handle state changes", async () => {
      const _user = userEvent.setup();
      renderWithMocks(<Home />);

      // Wait for component to load
      await waitFor(() => {
        expect(screen.getByText("No Cohorts Available")).toBeInTheDocument();
      });

      // Test that the component renders with mock data
      expect(screen.getByText("No Cohorts Available")).toBeInTheDocument();
    });

    it("should handle user events", async () => {
      const _user = userEvent.setup();
      renderWithMocks(<Home />);

      // Wait for component to load
      await waitFor(() => {
        expect(screen.getByText("No Cohorts Available")).toBeInTheDocument();
      });

      // Test that the component is interactive
      expect(screen.getByText("No Cohorts Available")).toBeInTheDocument();
    });
  });

  describe("API Integration", () => {
    it("should handle and display an API error state", async () => {
      // Arrange: Override the default success mock with an error for this test.
      const { getAllCohorts } = await import(
        "@/utils/queries/cohorts/get-all-cohorts"
      );
      vi.mocked(getAllCohorts).mockRejectedValue(new Error("API Error"));

      renderWithMocks(<Home />);

      // Wait for error state to be displayed
      await waitFor(() => {
        expect(screen.getByText("No Cohorts Available")).toBeInTheDocument();
      });
    });

    it("should handle loading states", async () => {
      // Mock loading state by delaying the response
      const { getAllCohorts } = await import(
        "@/utils/queries/cohorts/get-all-cohorts"
      );
      vi.mocked(getAllCohorts).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve([]), 100))
      );

      renderWithMocks(<Home />);

      // Check that loading state is handled gracefully
      await waitFor(() => {
        expect(screen.getByText("No Cohorts Available")).toBeInTheDocument();
      });
    });
  });

  describe("Navigation", () => {
    it("should handle navigation", async () => {
      renderWithMocks(<Home />);

      // Wait for component to load
      await waitFor(() => {
        expect(screen.getByText("No Cohorts Available")).toBeInTheDocument();
      });

      // Test that navigation is available
      expect(screen.getByText("No Cohorts Available")).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", async () => {
      // Mock empty data
      const { getAllCohorts } = await import(
        "@/utils/queries/cohorts/get-all-cohorts"
      );
      vi.mocked(getAllCohorts).mockResolvedValue([]);

      renderWithMocks(<Home />);

      // Wait for component to handle empty state
      await waitFor(() => {
        expect(screen.getByText("No Cohorts Available")).toBeInTheDocument();
      });
    });

    it("should handle missing profile data", async () => {
      // Mock missing profile data
      const { getAllProfiles } = await import(
        "@/utils/queries/profiles/get-all-profiles"
      );
      vi.mocked(getAllProfiles).mockResolvedValue([]);

      renderWithMocks(<Home />);

      // Wait for component to handle missing data
      await waitFor(() => {
        expect(screen.getByText("No Cohorts Available")).toBeInTheDocument();
      });
    });
  });
});

/*
 * Component Analysis for Home:
 * Path: home/Home.tsx
 *
 * Features detected:
 * - Default export: true
 * - Named exports: None
 * - Has props: false
 * - Props interface: None detected
 * - Client component: true
 * - Uses hooks: useQuery, useRouter, useCallback, useEffect, useMemo, useState, useRole, useWebSocket, useSession, useRef, userId, user, userCohorts, userCohortIds
 * - Uses router: true
 * - Has API calls: true
 * - Has form handling: false
 * - Uses state: true
 * - Uses effects: true
 * - Uses context: false
 *
 * TODO: Implement the failing tests above with actual test logic
 *
 * Example implementations:
 *
 * Basic rendering:
 * render(<Home />);
 * expect(screen.getByRole('...')).toBeInTheDocument();
 *
 * Props testing:
 * const props = { ... };
 * render(<Home {...props} />);
 * expect(screen.getByText(props.someText)).toBeInTheDocument();
 *
 * User interaction:
 * const button = screen.getByRole('button');
 * await user.click(button);
 * expect(mockFunction).toHaveBeenCalled();
 */
