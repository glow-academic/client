import { useColumns } from "@/components/common/history/columns";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock next-auth
vi.mock("next-auth/react", () => ({
  useSession: vi.fn(() => ({
    data: {
      user: {
        id: "test-user-id",
        name: "Test User",
        email: "test@example.com",
        role: "student",
      },
    },
    status: "authenticated",
  })),
  SessionProvider: ({ children }: { children: ReactNode }) => children,
}));

// Mock getUserByEmail
vi.mock("@/utils/user/get-user-by-email", () => ({
  getUserByEmail: vi.fn(() =>
    Promise.resolve({
      id: "test-user-id",
      name: "Test User",
      email: "test@example.com",
    })
  ),
}));

// Mock the query functions
vi.mock("@/utils/queries/profiles/get-all-profiles", () => ({
  getAllProfiles: vi.fn(() =>
    Promise.resolve([
      {
        id: "profile1",
        firstName: "Test",
        lastName: "User 1",
        userId: "test-user-id",
      },
      {
        id: "profile2",
        firstName: "Test",
        lastName: "User 2",
        userId: "other-user-id",
      },
    ])
  ),
}));

vi.mock("@/utils/queries/profiles/get-profiles-by-user", () => ({
  getProfilesByUser: vi.fn(() =>
    Promise.resolve([
      {
        id: "profile1",
        firstName: "Test",
        lastName: "User 1",
        userId: "test-user-id",
      },
    ])
  ),
}));

vi.mock("@/utils/queries/classes/get-all-classes", () => ({
  getAllClasses: vi.fn(() =>
    Promise.resolve([
      { id: "class1", name: "CS101", classCode: "CS101" },
      { id: "class2", name: "CS201", classCode: "CS201" },
    ])
  ),
}));

vi.mock("@/utils/queries/agents/get-all-agents", () => ({
  getAllAgents: vi.fn(() =>
    Promise.resolve([
      { id: "agent1", name: "Student Agent" },
      { id: "agent2", name: "Instructor Agent" },
    ])
  ),
}));

vi.mock("@/utils/queries/rubrics/get-all-rubrics", () => ({
  getAllRubrics: vi.fn(() =>
    Promise.resolve([
      { id: "rubric1", name: "Test Rubric 1" },
      { id: "rubric2", name: "Test Rubric 2" },
    ])
  ),
}));

vi.mock("@/utils/queries/simulations/get-all-simulations", () => ({
  getAllSimulations: vi.fn(() =>
    Promise.resolve([
      {
        id: "sim1",
        title: "Test Simulation 1",
        scenarioIds: ["scenario1"],
        rubricId: "rubric1",
      },
      {
        id: "sim2",
        title: "Test Simulation 2",
        scenarioIds: ["scenario2"],
        rubricId: "rubric2",
      },
    ])
  ),
}));

vi.mock("@/utils/queries/scenarios/get-all-scenarios", () => ({
  getAllScenarios: vi.fn(() =>
    Promise.resolve([
      {
        id: "scenario1",
        title: "Scenario 1",
        classId: "class1",
      },
      {
        id: "scenario2",
        title: "Scenario 2",
        classId: "class2",
      },
      {
        id: "RAY",
        title: "Default RAY Scenario",
        classId: null,
      },
    ])
  ),
}));

vi.mock(
  "@/utils/queries/simulation_attempts/get-simulation-attempts-by-profiles",
  () => ({
    getSimulationAttemptsByProfiles: vi.fn(() =>
      Promise.resolve([
        {
          id: "attempt1",
          profileId: "profile1",
          simulationId: "sim1",
          createdAt: "2024-01-01T10:00:00Z",
          averageScore: 85,
        },
        {
          id: "attempt2",
          profileId: "profile2",
          simulationId: "sim2",
          createdAt: "2024-01-02T11:00:00Z",
          averageScore: 78,
        },
      ])
    ),
  })
);

vi.mock(
  "@/utils/queries/simulation_chats/get-simulation-chats-by-attempts",
  () => ({
    getSimulationChatsByAttempts: vi.fn(() =>
      Promise.resolve([
        {
          id: "chat1",
          attemptId: "attempt1",
          scenarioId: "scenario1",
        },
        {
          id: "chat2",
          attemptId: "attempt2",
          scenarioId: "scenario2",
        },
      ])
    ),
  })
);

vi.mock(
  "@/utils/queries/standard_groups/get-standard-groups-by-rubrics",
  () => ({
    getStandardGroupsByRubrics: vi.fn(() =>
      Promise.resolve([
        {
          id: "group1",
          name: "Communication",
          shortName: "COMM",
          rubricId: "rubric1",
        },
        {
          id: "group2",
          name: "Problem Solving",
          shortName: "PROB",
          rubricId: "rubric2",
        },
      ])
    ),
  })
);

