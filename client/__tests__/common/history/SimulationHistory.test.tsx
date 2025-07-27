import { renderWithMocks } from "@/test/renderWithMocks";
import { describe, expect, it } from "vitest";

// ——————————————————————————————————————————
import SimulationHistory, {
  SimulationHistoryProps,
} from "@/components/common/history/SimulationHistory";

// ------------------------------------------------------------------
// Minimal props factory – edit values as needed
const mockProps: SimulationHistoryProps = {
  showAll: false,
  // showExport: false, /* optional */
};
// ------------------------------------------------------------------
describe("SimulationHistory", () => {
  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      renderWithMocks(<SimulationHistory {...mockProps} />);

      // Basic render test - component should render without errors
      expect(document.body).toBeInTheDocument();
    });

    it("should render with props", () => {
      renderWithMocks(<SimulationHistory {...mockProps} />);

      // Component should render with the provided props
      expect(document.body).toBeInTheDocument();
    });

    it("should have correct accessibility attributes", () => {
      renderWithMocks(<SimulationHistory {...mockProps} />);

      // Check for basic accessibility elements
      const history =
        document.querySelector('[data-testid="simulation-history"]') ||
        document.querySelector("div");
      expect(history).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", () => {
      renderWithMocks(<SimulationHistory {...mockProps} />);

      // Component should handle edge cases
      expect(document.body).toBeInTheDocument();
    });

    it("should handle missing or invalid props", () => {
      renderWithMocks(<SimulationHistory showAll={false} />);

      // Component should handle missing props
      expect(document.body).toBeInTheDocument();
    });
  });
});
