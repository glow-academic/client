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
  id: "sim-1",
  title: "Test Simulation",
  description: "A test simulation",
  defaultSimulation: false,
  practiceSimulation: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  timeLimit: 10,
  active: true,
  scenarioIds: ["scenario-1"],
  rubricId: "rubric-1",
  progress: {
    totalMembers: 1,
    passedCount: 1,
    inProgressCount: 0,
    notStartedCount: 0,
    passedMembers: ["user-1"],
    inProgressMembers: [],
  },
};

describe("SimulationProgress", () => {
  it("renders simulation title", () => {
    render(<SimulationProgress simulation={mockSimulation} />);
    expect(screen.getByText("Test Simulation")).toBeInTheDocument();
  });

  it("displays correct completion percentage", () => {
    render(<SimulationProgress simulation={mockSimulation} />);
    expect(screen.getByText("100%")).toBeInTheDocument();
  });

  it("renders progress bar container", () => {
    render(<SimulationProgress simulation={mockSimulation} />);
    expect(screen.getByTestId("simulation-progress")).toBeInTheDocument();
  });

  it("handles zero progress correctly", () => {
    const zeroProgressSimulation = {
      ...mockSimulation,
      progress: {
        totalMembers: 1,
        passedCount: 0,
        inProgressCount: 0,
        notStartedCount: 1,
        passedMembers: [],
        inProgressMembers: [],
      },
    };

    render(<SimulationProgress simulation={zeroProgressSimulation} />);
    expect(screen.getByText("0%")).toBeInTheDocument();
  });

  it("handles partial progress correctly", () => {
    const partialProgressSimulation = {
      ...mockSimulation,
      progress: {
        totalMembers: 1,
        passedCount: 0,
        inProgressCount: 1,
        notStartedCount: 0,
        passedMembers: [],
        inProgressMembers: ["user-1"],
      },
    };

    render(<SimulationProgress simulation={partialProgressSimulation} />);
    expect(screen.getByText("100%")).toBeInTheDocument();
  });

  it("shows title and percentage in flex layout", () => {
    render(<SimulationProgress simulation={mockSimulation} />);

    const container = screen.getByTestId("simulation-progress");
    expect(container).toHaveClass("flex", "items-center", "space-x-4");

    expect(screen.getByText("Test Simulation")).toBeInTheDocument();
    expect(screen.getByText("100%")).toBeInTheDocument();
  });
});
