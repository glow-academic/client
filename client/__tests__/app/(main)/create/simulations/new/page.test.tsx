import { renderWithMocks } from "@/test/renderWithMocks";
import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// Mock NewSimulation component
vi.mock("@/components/create/simulations/NewSimulation", () => ({
  __esModule: true,
  default: () => (
    <div data-testid="new-simulation-component">New Simulation Component</div>
  ),
}));

import NewSimulationPage, {
  metadata,
} from "@/app/(main)/create/simulations/new/page";

describe("NewSimulationPage", () => {
  it("renders without crashing", () => {
    renderWithMocks(<NewSimulationPage />);
    expect(screen.getByTestId("new-simulation-component")).toBeInTheDocument();
    expect(screen.getByText("New Simulation Component")).toBeInTheDocument();
  });

  it("exports correct metadata", () => {
    expect(metadata).toBeDefined();
    expect(metadata.title).toBe("New Simulation");
    expect(metadata.description).toContain("New simulation creation page");
  });

  it("renders the NewSimulation component inside a wrapper", () => {
    renderWithMocks(<NewSimulationPage />);
    const wrapper = screen.getByTestId(
      "new-simulation-component"
    ).parentElement;
    expect(wrapper).toHaveClass("space-y-6");
  });
});
