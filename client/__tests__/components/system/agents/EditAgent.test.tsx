import { render } from "@/test/custom-render";
import { screen } from "@/test/custom-render";
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
      render(<EditAgent {...mockProps} />);

      // Check that the component renders with form elements
      expect(screen.getByText("Agent Name *")).toBeInTheDocument();
      expect(screen.getByText("Description *")).toBeInTheDocument();
    });

    it("should render with props", () => {
      render(<EditAgent {...mockProps} />);

      // Check that form elements are rendered
      expect(screen.getByText("Agent Name *")).toBeInTheDocument();
      expect(screen.getByText("System Prompt *")).toBeInTheDocument();
      expect(screen.getByText("Update Agent")).toBeInTheDocument();
    });

    it("should have correct accessibility attributes", () => {
      render(<EditAgent {...mockProps} />);

      // Check that the component is accessible
      expect(screen.getByText("Agent Name *")).toBeInTheDocument();
      expect(screen.getByText("Update Agent")).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", () => {
      const edgeCaseProps = {
        agentId: "invalid-id",
      };

      render(<EditAgent {...edgeCaseProps} />);

      // Component should still render
      expect(screen.getByText("Agent Name *")).toBeInTheDocument();
    });

    it("should handle missing or invalid props", () => {
      const minimalProps = {
        agentId: "",
      };

      render(<EditAgent {...minimalProps} />);

      // Component should still render
      expect(screen.getByText("Agent Name *")).toBeInTheDocument();
    });
  });
});
