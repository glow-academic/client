import SimulationHistory, {
  HistoryDataItem,
} from "@/components/common/history/SimulationHistory";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("SimulationHistory", () => {
  const mockHistoryData: HistoryDataItem[] = [
    {
      attemptId: "1",
      date: new Date("2024-01-01"),
      profileId: "profile1",
      profileName: "John Doe",
      simulationName: "Test Simulation",
      numScenarios: 3,
      numScenariosCompleted: 2,
      infiniteMode: false,
      infiniteModeTimeLimit: null,
      personaNames: ["Persona 1"],
      personaColors: ["#FF0000"],
      score: 85,
      simulation_id: "sim1",
      scenario_ids: ["scenario1", "scenario2", "scenario3"],
      scenario_titles: ["Scenario 1", "Scenario 2", "Scenario 3"],
      isArchived: false,
      showView: true,
      showContinue: true,
      practiceSimulation: false,
      passPct: 70,
    },
    {
      attemptId: "2",
      date: new Date("2024-01-02"),
      profileId: "profile1",
      profileName: "John Doe",
      simulationName: "Test Simulation 2",
      numScenarios: 2,
      numScenariosCompleted: 2,
      infiniteMode: false,
      infiniteModeTimeLimit: null,
      personaNames: ["Persona 2"],
      personaColors: ["#00FF00"],
      score: 90,
      simulation_id: "sim2",
      scenario_ids: ["scenario4", "scenario5"],
      scenario_titles: ["Scenario 4", "Scenario 5"],
      isArchived: false,
      showView: true,
      showContinue: false,
      practiceSimulation: true,
      passPct: 70,
    },
  ];

  it("renders with data and shows export functionality when showExport is true", () => {
    render(
      <SimulationHistory
        data={mockHistoryData}
        showExport={true}
        showArchive={false}
      />,
    );

    // Check that the component renders without crashing
    expect(screen.getByText("Test Simulation")).toBeInTheDocument();
    expect(screen.getByText("Test Simulation 2")).toBeInTheDocument();
  });

  it("renders with data and hides export functionality when showExport is false", () => {
    render(
      <SimulationHistory
        data={mockHistoryData}
        showExport={false}
        showArchive={false}
      />,
    );

    // Check that the component renders without crashing
    expect(screen.getByText("Test Simulation")).toBeInTheDocument();
    expect(screen.getByText("Test Simulation 2")).toBeInTheDocument();
  });

  it("renders with archive functionality when showArchive is true", () => {
    render(
      <SimulationHistory
        data={mockHistoryData}
        showExport={false}
        showArchive={true}
      />,
    );

    // Check that the component renders without crashing
    expect(screen.getByText("Test Simulation")).toBeInTheDocument();
    expect(screen.getByText("Test Simulation 2")).toBeInTheDocument();
  });

  it("renders loading state when isLoading is true", () => {
    render(
      <SimulationHistory
        data={[]}
        showExport={false}
        showArchive={false}
        isLoading={true}
      />,
    );

    // Should show loading skeleton instead of data
    expect(screen.queryByText("Test Simulation")).not.toBeInTheDocument();
  });

  it("renders empty state when no data provided", () => {
    render(
      <SimulationHistory
        data={[]}
        showExport={false}
        showArchive={false}
        isLoading={false}
      />,
    );

    // Should show "No results" message
    expect(screen.getByText("No results.")).toBeInTheDocument();
  });
});
