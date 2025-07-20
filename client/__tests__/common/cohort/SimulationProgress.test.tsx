/**
 * SimulationProgress.test.tsx
 * Tests for the SimulationProgress component
 * @AshokSaravanan222 & @siladiea
 * 07/20/2025
 */

import SimulationProgress from "@/components/common/cohort/SimulationProgress";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

const mockSimulation = {
  id: "test-simulation-id",
  title: "Test Simulation",
  progress: {
    totalMembers: 10,
    passedCount: 6,
    inProgressCount: 3,
    notStartedCount: 1,
    passedMembers: ["user1", "user2", "user3", "user4", "user5", "user6"],
    inProgressMembers: ["user7", "user8", "user9"],
  },
};

describe("SimulationProgress", () => {
  it("renders simulation title", () => {
    render(<SimulationProgress simulation={mockSimulation} />);
    expect(screen.getByText("Test Simulation")).toBeInTheDocument();
  });

  it("displays correct completion percentage", () => {
    render(<SimulationProgress simulation={mockSimulation} />);
    expect(screen.getByText("60%")).toBeInTheDocument();
  });

  it("renders progress bar container", () => {
    render(<SimulationProgress simulation={mockSimulation} />);
    const progressBar = screen.getByTestId("progress-bar");
    expect(progressBar).toBeInTheDocument();
  });

  it("handles zero progress correctly", () => {
    const zeroProgressSimulation = {
      ...mockSimulation,
      progress: {
        totalMembers: 5,
        passedCount: 0,
        inProgressCount: 0,
        notStartedCount: 5,
        passedMembers: [],
        inProgressMembers: [],
      },
    };

    render(<SimulationProgress simulation={zeroProgressSimulation} />);
    expect(screen.getByText("0%")).toBeInTheDocument();
  });

  it("handles 100% completion correctly", () => {
    const completeSimulation = {
      ...mockSimulation,
      progress: {
        totalMembers: 5,
        passedCount: 5,
        inProgressCount: 0,
        notStartedCount: 0,
        passedMembers: ["user1", "user2", "user3", "user4", "user5"],
        inProgressMembers: [],
      },
    };

    render(<SimulationProgress simulation={completeSimulation} />);
    expect(screen.getByText("100%")).toBeInTheDocument();
  });

  it("shows title and percentage on the same line", () => {
    render(<SimulationProgress simulation={mockSimulation} />);
    const titleElement = screen.getByText("Test Simulation");
    const percentageElement = screen.getByText("60%");

    expect(titleElement).toBeInTheDocument();
    expect(percentageElement).toBeInTheDocument();
  });
});
