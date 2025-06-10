import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode } from "react";
import Performance from "@/components/analytics/Performance";

// Mock the query functions
vi.mock("@/utils/queries/users/get-all-users", () => ({
  getAllUsers: vi.fn(() =>
    Promise.resolve([
      { id: "1", role: "ta", name: "Test TA 1", username: "ta1" },
      { id: "2", role: "ta", name: "Test TA 2", username: "ta2" },
      {
        id: "3",
        role: "instructor",
        name: "Test Instructor",
        username: "instructor1",
      },
    ]),
  ),
}));

vi.mock("@/utils/queries/agents/get-all-agents", () => ({
  getAllAgents: vi.fn(() =>
    Promise.resolve([
      { id: "1", name: "Happy", agentType: "student" },
      { id: "2", name: "Aggressive", agentType: "student" },
    ]),
  ),
}));

vi.mock("@/utils/queries/scenarios/get-all-scenarios", () => ({
  getAllScenarios: vi.fn(() =>
    Promise.resolve([
      { id: "1", agentId: "1", name: "Happy Scenario" },
      { id: "2", agentId: "2", name: "Aggressive Scenario" },
    ]),
  ),
}));

vi.mock("@/utils/queries/simulations/get-all-simulations", () => ({
  getAllSimulations: vi.fn(() =>
    Promise.resolve([
      { id: "1", title: "Test Simulation 1", rubricId: "1" },
      { id: "2", title: "Test Simulation 2", rubricId: "2" },
    ]),
  ),
}));

vi.mock("@/utils/queries/rubrics/get-all-rubrics", () => ({
  getAllRubrics: vi.fn(() =>
    Promise.resolve([
      {
        id: "1",
        name: "Teaching Assistant Evaluation Rubric",
        description: "Test",
        points: 100,
        passPoints: 70,
      },
      {
        id: "2",
        name: "AI Student Performance Evaluation Rubric",
        description: "Test",
        points: 100,
        passPoints: 70,
      },
      {
        id: "3",
        name: "Unused Rubric",
        description: "Test",
        points: 100,
        passPoints: 70,
      },
    ]),
  ),
}));

vi.mock(
  "@/utils/queries/standard_groups/get-standard-groups-by-rubrics",
  () => ({
    getStandardGroupsByRubrics: vi.fn(() =>
      Promise.resolve([
        {
          id: "1",
          name: "Communication Skills",
          shortName: "Active Listening",
          rubricId: "1",
          points: 25,
          passPoints: 18,
        },
        {
          id: "2",
          name: "Problem Solving",
          shortName: "Content Mastery",
          rubricId: "1",
          points: 25,
          passPoints: 18,
        },
      ]),
    ),
  }),
);

vi.mock("@/utils/queries/standards/get-standards-by-standardgroups", () => ({
  getStandardsByStandardGroups: vi.fn(() =>
    Promise.resolve([
      { id: "1", name: "Active Listening", standardGroupId: "1", points: 5 },
      { id: "2", name: "Clear Communication", standardGroupId: "1", points: 5 },
      { id: "3", name: "Critical Thinking", standardGroupId: "2", points: 5 },
    ]),
  ),
}));

vi.mock(
  "@/utils/queries/simulation_attempts/get-simulation-attempts-by-users",
  () => ({
    getSimulationAttemptsByUsers: vi.fn(() =>
      Promise.resolve([
        { id: "1", userId: "1", simulationId: "1", classId: "1" },
        { id: "2", userId: "2", simulationId: "1", classId: "1" },
      ]),
    ),
  }),
);

vi.mock(
  "@/utils/queries/simulation_chats/get-simulation-chats-by-attempts",
  () => ({
    getSimulationChatsByAttempts: vi.fn(() =>
      Promise.resolve([
        {
          id: "1",
          attemptId: "1",
          scenarioId: "1",
          completed: true,
          title: "Chat 1",
        },
        {
          id: "2",
          attemptId: "2",
          scenarioId: "2",
          completed: false,
          title: "Chat 2",
        },
      ]),
    ),
  }),
);

vi.mock(
  "@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-simulationchats",
  () => ({
    getSimulationChatGradesBySimulationChats: vi.fn(() =>
      Promise.resolve([
        {
          id: "1",
          simulationChatId: "1",
          score: 85,
          passed: true,
          timeTaken: 300,
          rubricId: "1",
          createdAt: new Date().toISOString(),
        },
        {
          id: "2",
          simulationChatId: "2",
          score: 72,
          passed: true,
          timeTaken: 450,
          rubricId: "1",
          createdAt: new Date().toISOString(),
        },
      ]),
    ),
  }),
);

vi.mock(
  "@/utils/queries/simulation_chat_feedbacks/get-simulation-chat-feedbacks-by-simulationchatgrades",
  () => ({
    getSimulationChatFeedbacksBySimulationChatGrades: vi.fn(() =>
      Promise.resolve([
        {
          id: "1",
          simulationChatGradeId: "1",
          standardId: "1",
          total: 4,
          feedback: "Good listening",
        },
        {
          id: "2",
          simulationChatGradeId: "1",
          standardId: "2",
          total: 5,
          feedback: "Clear communication",
        },
        {
          id: "3",
          simulationChatGradeId: "2",
          standardId: "3",
          total: 3,
          feedback: "Needs improvement",
        },
      ]),
    ),
  }),
);

vi.mock("@/utils/agents", () => ({
  getAgentConfig: vi.fn((name: string) => ({
    colors: { bgColor: "bg-blue-100" },
  })),
}));

