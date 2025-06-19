import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Agent from "@/components/common/agent/Agent";
import { renderWithProviders, setSessionMockToRole } from "@/mocks/utils";
import { ProfileRole } from "@/types";

/* generator mocks we might override */
import { createAgentMock } from "@/mocks/mutations"; // already exported
import { updateAgent } from "@/utils/mutations/agents/update-agent";
import { getAgent } from "@/utils/queries/agents/get-agent";

/* ------------------------------------------------------------------ */
/* shared data                                                         */
/* ------------------------------------------------------------------ */
const existingAgent = {
  id: "agent-42",
  name: "Existing",
  description: "Already in DB",
  systemPrompt: "Prompt",
  temperature: 10,
  createdAt: "2025-01-01T00:00:00Z",
  updatedAt: "2025-01-01T00:00:00Z",
  defaultAgent: false,
};

/* ------------------------------------------------------------------ */
/* global                                                */
/* ------------------------------------------------------------------ */
beforeEach(() => {
  vi.restoreAllMocks(); // resets call‐counts & implementations, keeps module cache
  setSessionMockToRole("admin");
});

/* ------------------------------------------------------------------ */
/* role based access                                                   */
/* ------------------------------------------------------------------ */
describe("access control", () => {
  ["admin", "instructional", "instructor"].forEach((role) => {
    it(`renders for ${role}`, () => {
      setSessionMockToRole(role as ProfileRole);
      renderWithProviders(<Agent />);
      expect(screen.getByLabelText(/agent name/i)).toBeInTheDocument();
    });
  });

  ["ta", "guest"].forEach((role) => {
    it(`denies ${role}`, () => {
      setSessionMockToRole(role as ProfileRole);
      renderWithProviders(<Agent />);
      expect(screen.getByText(/access denied/i)).toBeInTheDocument();
    });
  });
});

/* ------------------------------------------------------------------ */
/* create mode                                                         */
/* ------------------------------------------------------------------ */
describe("create form", () => {
  it("validates required fields", async () => {
    const user = userEvent.setup();
    renderWithProviders(<Agent />);

    await user.click(screen.getByRole("button", { name: /create agent/i }));
    await waitFor(() => expect(createAgentMock).not.toHaveBeenCalled());
  });

  it("submits happy path", async () => {
    const user = userEvent.setup();
    createAgentMock.mockResolvedValue({ id: "new-id" });

    renderWithProviders(<Agent />);

    await user.type(screen.getByLabelText(/agent name/i), "New");
    await user.type(screen.getByLabelText(/description/i), "Desc");
    await user.type(screen.getByLabelText(/system prompt/i), "Prompt");
    await user.click(screen.getByRole("button", { name: /create agent/i }));

    await waitFor(() =>
      expect(createAgentMock).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "New",
          description: "Desc",
          systemPrompt: "Prompt",
        })
      )
    );
  });
});

/* ------------------------------------------------------------------ */
/* edit mode                                                           */
/* ------------------------------------------------------------------ */
describe("edit form", () => {
  it("prefills data then updates", async () => {
    vi.mocked(getAgent).mockResolvedValue(existingAgent);
    const user = userEvent.setup();

    renderWithProviders(<Agent agentId="agent-42" />);

    await screen.findByDisplayValue("Existing");
    await user.clear(screen.getByLabelText(/description/i));
    await user.type(screen.getByLabelText(/description/i), "Updated");

    vi.mocked(updateAgent).mockResolvedValue({
      ...existingAgent,
      description: "Updated",
    });
    await user.click(screen.getByRole("button", { name: /update agent/i }));

    await waitFor(() =>
      expect(updateAgent).toHaveBeenCalledWith(
        "agent-42",
        expect.objectContaining({ description: "Updated" })
      )
    );
  });
});
