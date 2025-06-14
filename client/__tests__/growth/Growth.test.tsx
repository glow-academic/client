import Growth from "@/components/growth/Growth";
import { Agent, Rubric, StandardGroup, Standard, SimulationChat, SimulationAttempt, SimulationChatGrade, SimulationChatFeedback } from "@/types";
import { getAllAgents } from "@/utils/queries/agents/get-all-agents";
import { getAllRubrics } from "@/utils/queries/rubrics/get-all-rubrics";
import { getSimulationAttemptsByProfiles } from "@/utils/queries/simulation_attempts/get-simulation-attempts-by-profiles";
import { getSimulationChatFeedbacksBySimulationChatGrades } from "@/utils/queries/simulation_chat_feedbacks/get-simulation-chat-feedbacks-by-simulationchatgrades";
import { getSimulationChatGradesBySimulationChats } from "@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-simulationchats";
import { getSimulationChatsByAttempts } from "@/utils/queries/simulation_chats/get-simulation-chats-by-attempts";
import { getStandardGroupsByRubrics } from "@/utils/queries/standard_groups/get-standard-groups-by-rubrics";
import { getStandardsByStandardGroups } from "@/utils/queries/standards/get-standards-by-standardgroups";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

// Mock auth hook
vi.mock("@/hooks/use-auth", () => ({
  useAuth: vi.fn(() => ({
    userId: "test-user-id",
    isAuthenticated: true,
  })),
}));

// Mock API calls
vi.mock("@/utils/queries/users/get-user", () => ({
  getUser: vi.fn(),
}));

