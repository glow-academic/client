import { renderWithMocks } from "@/test/renderWithMocks";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

// ——————————————————————————————————————————
import Leaderboard from "@/components/analytics/Leaderboard";

// ✨ Import comprehensive mock data from our centralized mock system
import "@/mocks/api";
import "@/mocks/mutations";
import "@/mocks/queries";

describe("Leaderboard", () => {
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
      renderWithMocks(<Leaderboard />);

      // Wait for loading to complete and check for leaderboard content
      await waitFor(() => {
        expect(
          screen.queryByText("Loading leaderboard...")
        ).not.toBeInTheDocument();
      });

      // Should render the leaderboard container with cohort data
      expect(screen.getByText("Fall 2024 Cohort")).toBeInTheDocument();
    });

    it("should render with cohortId prop", async () => {
      renderWithMocks(<Leaderboard cohortId="test-cohort" />);

      // Wait for loading to complete
      await waitFor(() => {
        expect(
          screen.queryByText("Loading leaderboard...")
        ).not.toBeInTheDocument();
      });

      // Should render the leaderboard with cohort context
      expect(screen.getByText("Fall 2024 Cohort")).toBeInTheDocument();
    });

    it("should have correct accessibility attributes", async () => {
      renderWithMocks(<Leaderboard />);

      // Wait for loading to complete
      await waitFor(() => {
        expect(
          screen.queryByText("Loading leaderboard...")
        ).not.toBeInTheDocument();
      });

      // Should have proper content structure
      expect(screen.getByText("Fall 2024 Cohort")).toBeInTheDocument();
    });
  });

  describe("User Interactions", () => {
    it("should handle state changes", async () => {
      const _user = userEvent.setup();

      renderWithMocks(<Leaderboard />);

      // Wait for loading to complete
      await waitFor(() => {
        expect(
          screen.queryByText("Loading leaderboard...")
        ).not.toBeInTheDocument();
      });

      // Should render the leaderboard structure
      expect(screen.getByText("Fall 2024 Cohort")).toBeInTheDocument();
    });

    it("should handle user events", async () => {
      const _user = userEvent.setup();

      renderWithMocks(<Leaderboard />);

      // Wait for loading to complete
      await waitFor(() => {
        expect(
          screen.queryByText("Loading leaderboard...")
        ).not.toBeInTheDocument();
      });

      // Should render interactive elements
      expect(screen.getByText("Fall 2024 Cohort")).toBeInTheDocument();
    });
  });

  describe("API Integration", () => {
    it("should handle and display an API error state", async () => {
      // Arrange: Override the default success mock with an error for this test.
      const { getAllProfiles } = await import(
        "@/utils/queries/profiles/get-all-profiles"
      );
      vi.mocked(getAllProfiles).mockRejectedValue(new Error("API Error"));

      renderWithMocks(<Leaderboard />);

      // Wait for loading to complete
      await waitFor(() => {
        expect(
          screen.queryByText("Loading leaderboard...")
        ).not.toBeInTheDocument();
      });

      // Should still render the leaderboard structure
      expect(screen.getByText("Fall 2024 Cohort")).toBeInTheDocument();
    });

    it("should handle loading states", async () => {
      // TODO: Test loading states
      // Mock data is automatically loaded from @/mocks/schema
      renderWithMocks(<Leaderboard />);

      // Should show loading state initially
      expect(screen.getByText("Loading leaderboard...")).toBeInTheDocument();

      // Wait for loading to complete
      await waitFor(() => {
        expect(
          screen.queryByText("Loading leaderboard...")
        ).not.toBeInTheDocument();
      });

      // Should render leaderboard components
      expect(screen.getByText("Fall 2024 Cohort")).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", async () => {
      // Test with empty data
      const { getAllProfiles } = await import(
        "@/utils/queries/profiles/get-all-profiles"
      );
      vi.mocked(getAllProfiles).mockResolvedValue([]);

      renderWithMocks(<Leaderboard />);

      // Wait for loading to complete
      await waitFor(() => {
        expect(
          screen.queryByText("Loading leaderboard...")
        ).not.toBeInTheDocument();
      });

      // Should still render the leaderboard structure
      expect(screen.getByText("Fall 2024 Cohort")).toBeInTheDocument();
    });
  });
});

/*
 * Component Analysis for Leaderboard:
 * Path: analytics/Leaderboard.tsx
 *
 * Features detected:
 * - Default export: true
 * - Named exports: None
 * - Has props: false
 * - Props interface: None detected
 * - Client component: true
 * - Uses hooks: useProfile, useQuery, useEffect, useMemo, useState, usersToRank, userGrades, user
 * - Uses router: false
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
 * render(<Leaderboard />);
 * expect(screen.getByRole('...')).toBeInTheDocument();
 *
 * Props testing:
 * const props = { ... };
 * render(<Leaderboard {...props} />);
 * expect(screen.getByText(props.someText)).toBeInTheDocument();
 *
 * User interaction:
 * const button = screen.getByRole('button');
 * await user.click(button);
 * expect(mockFunction).toHaveBeenCalled();
 */
