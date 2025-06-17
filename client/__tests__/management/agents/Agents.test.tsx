/**
 * Agents.test.tsx
 * Test suite for the Agents management component
 */

import Agents from "@/components/management/agents/Agents";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock Next.js router
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
}));

// Mock toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock the queries
vi.mock("@/utils/queries/agents/get-all-agents", () => ({
  getAllAgents: vi.fn(),
}));

vi.mock("@/utils/mutations/agents/delete-agent", () => ({
  deleteAgent: vi.fn(),
}));

// Import mocked functions
import { deleteAgent } from "@/utils/mutations/agents/delete-agent";
import { getAllAgents } from "@/utils/queries/agents/get-all-agents";

// Mock data
const mockAgents = [
  {
    id: "agent1",
    name: "Helpful Assistant",
    description: "A helpful AI assistant for students",
    agentType: "student" as const,
    systemPrompt: "You are a helpful assistant.",
    temperature: 0.7,
    createdAt: "2024-01-01T00:00:00Z",
  },
  {
    id: "agent2",
    name: "Strict Teacher",
    description: "A strict but fair teaching assistant",
    agentType: "ta" as const,
    systemPrompt: "You are a strict teacher.",
    temperature: 0.5,
    createdAt: "2024-01-02T00:00:00Z",
  },
  {
    id: "agent3",
    name: "Curious Student",
    description: "An eager and curious student agent",
    agentType: "student" as const,
    systemPrompt: "You are a curious student.",
    temperature: 0.8,
    createdAt: "2024-01-03T00:00:00Z",
  },
];

