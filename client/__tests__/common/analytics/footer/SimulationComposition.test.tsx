/**
 * SimulationComposition.test.tsx
 * Tests for the SimulationComposition component
 * @AshokSaravanan222 & @siladiea
 * 07/23/2025
 */

import SimulationComposition from "@/components/common/analytics/footer/SimulationComposition";
import { renderWithMocks } from "@/test/renderWithMocks";
import { screen } from "@testing-library/react";
import { afterEach, describe, it, vi } from "vitest";

// Mock the queries
vi.mock("@/utils/queries/profiles/get-all-profiles");
vi.mock("@/utils/queries/scenarios/get-all-scenarios");
vi.mock("@/utils/queries/simulations/get-all-simulations");
vi.mock(
  "@/utils/queries/simulation_attempts/get-simulation-attempts-by-profiles"
);
vi.mock("@/utils/queries/simulation_chats/get-simulation-chats-by-attempts");
vi.mock(
  "@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-simulationchats"
);

const mockProps = {
  dateStart: new Date("2024-01-01"),
  dateEnd: new Date("2024-12-31"),
  profileId: "test-profile-id",
  thresholds: {
    danger: 50,
    warning: 70,
    success: 80,
  },
};

describe("SimulationComposition", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("basic render smoke-test", () => {
    it("renders without crashing", () => {
      renderWithMocks(<SimulationComposition {...mockProps} />);
      expect(screen.getByText("Simulation Composition")).toBeInTheDocument();
    });

    it("should render with props", () => {
      renderWithMocks(<SimulationComposition {...mockProps} />);
      expect(
        screen.getByText("Anatomy of high vs low performing simulations")
      ).toBeInTheDocument();
    });

    it("should have correct accessibility attributes", () => {
      renderWithMocks(<SimulationComposition {...mockProps} />);
      expect(screen.getByRole("article")).toBeInTheDocument();
    });
  });

  describe("API Integration", () => {
    it("should handle and display an API error state", async () => {
      // TODO: Test error handling
      renderWithMocks(<SimulationComposition {...mockProps} />);
      expect(screen.getByText("Simulation Composition")).toBeInTheDocument();
    });

    it("should handle loading states", () => {
      // TODO: Test loading states
      renderWithMocks(<SimulationComposition {...mockProps} />);
      expect(screen.getByText("Simulation Composition")).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", () => {
      // TODO: Test edge cases
      renderWithMocks(<SimulationComposition {...mockProps} />);
      expect(screen.getByText("Simulation Composition")).toBeInTheDocument();
    });

    it("should handle missing or invalid props", () => {
      // TODO: Test with missing/invalid props
      renderWithMocks(<SimulationComposition {...mockProps} />);
      expect(screen.getByText("Simulation Composition")).toBeInTheDocument();
    });
  });
});
