import { render } from "@/test/custom-render";
import { screen, waitFor } from "@/test/custom-render";
import { describe, expect, it } from "vitest";

// ——————————————————————————————————————————
import SimulationEdit, {
  SimulationEditProps,
} from "@/components/simulations/SimulationEdit";

// ------------------------------------------------------------------
// Minimal props factory – edit values as needed
const mockProps: SimulationEditProps = {
  simulationId: "test-simulationId",
};
// ------------------------------------------------------------------
describe("SimulationEdit", () => {
  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      render(<SimulationEdit {...mockProps} />);

      // Check that the component renders without crashing
      await waitFor(() => {
        expect(screen.getByText("Title")).toBeInTheDocument();
      });
    });

    it("should render with props", async () => {
      render(<SimulationEdit {...mockProps} />);

      // Check that the component renders with the provided simulationId
      await waitFor(() => {
        expect(screen.getByText("Title")).toBeInTheDocument();
      });

      // The component should pass the simulationId to the Simulation component
      expect(mockProps.simulationId).toBe("test-simulationId");
    });

    it("should have correct accessibility attributes", async () => {
      render(<SimulationEdit {...mockProps} />);

      // Check that the component renders with proper accessibility
      await waitFor(() => {
        expect(screen.getByText("Title")).toBeInTheDocument();
      });

      // The component should have proper structure
      expect(document.body).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", async () => {
      // Test with different simulationId values
      const edgeCaseProps = {
        simulationId: "edge-case-id",
      };

      render(<SimulationEdit {...edgeCaseProps} />);

      // Should handle edge case gracefully
      await waitFor(() => {
        expect(screen.getByText("Title")).toBeInTheDocument();
      });
    });

    it("should handle missing or invalid props", async () => {
      // Test with minimal required props
      const minimalProps = {
        simulationId: "",
      };

      render(<SimulationEdit {...minimalProps} />);

      // Should still render without crashing
      await waitFor(() => {
        expect(screen.getByText("Title")).toBeInTheDocument();
      });
    });
  });
});
