/**
 * Attempt.test.tsx
 * Test suite for the Attempt component
 */

import Attempt from "@/components/common/chat/Attempt";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock Next.js router
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
}));

// Mock next-auth
vi.mock("next-auth/react", () => ({
  useSession: vi.fn(),
}));

// Mock toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/utils/queries/profiles/get-profiles-by-user", () => ({
  getProfilesByUser: vi.fn(),
}));

vi.mock("@/utils/queries/simulation_attempts/get-simulation-attempt", () => ({
  getSimulationAttempt: vi.fn(),
}));

vi.mock("@/utils/queries/simulations/get-simulation", () => ({
  getSimulation: vi.fn(),
}));

vi.mock(
  "@/utils/queries/simulation_chats/get-simulation-chats-by-attempt",
  () => ({
    getSimulationChatsByAttempt: vi.fn(),
  })
);

vi.mock("@/utils/queries/scenarios/get-scenario", () => ({
  getScenario: vi.fn(),
}));

vi.mock("@/utils/queries/classes/get-class", () => ({
  getClass: vi.fn(),
}));

vi.mock(
  "@/utils/queries/simulation_messages/get-simulation-messages-by-chat",
  () => ({
    getSimulationMessagesByChat: vi.fn(),
  })
);

vi.mock("@/utils/queries/documents/get-all-documents", () => ({
  getAllDocuments: vi.fn(),
}));

vi.mock("@/utils/queries/rubrics/get-all-rubrics", () => ({
  getAllRubrics: vi.fn(),
}));

vi.mock(
  "@/utils/queries/standard_groups/get-standard-groups-by-rubrics",
  () => ({
    getStandardGroupsByRubrics: vi.fn(),
  })
);

vi.mock("@/utils/queries/standards/get-standards-by-standardgroups", () => ({
  getStandardsByStandardGroups: vi.fn(),
}));

vi.mock(
  "@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-simulationchats",
  () => ({
    getSimulationChatGradesBySimulationChats: vi.fn(),
  })
);

vi.mock(
  "@/utils/queries/simulation_chat_feedbacks/get-simulation-chat-feedbacks-by-simulationchatgrades",
  () => ({
    getSimulationChatFeedbacksBySimulationChatGrades: vi.fn(),
  })
);

// Mock DocumentViewer component
vi.mock("@/components/common/chat/DocumentViewer", () => ({
  default: ({ document }: { document: { name: string } }) => (
    <div data-testid="document-viewer">Document: {document.name}</div>
  ),
}));

// Mock Markdown component
vi.mock("@/components/common/chat/Markdown", () => ({
  default: ({ children }: { children: string }) => <div>{children}</div>,
}));

// Mock TableRubric component
vi.mock("@/components/common/rubric/TableRubric", () => ({
  default: ({
    rubricId,
    simulationChatId,
  }: {
    rubricId: string;
    simulationChatId: string;
  }) => (
    <div data-testid="table-rubric">
      Rubric: {rubricId} for Chat: {simulationChatId}
    </div>
  ),
}));

// Import mocked functions
import { getClass } from "@/utils/queries/classes/get-class";
import { getAllDocuments } from "@/utils/queries/documents/get-all-documents";
import { getProfilesByUser } from "@/utils/queries/profiles/get-profiles-by-user";
import { getAllRubrics } from "@/utils/queries/rubrics/get-all-rubrics";
import { getScenario } from "@/utils/queries/scenarios/get-scenario";
import { getSimulationAttempt } from "@/utils/queries/simulation_attempts/get-simulation-attempt";
import { getSimulationChatFeedbacksBySimulationChatGrades } from "@/utils/queries/simulation_chat_feedbacks/get-simulation-chat-feedbacks-by-simulationchatgrades";
import { getSimulationChatGradesBySimulationChats } from "@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-simulationchats";
import { getSimulationChatsByAttempt } from "@/utils/queries/simulation_chats/get-simulation-chats-by-attempt";
import { getSimulationMessagesByChat } from "@/utils/queries/simulation_messages/get-simulation-messages-by-chat";
import { getSimulation } from "@/utils/queries/simulations/get-simulation";
import { getStandardGroupsByRubrics } from "@/utils/queries/standard_groups/get-standard-groups-by-rubrics";
import { getStandardsByStandardGroups } from "@/utils/queries/standards/get-standards-by-standardgroups";

