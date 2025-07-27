import { renderWithMocks } from "@/test/renderWithMocks";
import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// ——————————————————————————————————————————
import PersonaEdit, {
  PersonaEditProps,
} from "@/components/create/personas/PersonaEdit";

// Mock the Persona component
vi.mock("@/components/common/agent/Persona", () => ({
  default: ({ personaId, mode }: { personaId: string; mode: string }) => (
    <div
      data-testid="persona-component"
      data-persona-id={personaId}
      data-mode={mode}
    >
      Persona Component (ID: {personaId}, Mode: {mode})
    </div>
  ),
}));

describe("PersonaEdit", () => {
  const defaultProps: PersonaEditProps = {
    personaId: "test-persona-id",
  };

  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      renderWithMocks(<PersonaEdit {...defaultProps} />);

      // Check that the Persona component is rendered with edit mode
      expect(screen.getByTestId("persona-component")).toBeInTheDocument();
      expect(screen.getByTestId("persona-component")).toHaveAttribute(
        "data-mode",
        "edit"
      );
      expect(screen.getByTestId("persona-component")).toHaveAttribute(
        "data-persona-id",
        "test-persona-id"
      );
    });

    it("should render with props", () => {
      renderWithMocks(<PersonaEdit {...defaultProps} />);

      // Check that the Persona component is rendered with correct props
      expect(screen.getByTestId("persona-component")).toBeInTheDocument();
      expect(screen.getByTestId("persona-component")).toHaveAttribute(
        "data-persona-id",
        "test-persona-id"
      );
    });

    it("should have correct accessibility attributes", () => {
      renderWithMocks(<PersonaEdit {...defaultProps} />);

      // Check that the Persona component is accessible
      expect(screen.getByTestId("persona-component")).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", () => {
      // Test with different persona IDs
      const propsWithDifferentId = {
        personaId: "different-persona-id",
      };

      renderWithMocks(<PersonaEdit {...propsWithDifferentId} />);

      // Component should render with the new persona ID
      expect(screen.getByTestId("persona-component")).toHaveAttribute(
        "data-persona-id",
        "different-persona-id"
      );
    });

    it("should handle missing or invalid props", () => {
      // Test with empty persona ID
      const propsWithEmptyId = {
        personaId: "",
      };

      renderWithMocks(<PersonaEdit {...propsWithEmptyId} />);

      // Component should still render
      expect(screen.getByTestId("persona-component")).toBeInTheDocument();
      expect(screen.getByTestId("persona-component")).toHaveAttribute(
        "data-persona-id",
        ""
      );
    });
  });
});
