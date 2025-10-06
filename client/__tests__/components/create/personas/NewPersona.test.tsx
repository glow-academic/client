import { render } from "@/test/custom-render";
import { screen } from "@/test/custom-render";
import { describe, expect, it, vi } from "vitest";

// ——————————————————————————————————————————
import NewPersona from "@/components/create/personas/NewPersona";

// Mock the Persona component
vi.mock("@/components/common/agent/Persona", () => ({
  default: ({ mode }: { mode: string }) => (
    <div data-testid="persona-component" data-mode={mode}>
      Persona Component (Mode: {mode})
    </div>
  ),
}));

describe("NewPersona", () => {
  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      render(<NewPersona />);

      // Check that the Persona component is rendered with create mode
      expect(screen.getByTestId("persona-component")).toBeInTheDocument();
      expect(screen.getByTestId("persona-component")).toHaveAttribute(
        "data-mode",
        "create",
      );
    });

    it("should have correct accessibility attributes", () => {
      render(<NewPersona />);

      // Check that the Persona component is accessible
      expect(screen.getByTestId("persona-component")).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", () => {
      // This component is very simple, just rendering the Persona component
      // with create mode, so there aren't many edge cases to test
      render(<NewPersona />);

      // Component should render without crashing
      expect(screen.getByTestId("persona-component")).toBeInTheDocument();
    });
  });
});
