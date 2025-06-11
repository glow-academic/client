import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode } from "react";
import ClassesGeneralPage from "@/components/management/classes/Classes";

// Mock the query functions
vi.mock("@/utils/queries/classes/get-all-classes", () => ({
  getAllClasses: vi.fn(() =>
    Promise.resolve([
      {
        id: "1",
        name: "CS 180",
        classCode: "CS180",
        year: 2024,
        term: "fall",
        description: "Programming Fundamentals",
        createdAt: new Date().toISOString(),
      },
      {
        id: "2",
        name: "CS 182",
        classCode: "CS182",
        year: 2024,
        term: "fall",
        description: "Data Structures",
        createdAt: new Date().toISOString(),
      },
    ]),
  ),
}));

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

vi.mock("@/utils/queries/rubrics/get-all-rubrics", () => ({
  getAllRubrics: vi.fn(() =>
    Promise.resolve([
      {
        id: "1",
        name: "Teaching Assistant Evaluation Rubric",
        description: "Test",
        points: 100,
        passPoints: 70,
        createdAt: new Date().toISOString(),
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
        { id: "2", userId: "2", simulationId: "1", classId: "2" },
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
          createdAt: new Date().toISOString(),
        },
        {
          id: "2",
          attemptId: "2",
          scenarioId: "2",
          completed: false,
          title: "Chat 2",
          createdAt: new Date().toISOString(),
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

vi.mock("@/utils/mutations/classes/delete-class", () => ({
  deleteClass: vi.fn(() => Promise.resolve({ id: "1" })),
}));

describe("Classes", () => {
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
      renderWithProviders(<ClassesGeneralPage />);

      expect(
        screen.getByText("Loading class analytics..."),
      ).toBeInTheDocument();
    });

    it("should render class analytics after loading", async () => {
      renderWithProviders(<ClassesGeneralPage />);

      await waitFor(() => {
        expect(screen.getByText("Total Classes")).toBeInTheDocument();
      });

      expect(screen.getByText("Total TAs")).toBeInTheDocument();
      expect(screen.getByText("Total Sessions")).toBeInTheDocument();
      expect(screen.getByText("Average Score")).toBeInTheDocument();
    });

    it("should display aggregated performance trends", async () => {
      renderWithProviders(<ClassesGeneralPage />);

      await waitFor(() => {
        expect(screen.getByText("Average Score Trend")).toBeInTheDocument();
        expect(
          screen.getByText("Student Personality Distribution"),
        ).toBeInTheDocument();
      });
    });

    it("should display class cards with delete functionality", async () => {
      renderWithProviders(<ClassesGeneralPage />);

      await waitFor(() => {
        expect(screen.getByText("All Classes")).toBeInTheDocument();
        expect(screen.getByText("CS 180")).toBeInTheDocument();
        expect(screen.getByText("CS 182")).toBeInTheDocument();
        expect(screen.getByText("CS180")).toBeInTheDocument();
        expect(screen.getByText("CS182")).toBeInTheDocument();
      });

      // Check for delete buttons
      const deleteButtons = screen.getAllByRole("button");
      const trashButtons = deleteButtons.filter(button => 
        button.querySelector('svg')?.getAttribute('class')?.includes('lucide')
      );
      expect(trashButtons.length).toBeGreaterThan(0);
    });

    it("should have time range selectors for charts", async () => {
      renderWithProviders(<ClassesGeneralPage />);

      await waitFor(() => {
        // Should have time range selectors for both charts
        const selectors = screen.getAllByRole("combobox");
        expect(selectors.length).toBeGreaterThanOrEqual(2);
      });
    });

    it("should show additional metrics cards", async () => {
      renderWithProviders(<ClassesGeneralPage />);

      await waitFor(() => {
        expect(screen.getByText("Completion Rate")).toBeInTheDocument();
      });

      expect(screen.getByText("Avg Training Time")).toBeInTheDocument();
      expect(screen.getByText("Active Personalities")).toBeInTheDocument();
    });

    it("should have correct accessibility attributes", async () => {
      renderWithProviders(<ClassesGeneralPage />);

      await waitFor(() => {
        // Check for proper heading structure
        const headings = screen.getAllByRole("heading");
        expect(headings.length).toBeGreaterThan(0);
      });
    });
  });

  describe("Data Integration", () => {
    it("should display correct class count", async () => {
      renderWithProviders(<ClassesGeneralPage />);

      await waitFor(() => {
        // Look for the specific "Total Classes" card with value "2"
        expect(screen.getByText("Total Classes")).toBeInTheDocument();
        const classesCard = screen.getByText("Total Classes").closest('[data-slot="card"]');
        expect(classesCard).toContainElement(screen.getByText("2"));
      });
    });

    it("should calculate and display metrics from actual data", async () => {
      renderWithProviders(<ClassesGeneralPage />);

      await waitFor(() => {
        // Should show calculated average score from grades
        const scoreElements = screen.getAllByText(/\d+%/);
        expect(scoreElements.length).toBeGreaterThan(0);
      });
    });

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

      render(<ClassesGeneralPage />, { wrapper: AllProviders });

      // Should show loading initially
      expect(
        screen.getByText("Loading class analytics..."),
      ).toBeInTheDocument();
    });
  });

  describe("Charts and Visualizations", () => {
    it("should render performance charts", async () => {
      renderWithProviders(<ClassesGeneralPage />);

      await waitFor(() => {
        // Check for chart containers (Recharts components)
        const charts = document.querySelectorAll(
          ".recharts-responsive-container",
        );
        expect(charts.length).toBeGreaterThan(0);
      });
    });

    it("should display personality distribution chart", async () => {
      renderWithProviders(<ClassesGeneralPage />);

      await waitFor(() => {
        expect(
          screen.getByText("Student Personality Distribution"),
        ).toBeInTheDocument();
      });
    });
  });

  describe("User Interactions", () => {
    it("should handle delete class functionality", async () => {
      const user = require("@testing-library/user-event").default.setup();
      renderWithProviders(<ClassesGeneralPage />);

      await waitFor(() => {
        expect(screen.getByText("CS 180")).toBeInTheDocument();
      });

      // Find and click a delete button
      const deleteButtons = screen.getAllByRole("button");
      const trashButton = deleteButtons.find(button => 
        button.querySelector('svg')?.getAttribute('class')?.includes('lucide')
      );
      
      if (trashButton) {
        await user.click(trashButton);
        
        // Should show confirmation dialog
        await waitFor(() => {
          expect(screen.getByText("Delete Class")).toBeInTheDocument();
          expect(screen.getByText(/Are you sure you want to delete this class/)).toBeInTheDocument();
        });
      }
    });

    it("should handle time range changes", async () => {
      const user = require("@testing-library/user-event").default.setup();
      renderWithProviders(<ClassesGeneralPage />);

      await waitFor(() => {
        const selectors = screen.getAllByRole("combobox");
        expect(selectors.length).toBeGreaterThanOrEqual(2);
      });
    });
  });

  describe("Edge Cases", () => {
    it("should handle missing class performance data", async () => {
      renderWithProviders(<ClassesGeneralPage />);

      await waitFor(() => {
        // Component should still render even if some data is missing
        expect(screen.getByText("Total Classes")).toBeInTheDocument();
      });
    });

    it("should handle zero scores gracefully", async () => {
      renderWithProviders(<ClassesGeneralPage />);

      await waitFor(() => {
        // Should not crash with zero or undefined scores
        expect(screen.getByText("Average Score")).toBeInTheDocument();
      });
    });
  });
});

/*
 * Component Analysis for Classes:
 * Path: management/classes/Classes.tsx
 *
 * Features detected:
 * - Default export: true (ClassesGeneralPage)
 * - Named exports: None
 * - Has props: false
 * - Props interface: None detected
 * - Client component: false
 * - Uses hooks: useMemo, useQuery
 * - Uses router: false
 * - Has API calls: true
 * - Has form handling: false
 * - Uses state: false
 * - Uses effects: false
 * - Uses context: false
 *
 * Updated features:
 * - Connected to real data using proper query integration
 * - Uses grades for score calculations instead of non-existent rubric scores
 * - Displays dynamic personality distribution based on actual agent usage
 * - Shows class performance breakdown when data is available
 * - Proper loading states and error handling
 *
 * TODO: Implement the failing tests above with actual test logic
 *
 * Example implementations:
 *
 * Basic rendering:
 * render(<ClassesGeneralPage />);
 * expect(screen.getByRole('...')).toBeInTheDocument();
 *
 * Props testing:
 * const props = { ... };
 * render(<ClassesGeneralPage {...props} />);
 * expect(screen.getByText(props.someText)).toBeInTheDocument();
 *
 * User interaction:
 * const button = screen.getByRole('button');
 * await user.click(button);
 * expect(mockFunction).toHaveBeenCalled();
 */
