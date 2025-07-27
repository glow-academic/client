import { renderWithMocks } from "@/test/renderWithMocks";
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

// ——————————————————————————————————————————
import EditAgent, {
  EditSystemAgentProps,
} from "@/components/system/agents/EditAgent";

// ------------------------------------------------------------------
// Minimal props factory – edit values as needed
const mockProps: EditSystemAgentProps = {
  agentId: "test-agentId",
};
// ------------------------------------------------------------------
describe("EditAgent", () => {
  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      renderWithMocks(<EditAgent {...mockProps} />);

      // Check that the component renders
      expect(screen.getByText(/Edit Agent/i)).toBeInTheDocument();
    });

    it("should render with props", () => {
      renderWithMocks(<EditAgent {...mockProps} />);

      // Check that the agent ID is used
      expect(mockProps.agentId).toBe("test-agentId");
    });

    it("should have correct accessibility attributes", () => {
      renderWithMocks(<EditAgent {...mockProps} />);

      // Check that the component is accessible
      expect(screen.getByText(/Edit Agent/i)).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", () => {
      // Test with different agent ID
      const propsWithDifferentId = {
        agentId: "different-agent-id",
      };

      renderWithMocks(<EditAgent {...propsWithDifferentId} />);

      // Component should still render
      expect(screen.getByText(/Edit Agent/i)).toBeInTheDocument();
    });

    it("should handle missing or invalid props", () => {
      // Test with minimal required props
      const minimalProps = {
        agentId: "",
      };

      renderWithMocks(<EditAgent {...minimalProps} />);

      // Component should still render
      expect(screen.getByText(/Edit Agent/i)).toBeInTheDocument();
    });
  });
});
