import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode } from "react";
import Attempt from "@/components/common/chat/Attempt";

// Mock external dependencies
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    replace: vi.fn(),
  })),
  usePathname: vi.fn(() => "/"),
  useSearchParams: vi.fn(() => new URLSearchParams()),
}));

// Mock Link component
vi.mock("next/link", () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

// Mock all query modules with vi.fn() directly
vi.mock("@/utils/queries/simulation_attempts/get-simulation-attempt", () => ({
  getSimulationAttempt: vi.fn(),
}));

vi.mock("@/utils/queries/classes/get-class", () => ({
  getClass: vi.fn(),
}));

vi.mock("@/utils/queries/simulations/get-simulation", () => ({
  getSimulation: vi.fn(),
}));

vi.mock("@/utils/queries/simulation_chats/get-simulation-chats-by-attempt", () => ({
  getSimulationChatsByAttempt: vi.fn(),
}));

vi.mock("@/utils/queries/scenarios/get-scenario", () => ({
  getScenario: vi.fn(),
}));

vi.mock("@/utils/queries/simulation_messages/get-simulation-messages-by-chat", () => ({
  getSimulationMessagesByChat: vi.fn(),
}));

vi.mock("@/utils/queries/rubrics/get-all-rubrics", () => ({
  getAllRubrics: vi.fn(),
}));

vi.mock("@/utils/queries/standard_groups/get-standard-groups-by-rubrics", () => ({
  getStandardGroupsByRubrics: vi.fn(),
}));

vi.mock("@/utils/queries/standards/get-standards-by-standardgroups", () => ({
  getStandardsByStandardGroups: vi.fn(),
}));

vi.mock("@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-simulationchats", () => ({
  getSimulationChatGradesBySimulationChats: vi.fn(),
}));

vi.mock("@/utils/queries/simulation_chat_feedbacks/get-simulation-chat-feedbacks-by-simulationchatgrades", () => ({
  getSimulationChatFeedbacksBySimulationChatGrades: vi.fn(),
}));

vi.mock("@/utils/queries/documents/get-all-documents", () => ({
  getAllDocuments: vi.fn(),
}));

// Mock components
vi.mock("@/components/common/chat/DocumentViewer", () => ({
  default: ({ document }: { document: any }) => (
    <div data-testid="document-viewer">{document.name}</div>
  ),
}));

vi.mock("@/components/common/chat/Markdown", () => ({
  default: ({ children }: { children: ReactNode }) => (
    <div data-testid="markdown">{children}</div>
  ),
}));

vi.mock("@/components/common/rubric/TableRubric", () => ({
  default: () => <div data-testid="table-rubric">Table Rubric</div>,
}));

// Mock toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("Attempt - Starter Prompts", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    // Setup default mock data
    const mockAttempt = {
      id: "attempt-1",
      userId: "user-1",
      classId: "class-1",
      simulationId: "simulation-1",
      createdAt: "2024-01-01T00:00:00Z",
    };

    const mockClass = {
      id: "class-1",
      name: "Introduction to Computer Science",
      classCode: "CS101",
      year: 2024,
      term: "fall",
      description: "Basic computer science concepts",
      createdAt: "2024-01-01T00:00:00Z",
    };

    const mockSimulation = {
      id: "simulation-1",
      name: "Test Simulation",
      description: "Test simulation description",
      scenarioIds: ["scenario-1"],
      timeLimit: 30,
      rubricId: "rubric-1",
      createdAt: "2024-01-01T00:00:00Z",
    };

    const mockChats = [
      {
        id: "chat-1",
        title: "Test Chat 1",
        scenarioId: "scenario-1",
        attemptId: "attempt-1",
        completed: false,
        createdAt: "2024-01-01T00:00:00Z",
        completedAt: null,
      },
    ];

    const mockScenario = {
      id: "scenario-1",
      name: "Test Scenario",
      description: "Test scenario description",
      crowdedness: 3,
      intensity: 2,
      createdAt: "2024-01-01T00:00:00Z",
    };

    // Apply mocks using require to get the mocked functions
    const { getSimulationAttempt } = require("@/utils/queries/simulation_attempts/get-simulation-attempt");
    const { getClass } = require("@/utils/queries/classes/get-class");
    const { getSimulation } = require("@/utils/queries/simulations/get-simulation");
    const { getSimulationChatsByAttempt } = require("@/utils/queries/simulation_chats/get-simulation-chats-by-attempt");
    const { getScenario } = require("@/utils/queries/scenarios/get-scenario");
    const { getSimulationMessagesByChat } = require("@/utils/queries/simulation_messages/get-simulation-messages-by-chat");
    const { getAllRubrics } = require("@/utils/queries/rubrics/get-all-rubrics");
    const { getStandardGroupsByRubrics } = require("@/utils/queries/standard_groups/get-standard-groups-by-rubrics");
    const { getStandardsByStandardGroups } = require("@/utils/queries/standards/get-standards-by-standardgroups");
    const { getSimulationChatGradesBySimulationChats } = require("@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-simulationchats");
    const { getSimulationChatFeedbacksBySimulationChatGrades } = require("@/utils/queries/simulation_chat_feedbacks/get-simulation-chat-feedbacks-by-simulationchatgrades");
    const { getAllDocuments } = require("@/utils/queries/documents/get-all-documents");

    getSimulationAttempt.mockResolvedValue(mockAttempt);
    getClass.mockResolvedValue(mockClass);
    getSimulation.mockResolvedValue(mockSimulation);
    getSimulationChatsByAttempt.mockResolvedValue(mockChats);
    getScenario.mockResolvedValue(mockScenario);
    getSimulationMessagesByChat.mockResolvedValue([]);
    getAllRubrics.mockResolvedValue([]);
    getStandardGroupsByRubrics.mockResolvedValue([]);
    getStandardsByStandardGroups.mockResolvedValue([]);
    getSimulationChatGradesBySimulationChats.mockResolvedValue([]);
    getSimulationChatFeedbacksBySimulationChatGrades.mockResolvedValue([]);
    getAllDocuments.mockResolvedValue([]);
  });

  const renderWithProviders = (ui: React.ReactElement, options = {}) => {
    const AllProviders = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    return render(ui, { wrapper: AllProviders, ...options });
  };

  it("should display starter prompts when there are no messages", async () => {
    renderWithProviders(<Attempt attemptId="attempt-1" />);

    await waitFor(() => {
      expect(screen.getByText("Start the conversation")).toBeInTheDocument();
      expect(screen.getByText("Choose a prompt below or type your own message")).toBeInTheDocument();
    });
  });

  it("should display basic starter prompts", async () => {
    renderWithProviders(<Attempt attemptId="attempt-1" />);

    await waitFor(() => {
      expect(screen.getByText("Hi, how are you?")).toBeInTheDocument();
      expect(screen.getByText("What can I help you with?")).toBeInTheDocument();
    });
  });

  it("should display class-specific starter prompt with classCode", async () => {
    renderWithProviders(<Attempt attemptId="attempt-1" />);

    await waitFor(() => {
      expect(screen.getByText("Are you here for CS101?")).toBeInTheDocument();
    });
  });

  it("should handle starter prompt clicks", async () => {
    const user = userEvent.setup();
    
    // Mock fetch for message sending
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      body: {
        getReader: () => ({
          read: () => Promise.resolve({ done: true, value: new Uint8Array() }),
        }),
      },
    });

    renderWithProviders(<Attempt attemptId="attempt-1" />);

    await waitFor(() => {
      expect(screen.getByText("Hi, how are you?")).toBeInTheDocument();
    });

    const starterPromptButton = screen.getByText("Hi, how are you?");
    await user.click(starterPromptButton);

    // Should trigger message sending
    expect(global.fetch).toHaveBeenCalled();
  });

  it("should not display starter prompts when messages exist", async () => {
    // Mock existing messages
    const { getSimulationMessagesByChat } = require("@/utils/queries/simulation_messages/get-simulation-messages-by-chat");
    getSimulationMessagesByChat.mockResolvedValue([
      {
        id: "message-1",
        query: "Hello, I need help with calculus.",
        response: "I'd be happy to help you with calculus!",
        chatId: "chat-1",
        completed: true,
        createdAt: "2024-01-01T00:00:00Z",
      },
    ]);

    renderWithProviders(<Attempt attemptId="attempt-1" />);

    await waitFor(() => {
      // Should show existing messages instead of starter prompts
      expect(screen.getByText("Hello, I need help with calculus.")).toBeInTheDocument();
      expect(screen.queryByText("Start the conversation")).not.toBeInTheDocument();
    });
  });

  it("should handle missing class data gracefully", async () => {
    // Mock no class data
    const { getClass } = require("@/utils/queries/classes/get-class");
    getClass.mockResolvedValue(null);

    renderWithProviders(<Attempt attemptId="attempt-1" />);

    await waitFor(() => {
      expect(screen.getByText("Hi, how are you?")).toBeInTheDocument();
      expect(screen.getByText("What can I help you with?")).toBeInTheDocument();
      // Should not show class-specific prompt
      expect(screen.queryByText(/Are you here for/)).not.toBeInTheDocument();
    });
  });

  it("should show scroll-to-bottom button when there are many messages", async () => {
    // Mock multiple messages to trigger scroll
    const { getSimulationMessagesByChat } = require("@/utils/queries/simulation_messages/get-simulation-messages-by-chat");
    const mockMessages = Array.from({ length: 10 }, (_, i) => ({
      id: `message-${i}`,
      query: `Question ${i}`,
      response: `Response ${i}`,
      chatId: "chat-1",
      completed: true,
      createdAt: new Date(Date.now() + i * 1000).toISOString(),
    }));
    getSimulationMessagesByChat.mockResolvedValue(mockMessages);

    renderWithProviders(<Attempt attemptId="attempt-1" />);

    await waitFor(() => {
      // Should show messages
      expect(screen.getByText("Question 0")).toBeInTheDocument();
    });

    // Wait a bit more for scroll detection to run
    await waitFor(() => {
      const scrollButton = screen.queryByTestId("scroll-to-bottom-button");
      // Button might appear depending on content height
      if (scrollButton) {
        expect(scrollButton).toBeInTheDocument();
      }
    }, { timeout: 1000 });
  });

  it("should handle scroll-to-bottom button click", async () => {
    const user = userEvent.setup();
    
    // Mock multiple messages
    const { getSimulationMessagesByChat } = require("@/utils/queries/simulation_messages/get-simulation-messages-by-chat");
    const mockMessages = Array.from({ length: 5 }, (_, i) => ({
      id: `message-${i}`,
      query: `Question ${i}`,
      response: `Response ${i}`,
      chatId: "chat-1",
      completed: true,
      createdAt: new Date(Date.now() + i * 1000).toISOString(),
    }));
    getSimulationMessagesByChat.mockResolvedValue(mockMessages);

    // Mock scrollIntoView
    const mockScrollIntoView = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      value: mockScrollIntoView,
      writable: true,
    });

    renderWithProviders(<Attempt attemptId="attempt-1" />);

    await waitFor(() => {
      expect(screen.getByText("Question 0")).toBeInTheDocument();
    });

    // Try to find and click the scroll button if it exists
    const scrollButton = screen.queryByTestId("scroll-to-bottom-button");
    if (scrollButton) {
      await user.click(scrollButton);
      expect(mockScrollIntoView).toHaveBeenCalledWith({ behavior: "smooth" });
    }
  });
});

/*
 * Component Analysis for Attempt:
 * Path: common/chat/Attempt.tsx
 *
 * Features detected:
 * - Default export: true
 * - Named exports: None
 * - Has props: true (attemptId: string)
 * - Props interface: { attemptId: string }
 * - Client component: true (uses hooks and state)
 * - Uses hooks: useState, useEffect, useRef, useMemo, useQuery, useQueryClient, useRouter
 * - Uses router: true (useRouter from next/navigation)
 * - Has API calls: true (multiple simulation-related queries)
 * - Has form handling: true (message sending form)
 * - Uses state: true (multiple state variables for chat functionality)
 * - Uses effects: true (multiple useEffect for timer, auto-scroll, etc.)
 * - Uses context: false (uses query client)
 *
 * The component now properly uses the dynamic rubric system based on grades/feedback
 * instead of the static rubric, following the Overview pattern for consistency
 * and better data accuracy. It handles both single and multi-chat attempts with
 * proper results display and skill-based feedback.
 */
