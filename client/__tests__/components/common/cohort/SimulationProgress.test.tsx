/**
 * SimulationProgress.test.tsx
 * Tests for the SimulationProgress component
 * @AshokSaravanan222 & @siladiea
 * 07/20/2025
 */

import SimulationProgress from "@/components/home/SimulationProgress";
import { render, screen } from "@/test/custom-render";
import { describe, expect, it } from "vitest";

describe("SimulationProgress", () => {
  const mockSimulation = {
    id: "sim-1",
    title: "Test Simulation",
    description: "A test simulation",
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
    active: true,
    practiceSimulation: false,
    defaultSimulation: false,
    timeLimit: 30,
    scenarioIds: ["scenario-1"],
    rubricId: "rubric-1",
    progress: {
      totalMembers: 5,
      passedCount: 3,
      inProgressCount: 1,
      notStartedCount: 1,
      passedMembers: ["profile-1", "profile-2", "profile-3"],
      inProgressMembers: ["profile-4"],
    },
    cohort: {
      id: "cohort-1",
      title: "Test Cohort",
      description: "A test cohort",
    },
  };

  it("renders simulation title and cohort name", () => {
    render(<SimulationProgress simulation={mockSimulation} />);

    expect(screen.getByText("Test Simulation")).toBeInTheDocument();
    expect(screen.getByText("Test Cohort")).toBeInTheDocument();
  });

  it("displays correct progress percentage", () => {
    render(<SimulationProgress simulation={mockSimulation} />);

    // 3 passed + 1 in progress = 4 out of 5 total = 80%
    expect(screen.getByText("80%")).toBeInTheDocument();
  });

  it("shows correct status text", () => {
    render(<SimulationProgress simulation={mockSimulation} />);

    expect(screen.getByText("In Progress")).toBeInTheDocument();
  });

  it("displays detailed counts", () => {
    render(<SimulationProgress simulation={mockSimulation} />);

    expect(screen.getByText("3 passed")).toBeInTheDocument();
    expect(screen.getByText("1 in progress")).toBeInTheDocument();
    expect(screen.getByText("1 not started")).toBeInTheDocument();
  });

  it("works without cohort information", () => {
    const { cohort: _cohort, ...simulationWithoutCohort } = mockSimulation;

    render(
      <SimulationProgress
        simulation={simulationWithoutCohort as typeof mockSimulation}
      />,
    );

    expect(screen.getByText("Test Simulation")).toBeInTheDocument();
    expect(screen.queryByText("Test Cohort")).not.toBeInTheDocument();
  });

  it("shows complete status when all members have passed", () => {
    const completedSimulation = {
      ...mockSimulation,
      progress: {
        totalMembers: 3,
        passedCount: 3,
        inProgressCount: 0,
        notStartedCount: 0,
        passedMembers: ["profile-1", "profile-2", "profile-3"],
        inProgressMembers: [],
      },
    };

    render(<SimulationProgress simulation={completedSimulation} />);

    expect(screen.getByText("Complete")).toBeInTheDocument();
    expect(screen.getByText("100%")).toBeInTheDocument();
  });

  it("shows not started status when no progress", () => {
    const notStartedSimulation = {
      ...mockSimulation,
      progress: {
        totalMembers: 3,
        passedCount: 0,
        inProgressCount: 0,
        notStartedCount: 3,
        passedMembers: [],
        inProgressMembers: [],
      },
    };

    render(<SimulationProgress simulation={notStartedSimulation} />);

    expect(screen.getByText("Not Started")).toBeInTheDocument();
    expect(screen.getByText("0%")).toBeInTheDocument();
  });

  it("caps progress percentage at 100% even with invalid data", () => {
    const invalidProgressSimulation = {
      ...mockSimulation,
      progress: {
        totalMembers: 5,
        passedCount: 6, // More passed than total members (invalid data)
        inProgressCount: 2, // Additional in progress
        notStartedCount: 0,
        passedMembers: [
          "profile-1",
          "profile-2",
          "profile-3",
          "profile-4",
          "profile-5",
          "profile-6",
        ],
        inProgressMembers: ["profile-7", "profile-8"],
      },
    };

    render(<SimulationProgress simulation={invalidProgressSimulation} />);

    // Should cap at 100% even though raw calculation would be 160%
    expect(screen.getByText("100%")).toBeInTheDocument();
    expect(screen.getByText("Complete")).toBeInTheDocument();
  });
});
