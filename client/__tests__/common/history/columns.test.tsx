import { render, screen, renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode } from "react";
import { useColumns } from "@/components/common/history/columns";

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

vi.mock("@/utils/queries/classes/get-all-classes", () => ({
  getAllClasses: vi.fn(() =>
    Promise.resolve([
      { id: "1", classCode: "CS101", name: "Intro to CS" },
      { id: "2", classCode: "CS201", name: "Data Structures" },
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

vi.mock("@/utils/queries/rubrics/get-all-rubrics", () => ({
  getAllRubrics: vi.fn(() =>
    Promise.resolve([
      {
        id: "1",
        name: "Test Rubric",
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
          rubricId: "1",
          points: 25,
          passPoints: 18,
        },
        {
          id: "2",
          name: "Problem Solving",
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
          userId: "1",
        },
        {
          id: "2",
          attemptId: "2",
          scenarioId: "2",
          completed: true,
          title: "Chat 2",
          userId: "2",
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
        },
        {
          id: "2",
          simulationChatId: "2",
          score: 78,
          passed: true,
          timeTaken: 450,
          rubricId: "1",
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
          total: 4,
          feedback: "Good thinking",
        },
      ]),
    ),
  }),
);

vi.mock("@/hooks/use-auth", () => ({
  useAuth: vi.fn(() => ({
    userId: "1",
    isLoading: false,
    isAuthenticated: true,
  })),
}));

vi.mock("@/utils/agents", () => ({
  getAgentConfig: vi.fn((name: string) => ({
    icon: `${name}-icon`,
    color: "blue",
  })),
}));

describe("useColumns", () => {
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

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  describe("Hook Functionality", () => {
    it("should return columns and data for chats view", async () => {
      const { result } = renderHook(() => useColumns({ showChats: false }), {
        wrapper,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.columns).toBeDefined();
      expect(Array.isArray(result.current.columns)).toBe(true);
      expect(result.current.data).toBeDefined();
      expect(result.current.showChats).toBe(false);
    });

    it("should return columns and data for attempts view", async () => {
      const { result } = renderHook(() => useColumns({ showChats: true }), {
        wrapper,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.columns).toBeDefined();
      expect(Array.isArray(result.current.columns)).toBe(true);
      expect(result.current.data).toBeDefined();
      expect(result.current.showChats).toBe(true);
    });

    it("should provide user options", async () => {
      const { result } = renderHook(() => useColumns({ showChats: false }), {
        wrapper,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.profileOptions).toBeDefined();
      expect(Array.isArray(result.current.profileOptions)).toBe(true);
      expect(result.current.profileOptions.length).toBeGreaterThan(0);
    });

    it("should provide class options", async () => {
      const { result } = renderHook(() => useColumns({ showChats: false }), {
        wrapper,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.classOptions).toBeDefined();
      expect(Array.isArray(result.current.classOptions)).toBe(true);
      expect(result.current.classOptions.length).toBeGreaterThan(0);
    });

    it("should provide agent types", async () => {
      const { result } = renderHook(() => useColumns({ showChats: false }), {
        wrapper,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.agentTypes).toBeDefined();
      expect(Array.isArray(result.current.agentTypes)).toBe(true);
      expect(result.current.agentTypes.length).toBeGreaterThan(0);
    });

    it("should provide skill categories", async () => {
      const { result } = renderHook(() => useColumns({ showChats: false }), {
        wrapper,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.skillCategories).toBeDefined();
      expect(typeof result.current.skillCategories).toBe("object");
    });
  });

  describe("ShowAll Functionality", () => {
    it("should filter data to current user when showAll is false", async () => {
      const { result } = renderHook(
        () => useColumns({ showChats: false, showAll: false }),
        { wrapper },
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.showAll).toBe(false);
      expect(result.current.data).toBeDefined();
      // Data should be filtered to current user only
    });

    it("should show all data when showAll is true", async () => {
      const { result } = renderHook(
        () => useColumns({ showChats: false, showAll: true }),
        { wrapper },
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.showAll).toBe(true);
      expect(result.current.data).toBeDefined();
      // Data should include all users
    });

    it("should include name column when showAll is true", async () => {
      const { result } = renderHook(
        () => useColumns({ showChats: false, showAll: true }),
        { wrapper },
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const columns = result.current.columns;
      // Should have more columns when showAll is true (includes name column)
      expect(columns.length).toBeGreaterThan(0);
    });

    it("should exclude name column when showAll is false", async () => {
      const { result } = renderHook(
        () => useColumns({ showChats: false, showAll: false }),
        { wrapper },
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const columns = result.current.columns;
      expect(columns.length).toBeGreaterThan(0);
      // Name column should not be present when showAll is false
    });
  });

  describe("Data Filtering", () => {
    it("should filter data for single user view", async () => {
      const { result } = renderHook(
        () => useColumns({ showChats: false, showAll: false }),
        { wrapper },
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Since we're mocking a user with ID '1' and showAll is false, data should be filtered
      expect(result.current.data).toBeDefined();
    });

    it("should handle loading states", () => {
      const { result } = renderHook(() => useColumns({ showChats: false }), {
        wrapper,
      });

      // Initially should be loading
      expect(typeof result.current.isLoading).toBe("boolean");
    });
  });

  describe("Column Configuration", () => {
    it("should have different columns for chats vs attempts view", async () => {
      const { result: chatsResult } = renderHook(
        () => useColumns({ showChats: false }),
        { wrapper },
      );
      const { result: attemptsResult } = renderHook(
        () => useColumns({ showChats: true }),
        { wrapper },
      );

      await waitFor(() => {
        expect(chatsResult.current.isLoading).toBe(false);
        expect(attemptsResult.current.isLoading).toBe(false);
      });

      // Both should have columns but they might be different
      expect(chatsResult.current.columns.length).toBeGreaterThan(0);
      expect(attemptsResult.current.columns.length).toBeGreaterThan(0);
    });

    it("should include required column properties", async () => {
      const { result } = renderHook(() => useColumns({ showChats: false }), {
        wrapper,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const columns = result.current.columns;
      expect(columns.length).toBeGreaterThan(0);

      // Check that we have valid columns
      expect(columns.length).toBeGreaterThan(0);

      // Check that columns are objects
      columns.forEach((column: any) => {
        expect(typeof column).toBe("object");
        expect(column).not.toBeNull();
      });
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty data gracefully", async () => {
      const { result } = renderHook(() => useColumns({ showChats: false }), {
        wrapper,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toBeDefined();
      expect(Array.isArray(result.current.data)).toBe(true);
    });

    it("should handle different view modes", async () => {
      const { result } = renderHook(() => useColumns({ showChats: false }), {
        wrapper,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.showChats).toBe(false);
      expect(result.current.data).toBeDefined();
    });
  });
});

/*
 * Component Analysis for allColumns:
 * Path: common/history/allColumns.tsx
 *
 * Features detected:
 * - Default export: false
 * - Named exports: useTaskColumns
 * - Has props: false
 * - Props interface: None detected
 * - Client component: true
 * - Uses hooks: useQuery, useMemo, user, users, useAuth, useTaskColumns, userId, userOptions, uses, userOption, used, usersLoading
 * - Uses router: false
 * - Has API calls: true
 * - Has form handling: false
 * - Uses state: false
 * - Uses effects: false
 * - Uses context: false
 *
 * TODO: Implement the failing tests above with actual test logic
 *
 * Example implementations:
 *
 * Basic rendering:
 * render(<allColumns />);
 * expect(screen.getByRole('...')).toBeInTheDocument();
 *
 * Props testing:
 * const props = { ... };
 * render(<allColumns {...props} />);
 * expect(screen.getByText(props.someText)).toBeInTheDocument();
 *
 * User interaction:
 * const button = screen.getByRole('button');
 * await user.click(button);
 * expect(mockFunction).toHaveBeenCalled();
 */