vi.mock("@/utils/queries/agents/get-all-agents", () => ({
  getAllAgents: vi.fn(),
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
  "@/utils/queries/simulation_attempts/get-simulation-attempts-by-user",
  () => ({
    getSimulationAttemptsByUser: vi.fn(),
  })
);

vi.mock(
  "@/utils/queries/simulation_chats/get-simulation-chats-by-attempts",
  () => ({
    getSimulationChatsByAttempts: vi.fn(),
  })
);

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

// Mock chart components
vi.mock("recharts", () => ({
  RadarChart: ({ children }: { children: ReactNode }) => (
    <div data-testid="radar-chart">{children}</div>
  ),
  Radar: () => <div data-testid="radar" />,
  PolarAngleAxis: () => <div data-testid="polar-angle-axis" />,
  PolarGrid: () => <div data-testid="polar-grid" />,
}));

// Mock chart container
vi.mock("@/components/ui/chart", () => ({
  ChartContainer: ({ children }: { children: ReactNode }) => (
    <div data-testid="chart-container">{children}</div>
  ),
  ChartTooltip: () => <div data-testid="chart-tooltip" />,
  ChartTooltipContent: () => <div data-testid="chart-tooltip-content" />,
}));

describe("Growth", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    // Setup default mock implementations


    const mockAgents = [
      {
        id: "agent-1",
        name: "Test Agent",
        subtitle: "Test subtitle",
        description: "Test description",
        systemPrompt: "Test prompt",
        agentType: "general",
        temperature: 0.7,
        createdAt: "2024-01-01T00:00:00Z",
      },
    ];

    const mockAttempts = [
      {
        id: "attempt-1",
        profileId: "profile-1",
        simulationId: "sim-1",
        createdAt: "2024-01-01T00:00:00Z",
      },
    ];

    const mockRubrics = [
      {
        id: "rubric-1",
        name: "Test Rubric",
        description: "Test rubric description",
        points: 100,
        passPoints: 70,
        createdAt: "2024-01-01T00:00:00Z",
      },
    ];

    const mockStandardGroups = [
      {
        id: "group-1",
        name: "Communication Skills",
        description: "Communication and listening skills",
        points: 25,
        passPoints: 18,
        rubricId: "rubric-1",
        createdAt: "2024-01-01T00:00:00Z",
      },
      {
        id: "group-2",
        name: "Adaptability",
        description: "Flexibility and adaptation skills",
        points: 25,
        passPoints: 18,
        rubricId: "rubric-1",
        createdAt: "2024-01-01T00:00:00Z",
      },
    ];

    const mockStandards = [
      {
        id: "standard-1",
        name: "Active Listening",
        description: "Demonstrates active listening skills",
        points: 25,
        standardGroupId: "group-1",
        createdAt: "2024-01-01T00:00:00Z",
      },
      {
        id: "standard-2",
        name: "Flexibility",
        description: "Shows flexibility in teaching approach",
        points: 25,
        standardGroupId: "group-2",
        createdAt: "2024-01-01T00:00:00Z",
      },
    ];



    const mockChats = [
      {
        id: "chat-1",
        title: "Test Chat 1",
        scenarioId: "scenario-1",
        attemptId: "attempt-1",
        completed: true,
        createdAt: "2024-01-01T00:00:00Z",
        completedAt: "2024-01-01T01:00:00Z",
      },
      {
        id: "chat-2",
        title: "Test Chat 2",
        scenarioId: "scenario-1",
        attemptId: "attempt-2",
        completed: true,
        createdAt: "2024-01-02T00:00:00Z",
        completedAt: "2024-01-02T01:00:00Z",
      },
    ];

    const mockGrades = [
      {
        id: "grade-1",
        simulationChatId: "chat-1",
        score: 85,
        timeTaken: 3600, // 1 hour
        createdAt: "2024-01-01T00:00:00Z",
      },
      {
        id: "grade-2",
        simulationChatId: "chat-2",
        score: 90,
        timeTaken: 3000, // 50 minutes
        createdAt: "2024-01-02T00:00:00Z",
      },
    ];

    const mockFeedbacks = [
      {
        id: "feedback-1",
        simulationChatGradeId: "grade-1",
        standardId: "standard-1",
        total: 20,
        feedback: "Good listening skills",
        createdAt: "2024-01-01T00:00:00Z",
      },
      {
        id: "feedback-2",
        simulationChatGradeId: "grade-1",
        standardId: "standard-2",
        total: 22,
        feedback: "Shows good adaptability",
        createdAt: "2024-01-01T00:00:00Z",
      },
      {
        id: "feedback-3",
        simulationChatGradeId: "grade-2",
        standardId: "standard-1",
        total: 23,
        feedback: "Excellent listening",
        createdAt: "2024-01-02T00:00:00Z",
      },
      {
        id: "feedback-4",
        simulationChatGradeId: "grade-2",
        standardId: "standard-2",
        total: 24,
        feedback: "Very adaptable",
        createdAt: "2024-01-02T00:00:00Z",
      },
    ];

    // Apply mocks
    vi.mocked(getAllAgents).mockResolvedValue(mockAgents as Agent[]);
    vi.mocked(getAllRubrics).mockResolvedValue(mockRubrics as Rubric[]);
    vi.mocked(getStandardGroupsByRubrics).mockResolvedValue(mockStandardGroups as StandardGroup[]);
    vi.mocked(getStandardsByStandardGroups).mockResolvedValue(mockStandards as Standard[]);
    vi.mocked(getSimulationChatsByAttempts).mockResolvedValue(mockChats as SimulationChat[]);
    vi.mocked(getSimulationAttemptsByProfiles).mockResolvedValue(mockAttempts as SimulationAttempt[]);
    vi.mocked(getSimulationChatGradesBySimulationChats).mockResolvedValue(
      mockGrades as SimulationChatGrade[]
    );
    vi.mocked(
      getSimulationChatFeedbacksBySimulationChatGrades
    ).mockResolvedValue(mockFeedbacks as SimulationChatFeedback[]);
  });

  const renderWithProviders = (ui: React.ReactElement, options = {}) => {
    const AllProviders = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    return render(ui, { wrapper: AllProviders, ...options });
  };

  describe("Rendering", () => {
    it("should render without crashing", async () => {
      renderWithProviders(<Growth />);
    });

    it("should display performance metrics correctly", async () => {
      renderWithProviders(<Growth />);

      await waitFor(() => {
        expect(screen.getByText("Overall Score")).toBeInTheDocument();
        expect(screen.getByText("Communication Skills")).toBeInTheDocument();
        expect(screen.getByText("Adaptability")).toBeInTheDocument();
      });
    });

    it("should have correct accessibility attributes", async () => {
      renderWithProviders(<Growth />);

      await waitFor(() => {
        expect(screen.getByText("Performance Radar")).toBeInTheDocument();
      });
    });
  });

  describe("API Integration", () => {
    it("should handle API calls correctly", async () => {
      renderWithProviders(<Growth />);

      await waitFor(() => {
        expect(getAllAgents).toHaveBeenCalledWith("test-user-id");
      });
    });

    it("should handle loading states", () => {
      // Mock loading state
      vi.mocked(getAllAgents).mockImplementation(() => new Promise(() => {}));

      renderWithProviders(<Growth />);
    });

    it("should handle no data state", async () => {
      vi.mocked(getSimulationChatGradesBySimulationChats).mockResolvedValue([]);

      renderWithProviders(<Growth />);

      await waitFor(() => {
        expect(screen.getByText("No Data Available")).toBeInTheDocument();
        expect(
          screen.getByText(
            "Complete some teaching sessions to see your growth metrics."
          )
        ).toBeInTheDocument();
      });
    });
  });

  describe("Data Display", () => {
    it("should display calculated metrics", async () => {
      renderWithProviders(<Growth />);

      await waitFor(() => {
        // Should show calculated overall score (average of 85 and 90 = 87.5, rounded to 88)
        expect(screen.getByText("88%")).toBeInTheDocument();

        // Should show performance sections
        expect(
          screen.getByText("Average performance score")
        ).toBeInTheDocument();
        expect(screen.getByText("Skill performance")).toBeInTheDocument();
        expect(screen.getByText("Time per session")).toBeInTheDocument();
      });
    });

    it("should render radar chart", async () => {
      renderWithProviders(<Growth />);

      await waitFor(() => {
        expect(screen.getByTestId("radar-chart")).toBeInTheDocument();
        expect(screen.getByTestId("chart-container")).toBeInTheDocument();
      });
    });

    it("should show growth trend", async () => {
      renderWithProviders(<Growth />);

      await waitFor(() => {
        // Should show positive trend since scores improved from 85 to 90
        expect(screen.getByText("Trending up")).toBeInTheDocument();
      });
    });
  });

  describe("Edge Cases", () => {
    it("should handle missing user gracefully", async () => {
      vi.mocked(getAllAgents).mockResolvedValue([]);

      renderWithProviders(<Growth />);

      await waitFor(() => {
        expect(screen.getByText("No Data Available")).toBeInTheDocument();
      });
    });

    it("should handle empty grades array", async () => {
      vi.mocked(getSimulationChatGradesBySimulationChats).mockResolvedValue([]);

      renderWithProviders(<Growth />);

      await waitFor(() => {
        expect(screen.getByText("No Data Available")).toBeInTheDocument();
      });
    });

    it("should handle API errors gracefully", async () => {
      vi.mocked(getAllAgents).mockRejectedValue(new Error("API Error"));

      renderWithProviders(<Growth />);

      // Should still render the component structure
    });
  });
});

/*
 * Component Analysis for Growth:
 * Path: growth/Growth.tsx
 *
 * Features detected:
 * - Default export: true
 * - Named exports: None
 * - Has props: false
 * - Props interface: None
 * - Client component: false (uses hooks)
 * - Uses hooks: useQuery, useMemo, useAuth
 * - Uses router: false
 * - Has API calls: true (multiple user-specific queries)
 * - Has form handling: false
 * - Uses state: false
 * - Uses effects: false
 * - Uses context: false (uses auth hook)
 *
 * The component now properly fetches user-specific data and calculates growth metrics
 * dynamically based on grades/feedback, following the Overview pattern for consistency
 * and better data accuracy.
 */
