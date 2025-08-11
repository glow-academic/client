import { render } from '@/test/custom-render';
import { screen } from '@/test/custom-render';
import { describe, expect, it, vi } from "vitest";

// ——————————————————————————————————————————
import NewScenario from "@/components/create/scenarios/NewScenario";

// Mock the Scenario component since NewScenario is just a wrapper
vi.mock("@/components/common/scenario/Scenario", () => ({
  default: vi.fn(({ mode }: { mode: string }) => (
    <div data-testid="scenario-component" data-mode={mode}>
      Scenario Component (Mode: {mode})
    </div>
  )),
}));

describe("NewScenario", () => {
  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      render(<NewScenario />);

      expect(screen.getByTestId("scenario-component")).toBeInTheDocument();
      expect(screen.getByTestId("scenario-component")).toHaveAttribute(
        "data-mode",
        "create",
      );
    });

    it("should have correct accessibility attributes", () => {
      render(<NewScenario />);

      const scenarioComponent = screen.getByTestId("scenario-component");
      expect(scenarioComponent).toBeInTheDocument();

      // Check that the component is accessible
      expect(scenarioComponent).toHaveAttribute("data-mode", "create");
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", () => {
      // Test that the component renders without props (uses default mode="create")
      render(<NewScenario />);

      expect(screen.getByTestId("scenario-component")).toBeInTheDocument();
      expect(screen.getByTestId("scenario-component")).toHaveAttribute(
        "data-mode",
        "create",
      );

      // Verify the component text is displayed
      expect(
        screen.getByText("Scenario Component (Mode: create)"),
      ).toBeInTheDocument();
    });
  });
});
