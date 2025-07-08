import NewAgent from "@/components/management/agents/NewAgent";
import { renderWithProviders } from "@/mocks/utils";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/utils/mutations/agents/create-agent", () => ({
  createAgent: vi.fn(),
}));

import { createAgent } from "@/utils/mutations/agents/create-agent";

describe("NewAgent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders form", () => {
    renderWithProviders(<NewAgent />);
    expect(screen.getByText("Create Agent")).toBeInTheDocument();
  });

  it("submits form", async () => {
    const user = userEvent.setup();
    vi.mocked(createAgent).mockResolvedValue({
      id: "1",
      name: "Test",
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-01T00:00:00Z",
      description: "Desc",
      systemPrompt: "Prompt",
      temperature: 0.5,
      defaultAgent: false,
    });
    renderWithProviders(<NewAgent />);

    await user.type(screen.getByLabelText(/agent name/i), "Test");
    await user.type(screen.getByLabelText(/description/i), "Desc");
    await user.type(screen.getByLabelText(/system prompt/i), "Prompt");
    await user.click(screen.getByRole("button", { name: /create agent/i }));

    await waitFor(() => {
      expect(createAgent).toHaveBeenCalled();
    });
  });
});