// Mock data
const mockAttempt = {
  id: "attempt1",
  createdAt: new Date().toISOString(), // Use current time to avoid immediate expiration
  profileId: "profile1",
  simulationId: "sim-1",
};

const mockMessages = [
  {
    id: "msg1",
    query: "Hello, how can I help you?",
    response: "Hi! I need help with my assignment.",
    createdAt: new Date().toISOString(),
    chatId: "chat1",
    completed: true,
  },
];

const mockStandardGroups = [
  {
    id: "group1",
    createdAt: new Date().toISOString(),
    name: "Communication",
    shortName: "Comm",
    description: "Communication skills",
    points: 25,
    passPoints: 18,
    rubricId: "rubric1",
  },
];

const mockStandards = [
  {
    id: "standard1",
    createdAt: new Date().toISOString(),
    name: "Clear Communication",
    description: "Ability to communicate clearly",
    points: 5,
    standardGroupId: "group1",
  },
];

const mockGrades = [
  {
    id: "grade1",
    simulationChatId: "chat1",
    rubricId: "rubric1",
    score: 85,
    passed: true,
    timeTaken: 300, // 5 minutes
    createdAt: new Date().toISOString(),
  },
];

const mockFeedbacks = [
  {
    id: "feedback1",
    createdAt: new Date().toISOString(),
    standardId: "standard1",
    simulationChatGradeId: "grade1",
    total: 4,
    feedback: "Good communication skills",
  },
];

