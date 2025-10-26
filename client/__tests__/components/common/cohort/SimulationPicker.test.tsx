/**
 * SimulationPicker.test.tsx
 * Tests for SimulationPicker component
 * @AshokSaravanan222 & @siladiea
 * 10/25/2025
 */

import { SimulationPicker } from "@/components/common/cohort/SimulationPicker";
import type { SimulationMappingItem } from "@/lib/api/v2/schemas/base";
import { fireEvent, render, screen, waitFor } from "@/test/custom-render";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the mutation observer hook
vi.mock("@/hooks/use-mutation-observer", () => ({
  useMutationObserver: vi.fn(),
}));

const mockSimulationMapping: Record<string, SimulationMappingItem> = {
  "1": {
    name: "Basic Communication",
    description: "A basic communication simulation",
    time_limit: 30,
  },
  "2": {
    name: "Advanced Leadership",
    description: "Advanced leadership training simulation",
    time_limit: 60,
  },
  "3": {
    name: "Practice Session",
    description: "Practice simulation for beginners",
    time_limit: null,
  },
};

const mockValidIds = ["1", "2", "3"];

describe("SimulationPicker", () => {
  const defaultProps = {
    simulationMapping: mockSimulationMapping,
    validSimulationIds: mockValidIds,
    selectedSimulationIds: [],
    onSelect: vi.fn(),
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
    render(
      <SimulationPicker {...defaultProps} selectedSimulationIds={["1", "2"]} />
    );

    expect(screen.getByText("2 simulations selected")).toBeInTheDocument();
  });

  it("shows single simulation title when one is selected", () => {
    render(
      <SimulationPicker {...defaultProps} selectedSimulationIds={["1"]} />
    );

    expect(screen.getByText("Basic Communication")).toBeInTheDocument();
  });

  it("shows all simulations in the dropdown", async () => {
    render(<SimulationPicker {...defaultProps} />);

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

    expect(onSelect).toHaveBeenCalledWith(["1"]);
  });

  it("removes simulation from selection when clicked again in multi-select mode", async () => {
    const onSelect = vi.fn();

    render(
      <SimulationPicker
        {...defaultProps}
        onSelect={onSelect}
        selectedSimulationIds={["1"]}
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
    render(
      <SimulationPicker
        {...defaultProps}
        selectedSimulationIds={["1"]}
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

    render(
      <SimulationPicker
        {...defaultProps}
        onSelect={onSelect}
        selectedSimulationIds={["1", "2"]}
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

  it("displays descriptions correctly in list items", async () => {
    render(<SimulationPicker {...defaultProps} />);

    const button = screen.getByRole("combobox", {
      name: /select simulations/i,
    });
    fireEvent.click(button);

    await waitFor(() => {
      expect(
        screen.getByText("A basic communication simulation")
      ).toBeInTheDocument();
      expect(
        screen.getByText("Advanced leadership training simulation")
      ).toBeInTheDocument();
    });
  });

  it("closes popover in single-select mode after selection", async () => {
    const onSelect = vi.fn();
    render(
      <SimulationPicker
        {...defaultProps}
        onSelect={onSelect}
        multiSelect={false}
      />
    );

    const button = screen.getByRole("combobox", {
      name: /select simulations/i,
    });
    fireEvent.click(button);

    await waitFor(() => {
      const simulationItems = screen.getAllByText("Basic Communication");
      const dropdownItem = simulationItems.find(
        (item) => item.closest('[role="option"]') || item.closest("[cmdk-item]")
      );
      if (dropdownItem) {
        fireEvent.click(dropdownItem);
      }
    });

    expect(onSelect).toHaveBeenCalledWith(["1"]);
  });

  it("sorts simulations alphabetically by name", async () => {
    render(<SimulationPicker {...defaultProps} />);

    const button = screen.getByRole("combobox", {
      name: /select simulations/i,
    });
    fireEvent.click(button);

    await waitFor(() => {
      const items = screen.getAllByText(/Communication|Leadership|Session/);
      // Should be sorted: Advanced Leadership, Basic Communication, Practice Session
      expect(items[0]?.textContent).toContain("Advanced Leadership");
      expect(items[1]?.textContent).toContain("Basic Communication");
      expect(items[2]?.textContent).toContain("Practice Session");
    });
  });

  it("removes individual chip when X button is clicked", () => {
    const onSelect = vi.fn();
    render(
      <SimulationPicker
        {...defaultProps}
        onSelect={onSelect}
        selectedSimulationIds={["1", "2"]}
        hideSelectedChips={false}
      />
    );

    const removeButton = screen.getByRole("button", {
      name: /remove basic communication/i,
    });
    fireEvent.click(removeButton);

    expect(onSelect).toHaveBeenCalledWith(["2"]);
  });
});
