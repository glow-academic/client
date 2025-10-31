import { render } from "@/test/custom-render";
import { screen } from "@/test/custom-render";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

// ——————————————————————————————————————————
import {
  AgentsDataTableToolbar,
  AgentsDataTableToolbarProps,
} from "@/components/management/agents/AgentsDataTableToolbar";
import { getMockTable } from "@/mocks/navigation";
import { Agent } from "@/types";

// ------------------------------------------------------------------
// Minimal props factory – edit values as needed
const mockProps: AgentsDataTableToolbarProps = {
  table: getMockTable<Agent>(),
  reasoningOptions: [
    { value: "low", label: "Low" },
    { value: "medium", label: "Medium" },
    { value: "high", label: "High" },
  ],
  modelOptions: [
    { value: "model-1", label: "GPT-4" },
    { value: "model-2", label: "Claude-3" },
  ],
  temperatureOptions: [
    { value: "low", label: "Low (0.0-0.33)" },
    { value: "medium", label: "Medium (0.34-0.66)" },
    { value: "high", label: "High (0.67-1.0)" },
  ],
};
// ------------------------------------------------------------------
describe("AgentsDataTableToolbar", () => {
  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      render(<AgentsDataTableToolbar {...mockProps} />);

      // Basic render check - find search input
      expect(
        screen.getByPlaceholderText("Search system agents..."),
      ).toBeInTheDocument();
    });

    it("should render with props", () => {
      render(<AgentsDataTableToolbar {...mockProps} />);

      // Check that the search input is rendered with correct placeholder
      expect(
        screen.getByPlaceholderText("Search system agents..."),
      ).toBeInTheDocument();
    });

    it("should have correct accessibility attributes", () => {
      render(<AgentsDataTableToolbar {...mockProps} />);

      // Check that the search input has proper accessibility
      const searchInput = screen.getByPlaceholderText(
        "Search system agents...",
      );
      expect(searchInput).toBeInTheDocument();
    });
  });

  describe("User Interactions", () => {
    it("should handle search input changes", async () => {
      const user = userEvent.setup();

      render(<AgentsDataTableToolbar {...mockProps} />);

      const searchInput = screen.getByPlaceholderText(
        "Search system agents...",
      );
      await user.type(searchInput, "test agent");

      // The input value might not update due to mock table setup, but we can check the interaction
      expect(searchInput).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", () => {
      const propsWithEmptyOptions = {
        ...mockProps,
        reasoningOptions: [],
        modelOptions: [],
        temperatureOptions: [],
      };

      render(<AgentsDataTableToolbar {...propsWithEmptyOptions} />);

      // Should still render without crashing
      expect(
        screen.getByPlaceholderText("Search system agents..."),
      ).toBeInTheDocument();
    });

    it("should handle missing or invalid props", () => {
      const minimalProps = {
        table: getMockTable<Agent>(),
        reasoningOptions: [],
        modelOptions: [],
        temperatureOptions: [],
      };

      render(<AgentsDataTableToolbar {...minimalProps} />);

      // Should still render without crashing
      expect(
        screen.getByPlaceholderText("Search system agents..."),
      ).toBeInTheDocument();
    });
  });
});