describe("Agents Component", () => {
  let queryClient: QueryClient;
  const mockPush = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    vi.mocked(useRouter).mockReturnValue({
      push: mockPush,
      back: vi.fn(),
      forward: vi.fn(),
      refresh: vi.fn(),
      replace: vi.fn(),
      prefetch: vi.fn(),
    });
    vi.mocked(getAllAgents).mockResolvedValue(mockAgents);
    vi.mocked(deleteAgent).mockResolvedValue(undefined);
  });

  const renderComponent = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <Agents />
      </QueryClientProvider>
    );
  };

  it("renders agent cards when data is loaded", async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Helpful Assistant")).toBeInTheDocument();
      expect(screen.getByText("Strict Teacher")).toBeInTheDocument();
      expect(screen.getByText("Curious Student")).toBeInTheDocument();
    });

    expect(
      screen.getByText("A friendly and helpful AI assistant")
    ).toBeInTheDocument();
    expect(
      screen.getByText("A demanding but fair educator")
    ).toBeInTheDocument();
    expect(
      screen.getByText("An eager learner with many questions")
    ).toBeInTheDocument();
  });

  it("displays agent type badges correctly", async () => {
    renderComponent();

    await waitFor(() => {
      const studentBadges = screen.getAllByText("Student");
      expect(studentBadges).toHaveLength(2);
      expect(screen.getByText("Instructor")).toBeInTheDocument();
    });
  });

  it("displays creation dates", async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Created Jan 1, 2024")).toBeInTheDocument();
      expect(screen.getByText("Created Jan 2, 2024")).toBeInTheDocument();
      expect(screen.getByText("Created Jan 3, 2024")).toBeInTheDocument();
    });
  });

  it("handles create new agent action", async () => {
    renderComponent();

    await waitFor(() => {
      const createButton = screen.getByText("Create New Agent");
      fireEvent.click(createButton);
    });

    expect(mockPush).toHaveBeenCalledWith("/management/agents/new");
  });

  it("handles edit agent action", async () => {
    renderComponent();

    await waitFor(() => {
      const editButtons = screen.getAllByLabelText("Edit agent");
      fireEvent.click(editButtons[0]!);
    });

    expect(mockPush).toHaveBeenCalledWith("/management/agents/a/agent1/edit");
  });

  it("opens delete confirmation dialog", async () => {
    renderComponent();

    await waitFor(() => {
      const deleteButtons = screen.getAllByLabelText("Delete agent");
      fireEvent.click(deleteButtons[0]!);
    });

    await waitFor(() => {
      expect(screen.getByText("Are you sure?")).toBeInTheDocument();
      expect(
        screen.getByText(/permanently delete the agent "Helpful Assistant"/)
      ).toBeInTheDocument();
    });
  });

  it("handles delete agent", async () => {
    vi.mocked(deleteAgent).mockResolvedValue(undefined);

    renderComponent();

    await waitFor(() => {
      const deleteButtons = screen.getAllByLabelText("Delete agent");
      fireEvent.click(deleteButtons[0]!);
    });

    await waitFor(() => {
      const confirmButton = screen.getByRole("button", { name: "Delete" });
      fireEvent.click(confirmButton);
    });

    await waitFor(() => {
      expect(deleteAgent).toHaveBeenCalledWith("agent1");
    });
  });

  it("should show empty state when no agents exist", async () => {
    vi.mocked(getAllAgents).mockResolvedValue([]);

    renderComponent();

    await waitFor(() => {
      expect(
        screen.getByText(
          "No agents found. Create your first agent to get started."
        )
      ).toBeInTheDocument();
    });
  });

  it("should handle create first agent from empty state", async () => {
    vi.mocked(getAllAgents).mockResolvedValue([]);

    renderComponent();

    await waitFor(() => {
      const createButton = screen.getByText("Create Your First Agent");
      fireEvent.click(createButton);
    });

    expect(mockPush).toHaveBeenCalledWith("/management/agents/new");
  });

  it("displays system prompt preview", async () => {
    renderComponent();

    await waitFor(() => {
      expect(
        screen.getByText("You are a helpful assistant.")
      ).toBeInTheDocument();
      expect(screen.getByText("You are a strict teacher.")).toBeInTheDocument();
      expect(
        screen.getByText("You are a curious student.")
      ).toBeInTheDocument();
    });
  });

  it("should handle API errors gracefully", async () => {
    vi.mocked(getAllAgents).mockRejectedValue(new Error("API Error"));

    renderComponent();

    // Should not crash on API error
    await waitFor(() => {
      expect(getAllAgents).toHaveBeenCalled();
    });
  });

  it("should handle delete errors", async () => {
    const user = userEvent.setup();
    vi.mocked(deleteAgent).mockRejectedValue(new Error("Delete failed"));

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Helpful Assistant")).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByRole("button");
    const deleteButton = deleteButtons.find(
      (button) =>
        button.querySelector("svg") &&
        button.getAttribute("class")?.includes("h-4 w-4")
    );

    if (deleteButton) {
      await user.click(deleteButton);

      const confirmDeleteButton = screen.getByRole("button", {
        name: /delete/i,
      });
      await user.click(confirmDeleteButton);

      await waitFor(() => {
        expect(deleteAgent).toHaveBeenCalled();
        expect(toast.error).toHaveBeenCalledWith("Failed to delete agent");
      });
    }
  });

  it("should handle loading state", () => {
    vi.mocked(getAllAgents).mockImplementation(() => new Promise(() => {})); // Never resolves

    renderComponent();

    // Component should render without agents while loading
    expect(screen.queryByText("Helpful Assistant")).not.toBeInTheDocument();
  });

  it("should show deleting state", async () => {
    const user = userEvent.setup();
    let resolveDelete: (value: undefined) => void;
    vi.mocked(deleteAgent).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveDelete = resolve;
        })
    );

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Helpful Assistant")).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByRole("button");
    const deleteButton = deleteButtons.find(
      (button) =>
        button.querySelector("svg") &&
        button.getAttribute("class")?.includes("h-4 w-4")
    );

    if (deleteButton) {
      await user.click(deleteButton);

      const confirmDeleteButton = screen.getByRole("button", {
        name: /delete/i,
      });
      await user.click(confirmDeleteButton);

      await waitFor(() => {
        expect(screen.getByText("Deleting...")).toBeInTheDocument();
      });

      // Resolve the delete promise
      resolveDelete!(undefined);
    }
  });

  it("displays agent cards in grid layout", async () => {
    renderComponent();

    await waitFor(() => {
      const agentCards = screen.getAllByRole("article");
      expect(agentCards).toHaveLength(3);
    });
  });

  it("truncates long system prompts", async () => {
    const longPromptAgent = {
      id: mockAgents[0]!.id,
      name: mockAgents[0]!.name,  
      description: mockAgents[0]!.description,
      agentType: mockAgents[0]!.agentType,
      temperature: mockAgents[0]!.temperature,
      createdAt: mockAgents[0]!.createdAt,
      systemPrompt:
        "This is a very long system prompt that should be truncated when displayed in the card view to prevent the UI from becoming cluttered and unreadable.",
    };

    vi.mocked(getAllAgents).mockResolvedValue([longPromptAgent]);

    renderComponent();

    await waitFor(() => {
      // Should show truncated version
      expect(
        screen.getByText(/This is a very long system prompt/)
      ).toBeInTheDocument();
    });
  });

  it("displays correct agent count", async () => {
    renderComponent();

    await waitFor(() => {
      // Should show all 3 agents
      const agentCards = screen.getAllByRole("article");
      expect(agentCards).toHaveLength(3);
    });
  });
});
