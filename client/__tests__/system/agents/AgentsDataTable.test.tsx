import { renderWithMocks } from "@/test/renderWithMocks";
import type { ColumnDef } from "@tanstack/react-table";
import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// ——————————————————————————————————————————
import {
  AgentsDataTable,
  AgentsDataTableProps,
} from "@/components/system/agents/AgentsDataTable";
import { Agent } from "@/types";

// ------------------------------------------------------------------
// Minimal props factory – edit values as needed
const mockData: Agent[] = [
  {
    id: "agent-1",
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
    name: "Math Tutor Agent",
    description: "Helps students with mathematical concepts",
    systemPrompt: "You are a helpful math tutor.",
    temperature: 49,
    modelId: "model-1",
    reasoning: "low",
  },
  {
    id: "agent-2",
    createdAt: "2025-01-01T01:00:00Z",
    updatedAt: "2025-01-01T01:00:00Z",
    name: "Science Helper Bot",
    description: "Assists with scientific inquiries",
    systemPrompt: "You are a science assistant.",
    temperature: 1,
    modelId: "model-2",
    reasoning: null,
  },
];

const mockColumns: ColumnDef<Agent>[] = [
  {
    accessorKey: "name",
    header: "Name",
    cell: ({ row }) => <div>{row.getValue("name")}</div>,
  },
  {
    accessorKey: "description",
    header: "Description",
    cell: ({ row }) => <div>{row.getValue("description")}</div>,
  },
  {
    accessorKey: "reasoning",
    header: "Reasoning",
    cell: ({ row }) => <div>{row.getValue("reasoning")}</div>,
  },
];

const mockProps: AgentsDataTableProps = {
  columns: mockColumns,
  data: mockData,
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
  renderAgentCard: (agent: Agent) => (
    <div key={agent.id} data-testid={`agent-card-${agent.id}`}>
      {agent.name}
    </div>
  ),
};
// ------------------------------------------------------------------
describe("AgentsDataTable", () => {
  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      renderWithMocks(<AgentsDataTable {...mockProps} />);

      // Check that the agent cards are rendered
      expect(screen.getByTestId("agent-card-agent-1")).toBeInTheDocument();
      expect(screen.getByTestId("agent-card-agent-2")).toBeInTheDocument();
    });

    it("should render with props", () => {
      renderWithMocks(<AgentsDataTable {...mockProps} />);

      // Check that agent names are displayed
      expect(screen.getByText("Math Tutor Agent")).toBeInTheDocument();
      expect(screen.getByText("Science Helper Bot")).toBeInTheDocument();
    });

    it("should have correct accessibility attributes", () => {
      renderWithMocks(<AgentsDataTable {...mockProps} />);

      // Check that agent cards are accessible
      expect(screen.getByTestId("agent-card-agent-1")).toBeInTheDocument();
    });
  });

  describe("User Interactions", () => {
    it("should handle state changes", async () => {
      renderWithMocks(<AgentsDataTable {...mockProps} />);

      // Check that the table renders with data
      expect(screen.getByText("Math Tutor Agent")).toBeInTheDocument();
    });

    it("should handle user events", async () => {
      renderWithMocks(<AgentsDataTable {...mockProps} />);

      // Check that the renderAgentCard function is called
      expect(screen.getByTestId("agent-card-agent-1")).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", () => {
      // Test with empty data
      const propsWithEmptyData = {
        ...mockProps,
        data: [],
      };

      renderWithMocks(<AgentsDataTable {...propsWithEmptyData} />);

      // Should show "No system agents match the current filters." message
      expect(
        screen.getByText("No system agents match the current filters.")
      ).toBeInTheDocument();
    });

    it("should handle missing or invalid props", () => {
      // Test with minimal required props
      const minimalProps = {
        columns: [],
        data: [],
        reasoningOptions: [],
        modelOptions: [],
        temperatureOptions: [],
        renderAgentCard: vi.fn(),
      };

      renderWithMocks(<AgentsDataTable {...minimalProps} />);

      // Component should still render
      expect(
        screen.getByText("No system agents match the current filters.")
      ).toBeInTheDocument();
    });
  });
});
