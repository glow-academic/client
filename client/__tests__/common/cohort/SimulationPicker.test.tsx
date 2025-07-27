/**
 * SimulationPicker.test.tsx
 * Tests for SimulationPicker component
 * @AshokSaravanan222 & @siladiea
 * 07/20/2025
 */

import {
  Simulation,
  SimulationPicker,
} from "@/components/common/cohort/SimulationPicker";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the mutation observer hook
vi.mock("@/hooks/use-mutation-observer", () => ({
  useMutationObserver: vi.fn(),
}));

const mockSimulations: Simulation[] = [
  {
    id: "1",
    title: "Basic Communication",
    description: "A basic communication simulation",
    timeLimit: 30,
    active: true,
    defaultSimulation: false,
    practiceSimulation: false,
  },
  {
    id: "2",
    title: "Advanced Leadership",
    description: "Advanced leadership training simulation",
    timeLimit: 60,
    active: true,
    defaultSimulation: true,
    practiceSimulation: false,
  },
  {
    id: "3",
    title: "Practice Session",
    description: "Practice simulation for beginners",
    timeLimit: 0, // Use 0 instead of undefined for no time limit
    active: false,
    defaultSimulation: false,
    practiceSimulation: true,
  },
];

describe("SimulationPicker", () => {
  const defaultProps = {
    simulations: mockSimulations,
    onSelect: vi.fn(),
    selectedSimulations: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders with default props", () => {
    render(<SimulationPicker {...defaultProps} />);

    expect(screen.getByText("Simulations")).toBeInTheDocument();
    expect(
      screen.getByRole("combobox", { name: /select simulations/i })
    ).toBeInTheDocument();
  });

  it("shows placeholder when no simulations are selected", () => {
    render(<SimulationPicker {...defaultProps} />);

    expect(screen.getByText("Select simulations...")).toBeInTheDocument();
  });

  it("shows selected simulation count when multiple are selected", () => {
    const selectedSims = [mockSimulations[0]!, mockSimulations[1]!];
    render(
      <SimulationPicker {...defaultProps} selectedSimulations={selectedSims} />
    );

    expect(screen.getByText("2 simulations selected")).toBeInTheDocument();
  });

  it("shows single simulation title when one is selected", () => {
    const selectedSims = [mockSimulations[0]!];
    render(
      <SimulationPicker {...defaultProps} selectedSimulations={selectedSims} />
    );

    expect(screen.getByText("Basic Communication")).toBeInTheDocument();
  });

  it("filters out inactive simulations when showOnlyActive is true", async () => {
    render(<SimulationPicker {...defaultProps} showOnlyActive={true} />);

    const button = screen.getByRole("combobox", {
      name: /select simulations/i,
    });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText("Basic Communication")).toBeInTheDocument();
      expect(screen.getByText("Advanced Leadership")).toBeInTheDocument();
      expect(screen.queryByText("Practice Session")).not.toBeInTheDocument();
    });
  });

  it("shows all simulations when showOnlyActive is false", async () => {
    render(<SimulationPicker {...defaultProps} showOnlyActive={false} />);

    const button = screen.getByRole("combobox", {
      name: /select simulations/i,
    });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText("Basic Communication")).toBeInTheDocument();
      expect(screen.getByText("Advanced Leadership")).toBeInTheDocument();
      expect(screen.getByText("Practice Session")).toBeInTheDocument();
    });
  });

  it("calls onSelect when a simulation is clicked", async () => {
    const onSelect = vi.fn();
    render(<SimulationPicker {...defaultProps} onSelect={onSelect} />);

    const button = screen.getByRole("combobox", {
      name: /select simulations/i,
    });
    fireEvent.click(button);

    await waitFor(() => {
      const simulationItems = screen.getAllByText("Basic Communication");
      // Click the one in the dropdown (not the button)
      const dropdownItem = simulationItems.find(
        (item) => item.closest('[role="option"]') || item.closest("[cmdk-item]")
      );
      if (dropdownItem) {
        fireEvent.click(dropdownItem);
      }
    });

    expect(onSelect).toHaveBeenCalledWith([mockSimulations[0]]);
  });

  it("removes simulation from selection when clicked again", async () => {
    const onSelect = vi.fn();
    const selectedSims = [mockSimulations[0]!];

    render(
      <SimulationPicker
        {...defaultProps}
        onSelect={onSelect}
        selectedSimulations={selectedSims}
      />
    );

    const button = screen.getByRole("combobox", {
      name: /select simulations/i,
    });
    fireEvent.click(button);

    await waitFor(() => {
      const simulationItems = screen.getAllByText("Basic Communication");
      // Click the one in the dropdown (not the button)
      const dropdownItem = simulationItems.find(
        (item) => item.closest('[role="option"]') || item.closest("[cmdk-item]")
      );
      if (dropdownItem) {
        fireEvent.click(dropdownItem);
      }
    });

    expect(onSelect).toHaveBeenCalledWith([]);
  });

  it("shows selected chips when hideSelectedChips is false", () => {
    const selectedSims = [mockSimulations[0]!];

    render(
      <SimulationPicker
        {...defaultProps}
        selectedSimulations={selectedSims}
        hideSelectedChips={false}
      />
    );

    expect(screen.getAllByText("Basic Communication")[0]).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /remove basic communication/i })
    ).toBeInTheDocument();
  });

  it("calls onSelect with empty array when clear all is clicked", async () => {
    const onSelect = vi.fn();
    const selectedSims = [mockSimulations[0]!, mockSimulations[1]!];

    render(
      <SimulationPicker
        {...defaultProps}
        onSelect={onSelect}
        selectedSimulations={selectedSims}
      />
    );

    const button = screen.getByRole("combobox", {
      name: /select simulations/i,
    });
    fireEvent.click(button);

    await waitFor(() => {
      const clearAllButton = screen.getByText("Clear All");
      fireEvent.click(clearAllButton);
    });

    expect(onSelect).toHaveBeenCalledWith([]);
  });

  it("displays time limit badges correctly", async () => {
    render(<SimulationPicker {...defaultProps} showOnlyActive={false} />);

    const button = screen.getByRole("combobox", {
      name: /select simulations/i,
    });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText("30m")).toBeInTheDocument();
      expect(screen.getByText("1h")).toBeInTheDocument();
      expect(screen.getByText("No limit")).toBeInTheDocument();
    });
  });

  it("displays simulation type badges correctly", async () => {
    render(<SimulationPicker {...defaultProps} showOnlyActive={false} />);

    const button = screen.getByRole("combobox", {
      name: /select simulations/i,
    });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText("Default")).toBeInTheDocument();
      expect(screen.getByText("Practice")).toBeInTheDocument();
    });
  });
});
