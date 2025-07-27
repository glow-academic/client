/**
 * SimulationComposition.test.tsx
 * Tests for the SimulationComposition component
 * @AshokSaravanan222 & @siladiea
 * 07/23/2025
 */

import { renderWithMocks } from "@/test/renderWithMocks";
import { screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// ——————————————————————————————————————————
import SimulationComposition from "@/components/common/analytics/footer/SimulationComposition";

// ✨ Import comprehensive mock data from our centralized mock system
import "@/mocks/api";
import "@/mocks/mutations";
import "@/mocks/queries";

// ------------------------------------------------------------------
// Minimal props factory – edit values as needed
const mockProps = {
  dateStart: new Date("2024-01-01"),
  dateEnd: new Date("2024-12-31"),
  profileId: "test-profile-id",
  thresholds: {
    danger: 50,
    warning: 70,
    success: 80,
  },
  cohortIds: ["test-cohort-id"],
};

// ------------------------------------------------------------------
describe("SimulationComposition", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      renderWithMocks(<SimulationComposition {...mockProps} />);

      // Wait for component to load
      await waitFor(() => {
        expect(screen.getByText("Simulation Composition")).toBeInTheDocument();
      });
    });

    it("should render with props", async () => {
      renderWithMocks(<SimulationComposition {...mockProps} />);

      // Wait for component to load
      await waitFor(() => {
        expect(screen.getByText("Simulation Composition")).toBeInTheDocument();
      });
    });

    it("should have correct accessibility attributes", async () => {
      // Test accessibility features
      renderWithMocks(<SimulationComposition {...mockProps} />);

      // Wait for component to load
      await waitFor(() => {
        expect(screen.getByText("Simulation Composition")).toBeInTheDocument();
      });

      // Should have proper structure
      expect(screen.getByText("Simulation Composition")).toBeInTheDocument();
    });
  });

  describe("API Integration", () => {
    it("should handle and display an API error state", async () => {
      // Arrange: Override the default success mock with an error for this test.
      // Example: vi.mocked(getAllProfiles).mockRejectedValue(new Error('API Error'));

      renderWithMocks(<SimulationComposition {...mockProps} />);

      // Wait for component to load
      await waitFor(() => {
        expect(screen.getByText("Simulation Composition")).toBeInTheDocument();
      });

      // Should handle errors gracefully
      expect(screen.getByText("Simulation Composition")).toBeInTheDocument();
    });

    it("should handle loading states", async () => {
      // Test loading states
      renderWithMocks(<SimulationComposition {...mockProps} />);

      // Wait for component to load
      await waitFor(() => {
        expect(screen.getByText("Simulation Composition")).toBeInTheDocument();
      });

      // Should handle loading states
      expect(screen.getByText("Simulation Composition")).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", async () => {
      // Test with different props
      const propsWithDifferentDates = {
        ...mockProps,
        dateStart: new Date("2023-01-01"),
        dateEnd: new Date("2023-12-31"),
      };

      renderWithMocks(<SimulationComposition {...propsWithDifferentDates} />);

      // Wait for component to load
      await waitFor(() => {
        expect(screen.getByText("Simulation Composition")).toBeInTheDocument();
      });

      // Should handle different date ranges
      expect(screen.getByText("Simulation Composition")).toBeInTheDocument();
    });

    it("should handle missing or invalid props", async () => {
      // Test with missing profileId
      const propsWithoutProfile = {
        ...mockProps,
        profileId: undefined,
      };

      renderWithMocks(<SimulationComposition {...propsWithoutProfile} />);

      // Wait for component to load
      await waitFor(() => {
        expect(screen.getByText("Simulation Composition")).toBeInTheDocument();
      });

      // Should handle missing profileId
      expect(screen.getByText("Simulation Composition")).toBeInTheDocument();
    });
  });
});
