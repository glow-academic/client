import AgentEdit from "@/components/create/agents/AgentEdit";
import { renderWithProviders } from "@/mocks/utils";
import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock external dependencies

// Mock API calls
vi.mock("@/utils/queries/agents/get-agent", () => ({
  getAgent: vi.fn(),
}));
import { getAgent } from "@/utils/queries/agents/get-agent";

vi.mock("@/utils/mutations/agents/update-agent", () => ({
  updateAgent: vi.fn(),
}));

// Mock toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("AgentEdit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const agent = {
      id: "test-agent-id",
      name: "Edit Agent",
      description: "desc",
      systemPrompt: "prompt",
      agentType: "student" as const,
      temperature: 0,
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-01T00:00:00Z",
    };
    vi.mocked(getAgent).mockResolvedValue(agent);
  });

  const renderComponent = () => renderWithProviders(<AgentEdit agentId="test-agent-id" />);

  describe("Rendering", () => {
    it("shows update button after load", async () => {
      renderComponent();
      const button = await screen.findByRole("button", { name: /update agent/i });
      expect(button).toBeInTheDocument();
    });
  });

  describe("Integration", () => {
    it("should integrate properly with the Agent component", async () => {
      renderComponent();
      const button = await screen.findByRole("button", { name: /update agent/i });
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
 * This component now serves as a simple wrapper around the general Agent component,
 * configured for edit mode with the provided agentId.
 */
