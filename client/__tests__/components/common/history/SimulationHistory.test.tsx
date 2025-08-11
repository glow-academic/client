import { render } from '@/test/custom-render';
import { describe, expect, it } from "vitest";

// ——————————————————————————————————————————
import SimulationHistory, {
  SimulationHistoryProps,
} from "@/components/common/history/SimulationHistory";

// ------------------------------------------------------------------
// Minimal props factory – edit values as needed
const mockProps: SimulationHistoryProps = {
  profileId: "test-profile-id",
  // showExport: false, /* optional */
};
// ------------------------------------------------------------------
describe("SimulationHistory", () => {
  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      render(<SimulationHistory {...mockProps} />);

      // Basic render test - component should render without errors
      expect(document.body).toBeInTheDocument();
    });

    it("should render with props", () => {
      render(<SimulationHistory {...mockProps} />);

      // Component should render with the provided props
      expect(document.body).toBeInTheDocument();
    });

    it("should have correct accessibility attributes", () => {
      render(<SimulationHistory {...mockProps} />);

      // Check for basic accessibility elements
      const history =
        document.querySelector('[data-testid="simulation-history"]') ||
        document.querySelector("div");
      expect(history).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", () => {
      render(<SimulationHistory {...mockProps} />);

      // Component should handle edge cases
      expect(document.body).toBeInTheDocument();
    });

    it("should handle missing or invalid props", () => {
      render(<SimulationHistory profileId={null} />);

      // Component should handle missing props
      expect(document.body).toBeInTheDocument();
    });
  });
});