describe("Attempt Component", () => {
  let queryClient: QueryClient;
  let mockPush: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    mockPush = vi.fn();
    vi.mocked(useRouter).mockReturnValue({
      push: mockPush,
      back: vi.fn(),
      forward: vi.fn(),
      refresh: vi.fn(),
      replace: vi.fn(),
      prefetch: vi.fn(),
    });

    vi.mocked(useSession).mockReturnValue({
      data: {
        user: { email: "redacted@purdue.edu" },
        expires: "2024-12-31T23:59:59.999Z",
      },
      status: "authenticated",
      update: vi.fn(),
    });

    vi.mocked(getProfilesByUser).mockResolvedValue([
      {
        id: "profile1",
        userId: 1,
        lastLogin: new Date().toISOString(),
        firstName: "John",
        lastName: "Doe",
        alias: "jdoe",
        viewedIntro: true,
        createdAt: new Date().toISOString(),
        role: "ta" as const,
        classIds: ["class1"],
      },
    ]);

    vi.mocked(getSimulationAttempt).mockResolvedValue(mockAttempt);

    vi.mocked(getSimulation).mockResolvedValue({
      id: "simulation1",
      createdAt: new Date().toISOString(),
      title: "Test Simulation",
      timeLimit: 30,
      active: true,
      scenarioIds: ["scenario1", "scenario2"],
      rubricId: "rubric1",
    });

    vi.mocked(getSimulationChatsByAttempt).mockResolvedValue([
      {
        id: "chat1",
        createdAt: new Date().toISOString(),
        completedAt: null,
        title: "Chat 1",
        scenarioId: "scenario1",
        attemptId: "attempt1",
        completed: false,
      },
      {
        id: "chat2",
        createdAt: new Date().toISOString(),
        completedAt: null,
        title: "Chat 2",
        scenarioId: "scenario2",
        attemptId: "attempt1",
        completed: false,
      },
    ]);

    vi.mocked(getScenario).mockResolvedValue({
      id: "scenario1",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      name: "Test Scenario",
      description: "A test scenario for TAs",
      agentId: null,
      classId: "class1",
      crowdedness: null,
      intensity: null,
      seniority: null,
      documents: null,
    });

    vi.mocked(getClass).mockResolvedValue({
      id: "class1",
      createdAt: new Date().toISOString(),
      name: "CS 180",
      classCode: "CS180",
      year: 2024,
      term: "fall" as const,
      description: "Computer Science Course",
    });

    vi.mocked(getSimulationMessagesByChat).mockResolvedValue(mockMessages);

    vi.mocked(getAllDocuments).mockResolvedValue([
      {
        id: "doc1",
        createdAt: new Date().toISOString(),
        name: "Course Syllabus",
        filePath: "/path/to/syllabus.pdf",
        mimeType: "application/pdf",
        classId: "class1",
        type: "syllabus" as const,
        classified: true,
      },
    ]);

    vi.mocked(getAllRubrics).mockResolvedValue([
      {
        id: "rubric1",
        createdAt: new Date().toISOString(),
        name: "TA Performance Rubric",
        description: "Rubric for evaluating TA performance",
        points: 100,
        passPoints: 70,
        rubricType: "simulation" as const,
      },
    ]);

    vi.mocked(getStandardGroupsByRubrics).mockResolvedValue(mockStandardGroups);
    vi.mocked(getStandardsByStandardGroups).mockResolvedValue(mockStandards);
    vi.mocked(getSimulationChatGradesBySimulationChats).mockResolvedValue(
      mockGrades
    );
    vi.mocked(
      getSimulationChatFeedbacksBySimulationChatGrades
    ).mockResolvedValue(mockFeedbacks);

    // Mock fetch for message sending
    global.fetch = vi.fn();
  });

  const renderAttempt = (attemptId = "attempt1") => {
    return render(
      <QueryClientProvider client={queryClient}>
        <Attempt attemptId={attemptId} />
      </QueryClientProvider>
    );
  };

  it("renders loading state initially", () => {
    renderAttempt();
    expect(
      screen.getByText("Loading performance analytics...")
    ).toBeInTheDocument();
  });

  it("displays attempt information when loaded", async () => {
    renderAttempt();

    await waitFor(() => {
      expect(screen.getByText("A test scenario for TAs")).toBeInTheDocument();
    });

    // The circular progress component should show percentage for multi-chat attempts
    expect(screen.getByText("50%")).toBeInTheDocument();
  });

  it("displays timer correctly", async () => {
    renderAttempt();

    await waitFor(() => {
      expect(screen.getByTestId("timer")).toBeInTheDocument();
    });
  });

  it("allows sending messages", async () => {
    const mockResponse = {
      ok: true,
      body: {
        getReader: () => ({
          read: vi
            .fn()
            .mockResolvedValueOnce({
              done: false,
              value: new TextEncoder().encode('data: {"text": "Hello"}\n\n'),
            })
            .mockResolvedValueOnce({
              done: false,
              value: new TextEncoder().encode('data: {"done": true}\n\n'),
            })
            .mockResolvedValueOnce({ done: true }),
        }),
      },
    };

    vi.mocked(global.fetch).mockResolvedValue(
      mockResponse as unknown as Response
    );

    renderAttempt();

    await waitFor(() => {
      expect(screen.getByTestId("message-input")).toBeInTheDocument();
    });

    const messageInput = screen.getByTestId("message-input");
    const sendButton = screen.getByTestId("send-button");

    fireEvent.change(messageInput, { target: { value: "Test message" } });
    fireEvent.click(sendButton);

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/simulations/message"),
      expect.objectContaining({
        method: "POST",
        headers: { Accept: "text/event-stream" },
      })
    );
  });

  it("displays starter prompts when no messages", async () => {
    vi.mocked(getSimulationMessagesByChat).mockResolvedValue([]);

    renderAttempt();

    await waitFor(() => {
      expect(
        screen.getByText("Choose a prompt below or type your own message")
      ).toBeInTheDocument();
    });

    expect(screen.getByText("Hi, how are you?")).toBeInTheDocument();
    expect(screen.getByText("What can I help you with?")).toBeInTheDocument();
  });

  it("handles end chat functionality", async () => {
    const mockEndChatResponse = {
      ok: true,
      json: () => Promise.resolve({ success: true }),
    };

    vi.mocked(global.fetch).mockResolvedValue(
      mockEndChatResponse as unknown as Response
    );

    renderAttempt();

    await waitFor(() => {
      expect(screen.getByText("End Chat")).toBeInTheDocument();
    });

    const endChatButton = screen.getByText("End Chat");
    fireEvent.click(endChatButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/simulations/continue"),
        expect.objectContaining({
          method: "POST",
        })
      );
    });
  });

  it("displays documents panel when available", async () => {
    renderAttempt();

    await waitFor(() => {
      expect(screen.getByTestId("document-viewer")).toBeInTheDocument();
    });

    expect(screen.getByText("Document: Course Syllabus")).toBeInTheDocument();
  });

  it("shows results when all chats are completed", async () => {
    const completedChats = [
      {
        id: "chat1",
        createdAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        title: "Chat 1",
        scenarioId: "scenario1",
        attemptId: "attempt1",
        completed: true,
      },
      {
        id: "chat2",
        createdAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        title: "Chat 2",
        scenarioId: "scenario2",
        attemptId: "attempt1",
        completed: true,
      },
    ];
    vi.mocked(getSimulationChatsByAttempt).mockResolvedValue(completedChats);

    renderAttempt();

    await waitFor(() => {
      expect(screen.getByText("Session Results")).toBeInTheDocument();
    });
  });

  it("displays rubric when toggle is enabled in results", async () => {
    const completedChats = [
      {
        id: "chat1",
        createdAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        title: "Chat 1",
        scenarioId: "scenario1",
        attemptId: "attempt1",
        completed: true,
      },
      {
        id: "chat2",
        createdAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        title: "Chat 2",
        scenarioId: "scenario2",
        attemptId: "attempt1",
        completed: true,
      },
    ];
    vi.mocked(getSimulationChatsByAttempt).mockResolvedValue(completedChats);

    renderAttempt();

    await waitFor(() => {
      expect(screen.getByText("Session Results")).toBeInTheDocument();
    });

    const rubricToggle = screen.getByRole("button", { name: /show rubric/i });
    fireEvent.click(rubricToggle);

    await waitFor(() => {
      expect(screen.getByTestId("table-rubric")).toBeInTheDocument();
    });
  });

  it("handles scroll to bottom functionality", async () => {
    renderAttempt();

    await waitFor(() => {
      expect(screen.getByTestId("message-input")).toBeInTheDocument();
    });

    // Simulate scroll event to show scroll button
    const scrollArea = document.querySelector(
      "[data-radix-scroll-area-viewport]"
    );
    if (scrollArea) {
      Object.defineProperty(scrollArea, "scrollHeight", { value: 1000 });
      Object.defineProperty(scrollArea, "clientHeight", { value: 400 });
      Object.defineProperty(scrollArea, "scrollTop", { value: 0 });

      fireEvent.scroll(scrollArea);

      await waitFor(() => {
        expect(
          screen.getByTestId("scroll-to-bottom-button")
        ).toBeInTheDocument();
      });

      const scrollButton = screen.getByTestId("scroll-to-bottom-button");
      fireEvent.click(scrollButton);
    }
  });

  it("handles auto-focus typing functionality", async () => {
    renderAttempt();

    await waitFor(() => {
      expect(screen.getByTestId("message-input")).toBeInTheDocument();
    });

    // Simulate typing when not focused on input
    fireEvent.keyDown(document, { key: "a" });

    const messageInput = screen.getByTestId(
      "message-input"
    ) as HTMLTextAreaElement;
    expect(document.activeElement).toBe(messageInput);
  });

  it("displays error when attempt not found", async () => {
    vi.mocked(getSimulationAttempt).mockRejectedValue(new Error("Not found"));

    renderAttempt("invalid-attempt");

    await waitFor(() => {
      expect(screen.getByText("Attempt Not Found")).toBeInTheDocument();
    });

    expect(screen.getByText("Return To Dashboard")).toBeInTheDocument();
  });

  it("handles time limit expiration", async () => {
    // Mock an attempt that started 31 minutes ago (past the 30-minute limit)
    const expiredAttempt = {
      ...mockAttempt,
      createdAt: new Date(Date.now() - 31 * 60 * 1000).toISOString(),
    };

    vi.mocked(getSimulationAttempt).mockResolvedValue(expiredAttempt);

    renderAttempt();

    await waitFor(() => {
      expect(
        screen.getByText("Time's up! The session has ended.")
      ).toBeInTheDocument();
    });
  });

  it("handles single chat attempt mode", async () => {
    const singleChatSimulation = {
      id: "simulation1",
      createdAt: new Date().toISOString(),
      title: "Test Simulation",
      timeLimit: 30,
      active: true,
      scenarioIds: ["scenario1"], // Only one scenario
      rubricId: "rubric1",
    };

    vi.mocked(getSimulation).mockResolvedValue(singleChatSimulation);

    renderAttempt();

    await waitFor(() => {
      expect(screen.getByText("End Session")).toBeInTheDocument();
    });

    // Should not show progress indicator for single chat
    expect(screen.queryByText("100%")).not.toBeInTheDocument();
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
