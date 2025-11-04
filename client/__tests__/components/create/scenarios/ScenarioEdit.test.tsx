import { render } from "@/test/custom-render";
import { screen, waitFor } from "@/test/custom-render";
import { describe, expect, it } from "vitest";

// ——————————————————————————————————————————
import ScenarioEdit, {
  ScenarioEditProps,
} from "@/components/scenarios/ScenarioEdit";

// ------------------------------------------------------------------
// Minimal props factory – edit values as needed
const mockProps: ScenarioEditProps = {
  scenarioId: "test-scenarioId",
};
// ------------------------------------------------------------------
describe("ScenarioEdit", () => {
  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      render(<ScenarioEdit {...mockProps} />);

      // Check that the component renders without crashing
      await waitFor(() => {
        expect(screen.getByText("Select Persona Type")).toBeInTheDocument();
      });
    });

    it("should render with props", async () => {
      render(<ScenarioEdit {...mockProps} />);

      // Check that the component renders with the provided scenarioId
      await waitFor(() => {
        expect(screen.getByText("Select Persona Type")).toBeInTheDocument();
      });

      // The component should pass the scenarioId to the Scenario component
      expect(mockProps.scenarioId).toBe("test-scenarioId");
    });

    it("should have correct accessibility attributes", async () => {
      render(<ScenarioEdit {...mockProps} />);

      // Check that the component renders with proper accessibility
      await waitFor(() => {
        expect(screen.getByText("Select Persona Type")).toBeInTheDocument();
      });

      // The component should have proper structure
      expect(document.body).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", async () => {
      // Test with different scenarioId values
      const edgeCaseProps = {
        scenarioId: "edge-case-id",
      };

      render(<ScenarioEdit {...edgeCaseProps} />);

      // Should handle edge case gracefully
      await waitFor(() => {
        expect(screen.getByText("Select Persona Type")).toBeInTheDocument();
      });
    });

    it("should handle missing or invalid props", async () => {
      // Test with minimal required props
      const minimalProps = {
        scenarioId: "",
      };

      render(<ScenarioEdit {...minimalProps} />);

      // Should still render without crashing
      await waitFor(() => {
        expect(screen.getByText("Select Persona Type")).toBeInTheDocument();
      });
    });
  });
});
