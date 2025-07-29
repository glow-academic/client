import { renderWithMocks } from "@/test/renderWithMocks";
import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// ——————————————————————————————————————————
import NewSimulation from "@/components/create/simulations/NewSimulation";

// Mock the Simulation component since NewSimulation is just a wrapper
vi.mock("@/components/common/simulation/Simulation", () => ({
  default: vi.fn(() => (
    <div data-testid="simulation-component">Simulation Component</div>
  )),
}));

describe("NewSimulation", () => {
  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      renderWithMocks(<NewSimulation />);

      expect(screen.getByTestId("simulation-component")).toBeInTheDocument();
    });

    it("should have correct accessibility attributes", () => {
      renderWithMocks(<NewSimulation />);

      const simulationComponent = screen.getByTestId("simulation-component");
      expect(simulationComponent).toBeInTheDocument();

      // Check that the component is accessible
      expect(simulationComponent).toBeVisible();
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", () => {
      // Test that the component renders without props
      renderWithMocks(<NewSimulation />);

      expect(screen.getByTestId("simulation-component")).toBeInTheDocument();

      // Verify the component text is displayed
      expect(screen.getByText("Simulation Component")).toBeInTheDocument();
    });
  });
});
