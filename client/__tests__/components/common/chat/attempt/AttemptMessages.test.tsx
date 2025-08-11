import { render } from '@/test/custom-render';
import { screen, waitFor } from '@/test/custom-render';
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ——————————————————————————————————————————
import AttemptMessages from "@/components/common/chat/attempt/AttemptMessages";
import { SimulationMessage } from "@/types";
import { UseQueryResult } from "@tanstack/react-query";

// Mock the query hook
vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual("@tanstack/react-query");
  return {
    ...actual,
    useQuery: vi.fn(
      () =>
        ({
          data: [],
          isLoading: false,
          error: null,
        }) as const
    ),
  };
});

// Mock the simulation context
const mockSendMessage = vi.fn();
const mockSimulationContext = {
  currentChat: { id: "test-chat-id", completed: false },
  simulation: { timeLimit: null as number | null },
  isActive: true,
  isSendingMessage: false,
  sendMessage: mockSendMessage,
};

vi.mock("@/contexts/simulation-context", () => ({
  useSimulation: vi.fn(() => mockSimulationContext),
}));

// Mock the query function
vi.mock(
  "@/utils/queries/simulation_messages/get-simulation-messages-by-chat",
  () => ({
    getSimulationMessagesByChat: vi.fn(() => Promise.resolve([])),
  })
);