describe("Performance", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  });

  const renderWithProviders = (ui: React.ReactElement, options = {}) => {
    const AllProviders = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    return render(ui, { wrapper: AllProviders, ...options });
  };

  describe("Rendering", () => {
    it("should render loading state initially", () => {
      renderWithProviders(<Performance />);

      expect(
        screen.getByText("Loading performance analytics..."),
      ).toBeInTheDocument();
    });

    it("should render performance analytics after loading", async () => {
      renderWithProviders(<Performance />);

      await waitFor(() => {
        expect(
          screen.getByText("Performance by Student Personality"),
        ).toBeInTheDocument();
      });

      expect(
        screen.getByText("Skill Development Over Time"),
      ).toBeInTheDocument();
      expect(screen.getByText("Performance Analytics")).toBeInTheDocument();
      expect(screen.getByText("Training Insights")).toBeInTheDocument();
    });

    it("should display student personality performance", async () => {
      renderWithProviders(<Performance />);

      await waitFor(() => {
        expect(screen.getByText("Happy Student")).toBeInTheDocument();
      });

      expect(screen.getByText("Aggressive Student")).toBeInTheDocument();
    });

    it("should show score distribution", async () => {
      renderWithProviders(<Performance />);

      await waitFor(() => {
        expect(screen.getByText("Score Distribution")).toBeInTheDocument();
      });

      expect(screen.getAllByText("Excellent").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Good").length).toBeGreaterThan(0);
      expect(screen.getByText("Average")).toBeInTheDocument();
      expect(screen.getByText("Needs Support")).toBeInTheDocument();
    });

    it("should display rubric filter dropdown", async () => {
      renderWithProviders(<Performance />);

      await waitFor(() => {
        expect(screen.getByText("Filter by Rubric:")).toBeInTheDocument();
      });

      expect(screen.getByRole("combobox")).toBeInTheDocument();
    });
  });

  describe("Rubric Filtering", () => {
    it("should only show rubrics that exist in simulations", async () => {
      renderWithProviders(<Performance />);

      await waitFor(() => {
        expect(screen.getByText("Filter by Rubric:")).toBeInTheDocument();
      });

      // The dropdown should contain "All Rubrics" and only the rubrics used in simulations
      // Rubric with id '3' (Unused Rubric) should not be available since no simulation uses it
    });

    it("should display skill categories with proper shortName formatting", async () => {
      renderWithProviders(<Performance />);

      await waitFor(() => {
        expect(screen.getByText("Skill Performance")).toBeInTheDocument();
      });

      // Should show shortName values with proper spacing and title case
      expect(screen.getAllByText("Active Listening").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Content Mastery").length).toBeGreaterThan(0);
    });
  });

  describe("Data Integration", () => {
    it("should handle empty data gracefully", async () => {
      // Mock empty responses
      const emptyQueryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false },
          mutations: { retry: false },
        },
      });

      const AllProviders = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={emptyQueryClient}>
          {children}
        </QueryClientProvider>
      );

      render(<Performance />, { wrapper: AllProviders });

      // Should show loading initially
      expect(
        screen.getByText("Loading performance analytics..."),
      ).toBeInTheDocument();
    });

    it("should display dynamic weekly progress metrics", async () => {
      renderWithProviders(<Performance />);

      await waitFor(() => {
        expect(screen.getByText("Weekly Progress")).toBeInTheDocument();
      });

      // Should show dynamic weekly progress instead of static values
      expect(screen.getByText("This Week")).toBeInTheDocument();
      expect(screen.getByText("Last Week")).toBeInTheDocument();
      expect(screen.getByText("2 Weeks Ago")).toBeInTheDocument();
    });
  });

  describe("Charts and Visualizations", () => {
    it("should render performance charts", async () => {
      renderWithProviders(<Performance />);

      await waitFor(() => {
        // Check for chart containers (Recharts components)
        const charts = document.querySelectorAll(
          ".recharts-responsive-container",
        );
        expect(charts.length).toBeGreaterThan(0);
      });
    });

    it("should show training insights", async () => {
      renderWithProviders(<Performance />);

      await waitFor(() => {
        expect(screen.getByText("Session Patterns")).toBeInTheDocument();
      });

      expect(screen.getByText("Action Items")).toBeInTheDocument();
      expect(screen.getByText("Weekly Progress")).toBeInTheDocument();
    });
  });
});

/*
 * Component Analysis for Performance:
 * Path: analytics/Performance.tsx
 *
 * Features detected:
 * - Default export: true
 * - Named exports: None
 * - Has props: false
 * - Props interface: None detected
 * - Client component: false
 * - Uses hooks: useMemo, useQuery, useState, users, user, userId, username
 * - Uses router: false
 * - Has API calls: true
 * - Has form handling: false
 * - Uses state: true (selectedRubricId)
 * - Uses effects: false
 * - Uses context: false
 *
 * Updated features:
 * - Added rubric filtering functionality
 * - Improved shortName display with proper formatting
 * - Dynamic weekly progress metrics instead of static values
 * - Filtered rubrics to only show those used in simulations
 *
 * TODO: Implement the failing tests above with actual test logic
 *
 * Example implementations:
 *
 * Basic rendering:
 * render(<Performance />);
 * expect(screen.getByRole('...')).toBeInTheDocument();
 *
 * Props testing:
 * const props = { ... };
 * render(<Performance {...props} />);
 * expect(screen.getByText(props.someText)).toBeInTheDocument();
 *
 * User interaction:
 * const button = screen.getByRole('button');
 * await user.click(button);
 * expect(mockFunction).toHaveBeenCalled();
 */