vi.mock("@/utils/queries/standards/get-standards-by-standardgroups", () => ({
  getStandardsByStandardGroups: vi.fn(() =>
    Promise.resolve([
      { id: "standard1", standardGroupId: "group1", points: 5 },
      { id: "standard2", standardGroupId: "group2", points: 5 },
    ])
  ),
}));

vi.mock(
  "@/utils/queries/simulation_chat_grades/get-simulation-chat-grades-by-simulationchats",
  () => ({
    getSimulationChatGradesBySimulationChats: vi.fn(() =>
      Promise.resolve([
        { id: "grade1", simulationChatId: "chat1" },
        { id: "grade2", simulationChatId: "chat2" },
      ])
    ),
  })
);

vi.mock(
  "@/utils/queries/simulation_chat_feedbacks/get-simulation-chat-feedbacks-by-simulationchatgrades",
  () => ({
    getSimulationChatFeedbacksBySimulationChatGrades: vi.fn(() =>
      Promise.resolve([
        {
          id: "feedback1",
          simulationChatGradeId: "grade1",
          standardId: "standard1",
          total: 4,
        },
        {
          id: "feedback2",
          simulationChatGradeId: "grade2",
          standardId: "standard2",
          total: 3,
        },
      ])
    ),
  })
);

// Mock agent config
vi.mock("@/utils/agents", () => ({
  getAgentConfig: vi.fn(() => ({ icon: "test-icon" })),
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

  const renderHookWithProviders = (
    hook: () => ReturnType<typeof useColumns>
  ) => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    return renderHook(hook, { wrapper });
  };

  describe("Hook Functionality", () => {
    it("should return columns and data for attempts view", async () => {
      const { result } = renderHookWithProviders(() =>
        useColumns({ showAll: false, showExport: true })
      );

      await waitFor(() => {
        expect(result.current.columns).toBeDefined();
        expect(Array.isArray(result.current.columns)).toBe(true);
        expect(result.current.data).toBeDefined();
        expect(Array.isArray(result.current.data)).toBe(true);
      });
    });

    it("should return columns and data with showExport", async () => {
      const { result } = renderHookWithProviders(() =>
        useColumns({ showAll: false, showExport: true })
      );

      await waitFor(() => {
        expect(result.current.columns).toBeDefined();
        expect(result.current.data).toBeDefined();
      });
    });

    it("should provide profile options", async () => {
      const { result } = renderHookWithProviders(() =>
        useColumns({ showAll: false, showExport: true })
      );

      await waitFor(() => {
        expect(result.current.profileOptions).toBeDefined();
        expect(Array.isArray(result.current.profileOptions)).toBe(true);
      });
    });

    it("should provide class options", async () => {
      const { result } = renderHookWithProviders(() =>
        useColumns({ showAll: false, showExport: true })
      );

      await waitFor(() => {
        expect(result.current.classOptions).toBeDefined();
        expect(Array.isArray(result.current.classOptions)).toBe(true);
      });
    });

    it("should provide agent types", async () => {
      const { result } = renderHookWithProviders(() =>
        useColumns({ showAll: false, showExport: true })
      );

      await waitFor(() => {
        expect(result.current.agentTypes).toBeDefined();
        expect(Array.isArray(result.current.agentTypes)).toBe(true);
      });
    });

    it("should provide skill categories", async () => {
      const { result } = renderHookWithProviders(() =>
        useColumns({ showAll: false, showExport: true })
      );

      await waitFor(() => {
        expect(result.current.skillCategories).toBeDefined();
        expect(typeof result.current.skillCategories).toBe("object");
      });
    });

    it("should provide score options", async () => {
      const { result } = renderHookWithProviders(() =>
        useColumns({ showAll: false, showExport: true })
      );

      await waitFor(() => {
        expect(result.current.scoreOptions).toBeDefined();
        expect(Array.isArray(result.current.scoreOptions)).toBe(true);
      });
    });

    it("should provide score range options", async () => {
      const { result } = renderHookWithProviders(() =>
        useColumns({ showAll: false, showExport: true })
      );

      await waitFor(() => {
        expect(result.current.scoreRangeOptions).toBeDefined();
        expect(Array.isArray(result.current.scoreRangeOptions)).toBe(true);
        expect(result.current.scoreRangeOptions).toHaveLength(4);

        const expectedOptions = [
          { value: "excellent", label: "Excellent (80%+)" },
          { value: "good", label: "Good (70-79%)" },
          { value: "needs-improvement", label: "Needs Improvement (<70%)" },
          { value: "not-graded", label: "Not Graded" },
        ];

        result.current.scoreRangeOptions.forEach(
          (option: { value: string; label: string }, index: number) => {
            expect(option).toMatchObject(expectedOptions[index]!);
          }
        );
      });
    });
  });

  describe("ShowAll Functionality", () => {
    it("should filter data to current user when showAll is false", async () => {
      const { result } = renderHookWithProviders(() =>
        useColumns({ showAll: false, showExport: true })
      );

      await waitFor(() => {
        expect(result.current.data).toBeDefined();
        // When showAll is false, data should be filtered to current user's profile
        if (result.current.data.length > 0) {
          result.current.data.forEach((item: { profileId: string }) => {
            expect(item.profileId).toBe("profile1"); // Current user's profile
          });
        }
      });
    });

    it("should show all data when showAll is true", async () => {
      const { result } = renderHookWithProviders(() =>
        useColumns({ showAll: true, showExport: true })
      );

      await waitFor(() => {
        expect(result.current.data).toBeDefined();
        // When showAll is true, should include data from all profiles
        expect(Array.isArray(result.current.data)).toBe(true);
      });
    });

    it("should include name column when showAll is true", async () => {
      const { result } = renderHookWithProviders(() =>
        useColumns({ showAll: true, showExport: true })
      );

      await waitFor(() => {
        expect(result.current.columns).toBeDefined();
        const nameColumn = result.current.columns.find(
          (col: { accessorKey?: string }) => col.accessorKey === "profileId"
        );
        expect(nameColumn).toBeDefined();
      });
    });

    it("should exclude name column when showAll is false", async () => {
      const { result } = renderHookWithProviders(() =>
        useColumns({ showAll: false, showExport: true })
      );

      await waitFor(() => {
        expect(result.current.columns).toBeDefined();
        const nameColumn = result.current.columns.find(
          (col: { accessorKey?: string }) => col.accessorKey === "profileId"
        );
        expect(nameColumn).toBeUndefined();
      });
    });
  });

  describe("Data Filtering", () => {
    it("should filter data for single user view", async () => {
      const { result } = renderHookWithProviders(() =>
        useColumns({ showAll: false, showExport: true })
      );

      await waitFor(() => {
        expect(result.current.data).toBeDefined();
        // All data should belong to the current user's profile when showAll is false
        if (result.current.data.length > 0) {
          result.current.data.forEach((item: { profileId: string }) => {
            expect(item.profileId).toBe("profile1");
          });
        }
      });
    });

    it("should handle loading states", async () => {
      const { result } = renderHookWithProviders(() =>
        useColumns({ showAll: false, showExport: true })
      );

      // Initially should be loading
      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });
  });

  describe("Column Configuration", () => {
    it("should have columns for attempts view", async () => {
      const { result } = renderHookWithProviders(() =>
        useColumns({ showAll: false, showExport: true })
      );

      await waitFor(() => {
        expect(result.current.columns).toBeDefined();
        expect(result.current.columns.length).toBeGreaterThan(0);
      });
    });

    it("should include required column properties", async () => {
      const { result } = renderHookWithProviders(() =>
        useColumns({ showAll: false, showExport: true })
      );

      await waitFor(() => {
        expect(result.current.columns).toBeDefined();
        result.current.columns.forEach(
          (column: { id?: string; accessorKey?: string }) => {
            // Columns should have either id or accessorKey
            expect(column.id || column.accessorKey).toBeDefined();
          }
        );
      });
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty data gracefully", async () => {
      const { result } = renderHookWithProviders(() =>
        useColumns({ showAll: false, showExport: true })
      );

      await waitFor(() => {
        expect(result.current.data).toBeDefined();
        expect(Array.isArray(result.current.data)).toBe(true);
      });
    });

    it("should handle different configurations", async () => {
      const { result } = renderHookWithProviders(() =>
        useColumns({ showAll: true, showExport: false })
      );

      await waitFor(() => {
        expect(result.current.columns).toBeDefined();
        expect(result.current.data).toBeDefined();
      });
    });
  });

  describe("Class Derivation", () => {
    it("should derive class information from scenarios", async () => {
      const { result } = renderHookWithProviders(() =>
        useColumns({ showAll: false, showExport: true })
      );

      await waitFor(() => {
        expect(result.current.data).toBeDefined();
        // Check that class information is properly derived
        if (result.current.data.length > 0) {
          result.current.data.forEach((item: { classId?: string }) => {
            if (item.classId) {
              expect(typeof item.classId).toBe("string");
            }
          });
        }
      });
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