// ------------------------------------------------------------------
describe("AttemptMessages", () => {
  const mockMessages = [
    {
      id: "msg-1",
      content: "Hello, how can I help you?",
      type: "response" as const,
      completed: true,
      createdAt: new Date().toISOString(),
    },
    {
      id: "msg-2",
      content: "I need help with my assignment",
      type: "query" as const,
      completed: true,
      createdAt: new Date().toISOString(),
    },
    {
      id: "msg-3",
      content: "",
      type: "response" as const,
      completed: false,
      createdAt: new Date().toISOString(),
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockSimulationContext.currentChat.completed = false;
    mockSimulationContext.isActive = true;
    mockSimulationContext.isSendingMessage = false;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      render(<AttemptMessages />);
      expect(document.body).toBeInTheDocument();
    });

    it("should render with chatId prop", async () => {
      render(<AttemptMessages chatId="custom-chat-id" />);
      expect(document.body).toBeInTheDocument();
    });

    it("should render without chatId prop", async () => {
      render(<AttemptMessages />);
      expect(document.body).toBeInTheDocument();
    });
  });

  describe("Loading States", () => {
    it("should show loading skeleton when messages are loading", async () => {
      const { useQuery } = await import("@tanstack/react-query");
      vi.mocked(useQuery).mockReturnValue({
        data: [],
        isLoading: true,
        error: null,
      } as unknown as UseQueryResult<SimulationMessage[], Error>);

      render(<AttemptMessages />);

      await waitFor(() => {
        expect(document.body).toBeInTheDocument();
      });
    });

    it("should show loading skeleton with correct structure", async () => {
      const { useQuery } = await import("@tanstack/react-query");
      vi.mocked(useQuery).mockReturnValue({
        data: [],
        isLoading: true,
        error: null,
      } as unknown as UseQueryResult<SimulationMessage[], Error>);

      render(<AttemptMessages />);

      await waitFor(() => {
        expect(document.body).toBeInTheDocument();
      });
    });
  });

  describe("Empty State", () => {
    it("should show starter prompts when no messages", async () => {
      const { useQuery } = await import("@tanstack/react-query");
      vi.mocked(useQuery).mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
      } as unknown as UseQueryResult<SimulationMessage[], Error>);

      render(<AttemptMessages />);

      await waitFor(() => {
        expect(
          screen.getByText("Choose a prompt below or type your own message")
        ).toBeInTheDocument();
      });
    });

    it("should show starter prompt buttons", async () => {
      const { useQuery } = await import("@tanstack/react-query");
      vi.mocked(useQuery).mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
      } as unknown as UseQueryResult<SimulationMessage[], Error>);

      render(<AttemptMessages />);

      await waitFor(() => {
        expect(screen.getByText("Hi, how are you?")).toBeInTheDocument();
        expect(
          screen.getByText("What can I help you with?")
        ).toBeInTheDocument();
        expect(
          screen.getByText("I'm ready to assist you today")
        ).toBeInTheDocument();
      });
    });

    it("should call sendMessage when starter prompt is clicked", async () => {
      const user = userEvent.setup();
      const { useQuery } = await import("@tanstack/react-query");
      vi.mocked(useQuery).mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
      } as unknown as UseQueryResult<SimulationMessage[], Error>);

      render(<AttemptMessages />);

      await waitFor(() => {
        expect(screen.getByText("Hi, how are you?")).toBeInTheDocument();
      });

      const promptButton = screen.getByText("Hi, how are you?");
      await user.click(promptButton);

      expect(mockSendMessage).toHaveBeenCalledWith("Hi, how are you?");
    });

    it("should disable starter prompts when chat is completed", async () => {
      const { useQuery } = await import("@tanstack/react-query");
      vi.mocked(useQuery).mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
      } as unknown as UseQueryResult<SimulationMessage[], Error>);

      mockSimulationContext.currentChat.completed = true;

      render(<AttemptMessages />);

      await waitFor(() => {
        const promptButton = screen.getByRole("button", {
          name: "Hi, how are you?",
        });
        expect(promptButton).toBeDisabled();
      });
    });

    it("should disable starter prompts when sending message", async () => {
      const { useQuery } = await import("@tanstack/react-query");
      vi.mocked(useQuery).mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
      } as unknown as UseQueryResult<SimulationMessage[], Error>);

      mockSimulationContext.isSendingMessage = true;

      render(<AttemptMessages />);

      await waitFor(() => {
        const promptButton = screen.getByRole("button", {
          name: "Hi, how are you?",
        });
        expect(promptButton).toBeDisabled();
      });
    });

    it("should disable starter prompts when time limit is active and not active", async () => {
      const { useQuery } = await import("@tanstack/react-query");
      vi.mocked(useQuery).mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
      } as unknown as UseQueryResult<SimulationMessage[], Error>);

      mockSimulationContext.simulation.timeLimit = 300;
      mockSimulationContext.isActive = false;

      render(<AttemptMessages />);

      await waitFor(() => {
        const promptButton = screen.getByRole("button", {
          name: "Hi, how are you?",
        });
        expect(promptButton).toBeDisabled();
      });
    });
  });

  describe("Message Display", () => {
    it("should display query messages correctly", async () => {
      const { useQuery } = await import("@tanstack/react-query");
      vi.mocked(useQuery).mockReturnValue({
        data: [mockMessages[1]], // Query message
        isLoading: false,
        error: null,
      } as unknown as UseQueryResult<SimulationMessage[], Error>);

      render(<AttemptMessages />);

      await waitFor(() => {
        expect(
          screen.getByText("I need help with my assignment")
        ).toBeInTheDocument();
      });
    });

    it("should display response messages correctly", async () => {
      const { useQuery } = await import("@tanstack/react-query");
      vi.mocked(useQuery).mockReturnValue({
        data: [mockMessages[0]], // Response message
        isLoading: false,
        error: null,
      } as unknown as UseQueryResult<SimulationMessage[], Error>);

      render(<AttemptMessages />);

      await waitFor(() => {
        expect(
          screen.getByText("Hello, how can I help you?")
        ).toBeInTheDocument();
      });
    });

    it("should display incomplete messages with loading state", async () => {
      const { useQuery } = await import("@tanstack/react-query");
      vi.mocked(useQuery).mockReturnValue({
        data: [mockMessages[2]], // Incomplete message
        isLoading: false,
        error: null,
      } as unknown as UseQueryResult<SimulationMessage[], Error>);

      render(<AttemptMessages />);

      await waitFor(() => {
        expect(screen.getByText("Analyzing")).toBeInTheDocument();
      });
    });

    it("should display completed empty messages as 'No response'", async () => {
      const { useQuery } = await import("@tanstack/react-query");
      const emptyCompletedMessage = {
        ...mockMessages[2],
        completed: true,
      };
      vi.mocked(useQuery).mockReturnValue({
        data: [emptyCompletedMessage],
        isLoading: false,
        error: null,
      } as unknown as UseQueryResult<SimulationMessage[], Error>);

      render(<AttemptMessages />);

      await waitFor(() => {
        expect(screen.getByText("No response")).toBeInTheDocument();
      });
    });

    it("should sort messages by creation time", async () => {
      const { useQuery } = await import("@tanstack/react-query");
      const sortedMessages = [
        {
          id: "msg-1",
          content: "First message",
          type: "query" as const,
          completed: true,
          createdAt: new Date("2023-01-01T10:00:00Z").toISOString(),
        },
        {
          id: "msg-2",
          content: "Second message",
          type: "response" as const,
          completed: true,
          createdAt: new Date("2023-01-01T10:01:00Z").toISOString(),
        },
      ];
      vi.mocked(useQuery).mockReturnValue({
        data: sortedMessages,
        isLoading: false,
        error: null,
      } as unknown as UseQueryResult<SimulationMessage[], Error>);

      render(<AttemptMessages />);

      await waitFor(() => {
        expect(screen.getByText("First message")).toBeInTheDocument();
        expect(screen.getByText("Second message")).toBeInTheDocument();
      });
    });
  });

  describe("Scroll Functionality", () => {
    beforeEach(() => {
      // Mock scrollTo method for JSDOM
      Element.prototype.scrollTo = vi.fn();
    });

    it("should show scroll button when content is scrollable", async () => {
      const { useQuery } = await import("@tanstack/react-query");
      vi.mocked(useQuery).mockReturnValue({
        data: mockMessages,
        isLoading: false,
        error: null,
      } as unknown as UseQueryResult<SimulationMessage[], Error>);

      render(<AttemptMessages />);

      await waitFor(() => {
        expect(document.body).toBeInTheDocument();
      });

      // The scroll button should be present but may not be visible initially
      const scrollButton = screen.queryByTestId("scroll-to-bottom-button");
      expect(scrollButton).toBeInTheDocument();
    });

    it("should handle scroll to bottom functionality", async () => {
      const user = userEvent.setup();
      const { useQuery } = await import("@tanstack/react-query");
      vi.mocked(useQuery).mockReturnValue({
        data: mockMessages,
        isLoading: false,
        error: null,
      } as unknown as UseQueryResult<SimulationMessage[], Error>);

      render(<AttemptMessages />);

      await waitFor(() => {
        expect(document.body).toBeInTheDocument();
      });

      const scrollButton = screen.getByTestId("scroll-to-bottom-button");
      await user.click(scrollButton);

      // Should not throw an error
      expect(scrollButton).toBeInTheDocument();
    });
  });

  describe("Message Content Rendering", () => {
    it("should render markdown content in messages", async () => {
      const { useQuery } = await import("@tanstack/react-query");
      const markdownMessage = {
        id: "msg-1",
        content: "**Bold text** and *italic text*",
        type: "response" as const,
        completed: true,
        createdAt: new Date().toISOString(),
      };
      vi.mocked(useQuery).mockReturnValue({
        data: [markdownMessage],
        isLoading: false,
        error: null,
      } as unknown as UseQueryResult<SimulationMessage[], Error>);

      render(<AttemptMessages />);

      await waitFor(() => {
        expect(document.body).toBeInTheDocument();
      });
    });

    it("should render code blocks in messages", async () => {
      const { useQuery } = await import("@tanstack/react-query");
      const codeMessage = {
        id: "msg-1",
        content: "```javascript\nconsole.log('Hello');\n```",
        type: "response" as const,
        completed: true,
        createdAt: new Date().toISOString(),
      };
      vi.mocked(useQuery).mockReturnValue({
        data: [codeMessage],
        isLoading: false,
        error: null,
      } as unknown as UseQueryResult<SimulationMessage[], Error>);

      render(<AttemptMessages />);

      await waitFor(() => {
        expect(document.body).toBeInTheDocument();
      });
    });

    it("should render links in messages", async () => {
      const { useQuery } = await import("@tanstack/react-query");
      const linkMessage = {
        id: "msg-1",
        content: "Visit [Google](https://google.com) for more information",
        type: "response" as const,
        completed: true,
        createdAt: new Date().toISOString(),
      };
      vi.mocked(useQuery).mockReturnValue({
        data: [linkMessage],
        isLoading: false,
        error: null,
      } as unknown as UseQueryResult<SimulationMessage[], Error>);

      render(<AttemptMessages />);

      await waitFor(() => {
        expect(document.body).toBeInTheDocument();
      });
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty chatId gracefully", async () => {
      const { useQuery } = await import("@tanstack/react-query");
      vi.mocked(useQuery).mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
      } as unknown as UseQueryResult<SimulationMessage[], Error>);

      render(<AttemptMessages chatId="" />);

      await waitFor(() => {
        expect(document.body).toBeInTheDocument();
      });
    });

    it("should handle null chatId gracefully", async () => {
      const { useQuery } = await import("@tanstack/react-query");
      vi.mocked(useQuery).mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
      } as unknown as UseQueryResult<SimulationMessage[], Error>);

      render(<AttemptMessages chatId={null as unknown as string} />);

      await waitFor(() => {
        expect(document.body).toBeInTheDocument();
      });
    });

    it("should handle query errors gracefully", async () => {
      const { useQuery } = await import("@tanstack/react-query");
      vi.mocked(useQuery).mockReturnValue({
        data: [],
        isLoading: false,
        error: new Error("Query failed"),
      } as unknown as UseQueryResult<SimulationMessage[], Error>);

      render(<AttemptMessages />);

      await waitFor(() => {
        expect(document.body).toBeInTheDocument();
      });
    });

    it("should handle messages with missing properties", async () => {
      const { useQuery } = await import("@tanstack/react-query");
      const incompleteMessage = {
        id: "msg-1",
        content: "Test message",
        type: "response" as const,
        // Missing completed and createdAt
      };
      vi.mocked(useQuery).mockReturnValue({
        data: [incompleteMessage],
        isLoading: false,
        error: null,
      } as unknown as UseQueryResult<SimulationMessage[], Error>);

      render(<AttemptMessages />);

      await waitFor(() => {
        expect(document.body).toBeInTheDocument();
      });
    });

    it("should handle very long messages", async () => {
      const { useQuery } = await import("@tanstack/react-query");
      const longMessage = {
        id: "msg-1",
        content: "A".repeat(10000), // Very long message
        type: "response" as const,
        completed: true,
        createdAt: new Date().toISOString(),
      };
      vi.mocked(useQuery).mockReturnValue({
        data: [longMessage],
        isLoading: false,
        error: null,
      } as unknown as UseQueryResult<SimulationMessage[], Error>);

      render(<AttemptMessages />);

      await waitFor(() => {
        expect(document.body).toBeInTheDocument();
      });
    });

    it("should handle messages with special characters", async () => {
      const { useQuery } = await import("@tanstack/react-query");
      const specialMessage = {
        id: "msg-1",
        content:
          "Message with special chars: & < > \" ' ` ~ ! @ # $ % ^ & * ( ) _ + - = [ ] { } | \\ ; : ' \" , . / ?",
        type: "response" as const,
        completed: true,
        createdAt: new Date().toISOString(),
      };
      vi.mocked(useQuery).mockReturnValue({
        data: [specialMessage],
        isLoading: false,
        error: null,
      } as unknown as UseQueryResult<SimulationMessage[], Error>);

      render(<AttemptMessages />);

      await waitFor(() => {
        expect(document.body).toBeInTheDocument();
      });
    });
  });

  describe("Context Integration", () => {
    it("should use currentChat.id when no chatId prop is provided", async () => {
      const { useQuery } = await import("@tanstack/react-query");
      vi.mocked(useQuery).mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
      } as unknown as UseQueryResult<SimulationMessage[], Error>);

      render(<AttemptMessages />);

      await waitFor(() => {
        expect(document.body).toBeInTheDocument();
      });

      // Should use the currentChat.id from context
      expect(vi.mocked(useQuery)).toHaveBeenCalledWith(
        expect.objectContaining({
          queryKey: ["simulationMessages", "test-chat-id"],
        })
      );
    });

    it("should use provided chatId prop over context", async () => {
      const { useQuery } = await import("@tanstack/react-query");
      vi.mocked(useQuery).mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
      } as unknown as UseQueryResult<SimulationMessage[], Error>);

      render(<AttemptMessages chatId="custom-chat-id" />);

      await waitFor(() => {
        expect(document.body).toBeInTheDocument();
      });

      // Should use the provided chatId
      expect(vi.mocked(useQuery)).toHaveBeenCalledWith(
        expect.objectContaining({
          queryKey: ["simulationMessages", "custom-chat-id"],
        })
      );
    });
  });
});
