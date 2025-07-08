import AgentEdit from "@/components/management/agents/AgentEdit";
import { renderWithProviders } from "@/mocks/utils";
import { getAgent } from "@/utils/queries/agents/get-agent";
import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the getAgent function
vi.mock("@/utils/queries/agents/get-agent", () => ({
  getAgent: vi.fn(),
}));

// Mock the correct Agent component path (common/agent, not create/agents)
vi.mock("@/components/common/agent/Agent", () => ({
  default: ({ agentId, mode }: { agentId?: string; mode?: string }) => (
    <div data-testid="agent-component">
      <h1>Agent Form</h1>
      <p>Agent ID: {agentId}</p>
      <p>Mode: {mode}</p>
      <button>Update Agent</button>
    </div>
  ),
}));

describe("AgentEdit", () => {
  const mockAgent = {
    id: "test-agent-id",
    name: "Edit Agent",
    description: "desc",
    systemPrompt: "prompt",
    agentType: "student" as const,
    temperature: 0,
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
    defaultAgent: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock the function to return our test agent
    vi.mocked(getAgent).mockResolvedValue(mockAgent);
  });

  const renderComponent = () =>
    renderWithProviders(<AgentEdit agentId="test-agent-id" />);

  describe("Rendering", () => {
    it("shows update button after load", async () => {
      renderComponent();

      // Should render the agent component
      expect(screen.getByTestId("agent-component")).toBeInTheDocument();

      const button = await screen.findByRole("button", {
        name: /update agent/i,
      });
      expect(button).toBeInTheDocument();
    });
  });

  describe("Integration", () => {
    it("should integrate properly with the Agent component", async () => {
      renderComponent();

      // Should pass the correct props to the Agent component
      expect(screen.getByText("Agent ID: test-agent-id")).toBeInTheDocument();
      expect(screen.getByText("Mode: edit")).toBeInTheDocument();

      const button = await screen.findByRole("button", {
        name: /update agent/i,
      });
      expect(button).toBeInTheDocument();
    });
  });
});

/*
 * Component Analysis for AgentEdit:
 * Path: management/agents/AgentEdit.tsx
 *
 * Features detected:
 * - Default export: true
 * - Named exports: None
 * - Has props: true (agentId required)
 * - Props interface: { agentId: string }
 * - Client component: false (wrapper component)
 * - Uses hooks: None (delegates to Agent component)
 * - Uses router: false (delegates to Agent component)
 * - Has API calls: false (delegates to Agent component)
 * - Has form handling: false (delegates to Agent component)
 * - Uses state: false (delegates to Agent component)
 * - Uses effects: false (delegates to Agent component)
 * - Uses context: false
 *
 * Tests implemented:
 * - Proper mocking of getAgent function
 * - Mock common/agent/Agent component to avoid deep dependencies
 * - Validation of component rendering
 * - Integration test for prop passing (agentId and mode)
 * - Button presence validation
 */
