import PracticeZone from "@/components/home/PracticeZone";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// Mock the SimulationCard component
vi.mock("@/components/common/simulation/SimulationCard", () => ({
  default: ({ simulation }: { simulation: { title: string } }) => (
    <div data-testid="simulation-card">{simulation.title}</div>
  ),
}));

describe("PracticeZone", () => {
  const mockSimulations = [
    {
      id: "1",
      title: "Practice Simulation 1",
      defaultSimulation: true,
      // Add other required simulation fields
      createdAt: "",
      updatedAt: "",
      active: true,
      timeLimit: 15,
      rubricId: "",
      cohortIds: [],
      scenarioIds: [],
    },
    {
      id: "2",
      title: "Practice Simulation 2",
      defaultSimulation: true,
      // Add other required simulation fields
      createdAt: "",
      updatedAt: "",
      active: true,
      timeLimit: 20,
      rubricId: "",
      cohortIds: [],
      scenarioIds: [],
    },
  ];

  const mockProfile = {
    id: "1",
    firstName: "John",
    lastName: "Doe",
    role: "ta" as const,
    // Add other required profile fields
    createdAt: "",
    updatedAt: "",
    active: true,
    userId: null,
    lastLogin: "",
    alias: "",
    viewedIntro: false,
    viewedChat: false,
    defaultProfile: false,
    lastActive: "",
  };

  const mockProps = {
    simulations: mockSimulations,
    profile: mockProfile,
    onStartSimulation: vi.fn(),
    loadingSimulation: null,
    getRealRubricData: vi.fn(() => ({ attempts: [], highestScore: 0 })),
    scenarios: [],
    personas: [],
  };

  it("renders practice zone title and description", () => {
    render(<PracticeZone {...mockProps} />);

    expect(screen.getByText("Practice & Exploration")).toBeInTheDocument();
    expect(
      screen.getByText(/Hone your skills with these practice simulations/)
    ).toBeInTheDocument();
  });

  it("renders simulation cards for each practice simulation", () => {
    render(<PracticeZone {...mockProps} />);

    expect(screen.getByText("Practice Simulation 1")).toBeInTheDocument();
    expect(screen.getByText("Practice Simulation 2")).toBeInTheDocument();
  });

  it("does not render when no simulations", () => {
    const emptyProps = { ...mockProps, simulations: [] };
    const { container } = render(<PracticeZone {...emptyProps} />);

    expect(container.firstChild).toBeNull();
  });
});
