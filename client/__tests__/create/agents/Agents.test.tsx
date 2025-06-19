import Agents from "@/components/create/agents/Agents";
import { renderWithProviders, routerMock } from "@/mocks/utils";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/utils/queries/agents/get-all-agents", () => ({
  getAllAgents: vi.fn(),
}));
vi.mock("@/utils/mutations/agents/delete-agent", () => ({
  deleteAgent: vi.fn(),
}));

import { getAllAgents } from "@/utils/queries/agents/get-all-agents";
import { deleteAgent } from "@/utils/mutations/agents/delete-agent";

const mockAgents = [
  {
    id: "agent1",
    name: "Helpful Assistant",
    description: "A helpful AI assistant for students",
    agentType: "student" as const,
    systemPrompt: "You are a helpful assistant.",
    temperature: 0.7,
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
  },
  {
    id: "agent2",
    name: "Strict Teacher",
    description: "A strict but fair teaching assistant",
    agentType: "ta" as const,
    systemPrompt: "You are a strict teacher.",
    temperature: 0.5,
    createdAt: "2024-01-02T00:00:00Z",
    updatedAt: "2024-01-02T00:00:00Z",
  },
];

const renderComponent = () => renderWithProviders(<Agents />);

describe("Agents Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAllAgents).mockResolvedValue(mockAgents);
    vi.mocked(deleteAgent).mockResolvedValue(undefined);
  });

  it("renders agent cards", async () => {
    renderComponent();
    await waitFor(() => {
      expect(screen.getByText("Helpful Assistant")).toBeInTheDocument();
      expect(screen.getByText("Strict Teacher")).toBeInTheDocument();
    });
  });

  it("deletes an agent", async () => {
    renderComponent();
    const user = userEvent.setup();
    const deleteButtons = await screen.findAllByRole("button", { name: "" });
    await user.click(deleteButtons[1]!);
    const confirm = await screen.findByRole("button", { name: "Delete" });
    await user.click(confirm);
    await waitFor(() => {
      expect(deleteAgent).toHaveBeenCalledWith("agent2");
    });
  });

  it("shows empty state", async () => {
    vi.mocked(getAllAgents).mockResolvedValue([]);
    renderComponent();
    await waitFor(() => {
      expect(
        screen.getByText("No agents found. Create your first agent to get started.")
      ).toBeInTheDocument();
    });
  });
});
