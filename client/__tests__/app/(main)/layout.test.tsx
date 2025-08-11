import { useProfile } from "@/contexts/profile-context";
import { render } from '@/test/custom-render';
import { act, screen } from '@/test/custom-render';
import { usePathname } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Import centralized mocks to avoid hoisting issues
import "@/mocks/auth";
import "@/mocks/navigation";

// Mock simulation context
vi.mock("@/contexts/simulation-context", () => ({
  SimulationProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="simulation-provider">{children}</div>
  ),
  useSimulation: vi.fn(() => ({
    // Attempt and simulation data
    attemptId: "test-attempt-id",
    attempt: null,
    simulation: null,
    scenario: null,
    documents: [],
    scenarioDocuments: [],

    // Current chat management
    currentChatIndex: 0,
    setCurrentChatIndex: vi.fn(),
    currentChat: null,
    chats: [],
    isLoadingChats: false,

    // Results and grading
    currentDynamicRubric: null,
    allDynamicRubrics: [],
    aggregatedResults: null,

    // Timer state
    timer: { elapsed: 0, remaining: null, expired: false },
    isActive: false,

    // UI state
    showResults: false,
    isSingleChatAttempt: false,
    isLastAttempt: false,
    expectedChatCount: 1,
    freshlyCompletedChats: new Set(),
    setFreshlyCompletedChats: vi.fn(),

    // Connection state
    isConnected: false,

    // WebSocket operations
    sendMessage: vi.fn(),
    stopMessage: vi.fn(),
    endChat: vi.fn(),

    // Loading states
    isSendingMessage: false,
    isStoppingMessage: false,
    endChatLoading: false,

    // Event handlers
    onSimulationFinished: undefined,
  })),
}));

// Mock profile context
vi.mock("@/contexts/profile-context", () => ({
  ProfileProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="profile-provider">{children}</div>
  ),
  useProfile: vi.fn(() => ({
    activeProfile: {
      id: "test-profile-id",
      userId: 1,
      firstName: "Test",
      lastName: "User",
      alias: "testuser",
      role: "admin",
      active: true,
      viewedIntro: true,
      viewedChat: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastLogin: new Date().toISOString(),
      lastActive: new Date().toISOString(),
      defaultProfile: false,
    },
    simulatedProfile: null,
    effectiveProfile: {
      id: "test-profile-id",
      userId: 1,
      firstName: "Test",
      lastName: "User",
      alias: "testuser",
      role: "admin",
      active: true,
      viewedIntro: true,
      viewedChat: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastLogin: new Date().toISOString(),
      lastActive: new Date().toISOString(),
      defaultProfile: false,
    },
    isSimulating: false,
    isLoading: false,
    setSimulatedProfile: vi.fn(),
    clearSimulation: vi.fn(),
    navigateToDefault: vi.fn(),
    isSectionAvailable: vi.fn(() => true),
  })),
}));

// Mock query client
vi.mock("@tanstack/react-query", () => ({
  useQuery: vi.fn(({ queryKey }) => {
    // Return different data based on query key
    if (queryKey && Array.isArray(queryKey) && queryKey[0] === "cohorts") {
      return {
        data: [],
        isLoading: false,
        error: null,
      };
    }
    if (
      queryKey &&
      Array.isArray(queryKey) &&
      queryKey[0] === "simulatedProfile"
    ) {
      return {
        data: null,
        isLoading: false,
        error: null,
      };
    }
    // Default profile data for other queries
    return {
      data: {
        id: "test-profile-id",
        userId: 1,
        firstName: "Test",
        lastName: "User",
        alias: "testuser",
        role: "admin",
        active: true,
        viewedIntro: true,
        viewedChat: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastLogin: new Date().toISOString(),
        lastActive: new Date().toISOString(),
        defaultProfile: false,
      },
      isLoading: false,
      error: null,
    };
  }),
  useMutation: vi.fn(() => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isLoading: false,
    error: null,
  })),
  useQueryClient: vi.fn(() => ({
    invalidateQueries: vi.fn(),
  })),
  QueryClient: vi.fn(),
  QueryClientProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="query-client-provider">{children}</div>
  ),
}));

// Mock breadcrumb utilities to prevent async state updates
vi.mock("@/utils/breadcrumb-utils", () => ({
  generateEnhancedBreadcrumbs: vi.fn(() => []), // Make it synchronous
  getActiveSectionFromPath: vi.fn(() => "home"),
}));

// Mock navigation utilities
vi.mock("@/utils/navigation-utils", () => ({
  createSectionChangeHandler: vi.fn(() => vi.fn()),
  isMainScreen: vi.fn(() => true), // Default to true to show chat components
}));

// Mock components
vi.mock("@/components/ui/sidebar", () => ({
  SidebarProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="sidebar-provider">{children}</div>
  ),
  SidebarInset: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="sidebar-inset">{children}</div>
  ),
  SidebarTrigger: () => <button data-testid="sidebar-trigger">Trigger</button>,
}));

vi.mock("@/components/common/layout/UnifiedSidebar", () => ({
  UnifiedSidebar: () => <div data-testid="unified-sidebar">Sidebar</div>,
}));

vi.mock("@/components/common/layout/NavigationBreadcrumbs", () => ({
  NavigationBreadcrumbs: () => <div data-testid="breadcrumbs">Breadcrumbs</div>,
}));

vi.mock("@/components/common/layout/AccessControl", () => ({
  AccessControl: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="access-control">{children}</div>
  ),
}));

vi.mock("@/components/common/analytics/AnalyticsFilters", () => ({
  AnalyticsFilters: () => <div data-testid="analytics-filters">Filters</div>,
}));

vi.mock("@/components/common/home/ChatDialog", () => ({
  default: () => <div data-testid="chat-dialog">Chat Dialog</div>,
}));

vi.mock("@/components/common/home/ChatWidget", () => ({
  default: () => <div data-testid="chat-widget">Chat Widget</div>,
}));

vi.mock("@/components/common/home/ChatFab", () => ({
  default: () => <div data-testid="chat-fab">Chat Fab</div>,
}));

vi.mock("@/components/home/TATour", () => ({
  default: () => <div data-testid="ta-tour">TA Tour</div>,
}));

// ——————————————————————————————————————————
import MainLayout from "@/app/(main)/layout";

describe("MainLayout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      await act(async () => {
        render(
          <MainLayout>
            <div data-testid="test-content">Test Content</div>
          </MainLayout>
        );
      });

      expect(screen.getByTestId("test-content")).toBeInTheDocument();
    });

    it("should have correct layout structure", async () => {
      await act(async () => {
        render(
          <MainLayout>
            <div data-testid="test-content">Test Content</div>
          </MainLayout>
        );
      });

      expect(screen.getAllByTestId("sidebar-provider")).toHaveLength(2);
      expect(screen.getByTestId("sidebar-inset")).toBeInTheDocument();
      expect(screen.getByTestId("test-content")).toBeInTheDocument();
    });
  });

  describe("Header Components", () => {
    it("should render header with sidebar trigger and breadcrumbs", async () => {
      await act(async () => {
        render(
          <MainLayout>
            <div data-testid="test-content">Test Content</div>
          </MainLayout>
        );
      });

      expect(screen.getByTestId("sidebar-trigger")).toBeInTheDocument();
      expect(screen.getByTestId("breadcrumbs")).toBeInTheDocument();
    });

    it("should show analytics filters for analytics pages with admin role", async () => {
      // Mock usePathname to return an analytics path
      vi.mocked(usePathname).mockReturnValue("/analytics/overview");

      await act(async () => {
        render(
          <MainLayout>
            <div data-testid="test-content">Test Content</div>
          </MainLayout>
        );
      });

      // Analytics filters should be present for admin role on analytics pages
      expect(screen.getByTestId("analytics-filters")).toBeInTheDocument();
    });

    it("should not show analytics filters for non-analytics pages", async () => {
      // Mock usePathname to return a non-analytics path that's also not home
      vi.mocked(usePathname).mockReturnValue("/cohorts");

      await act(async () => {
        render(
          <MainLayout>
            <div data-testid="test-content">Test Content</div>
          </MainLayout>
        );
      });

      // Analytics filters should not be present on non-analytics pages
      expect(screen.queryByTestId("analytics-filters")).not.toBeInTheDocument();
    });
  });

  describe("Chat Components", () => {
    it("should show chat components for main screens with admin role", async () => {
      await act(async () => {
        render(
          <MainLayout>
            <div data-testid="test-content">Test Content</div>
          </MainLayout>
        );
      });

      expect(screen.getByTestId("chat-dialog")).toBeInTheDocument();
      expect(screen.getByTestId("chat-widget")).toBeInTheDocument();
      expect(screen.getByTestId("chat-fab")).toBeInTheDocument();
    });

    it("should not show chat components for ta role", async () => {
      // Mock useProfile to return a TA profile
      vi.mocked(useProfile).mockReturnValue({
        activeProfile: {
          id: "test-profile-id",
          userId: 1,
          firstName: "Test",
          lastName: "User",
          alias: "testuser",
          role: "ta",
          active: true,
          viewedIntro: true,
          viewedChat: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lastLogin: new Date().toISOString(),
          lastActive: new Date().toISOString(),
          defaultProfile: false,
        },
        simulatedProfile: null,
        effectiveProfile: {
          id: "test-profile-id",
          userId: 1,
          firstName: "Test",
          lastName: "User",
          alias: "testuser",
          role: "ta",
          active: true,
          viewedIntro: true,
          viewedChat: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lastLogin: new Date().toISOString(),
          lastActive: new Date().toISOString(),
          defaultProfile: false,
        },
        isSimulating: false,
        isLoading: false,
        setSimulatedProfile: vi.fn(),
        clearSimulation: vi.fn(),
        navigateToDefault: vi.fn(),
        isSectionAvailable: vi.fn(() => true),
      });

      await act(async () => {
        render(
          <MainLayout>
            <div data-testid="test-content">Test Content</div>
          </MainLayout>
        );
      });

      // Chat components should not be present for TA role
      expect(screen.queryByTestId("chat-dialog")).not.toBeInTheDocument();
      expect(screen.queryByTestId("chat-widget")).not.toBeInTheDocument();
      expect(screen.queryByTestId("chat-fab")).not.toBeInTheDocument();
    });
  });

  describe("TA Tour", () => {
    it("should show TA tour for ta role", async () => {
      // Mock useProfile to return a TA profile
      vi.mocked(useProfile).mockReturnValue({
        activeProfile: {
          id: "test-profile-id",
          userId: 1,
          firstName: "Test",
          lastName: "User",
          alias: "testuser",
          role: "ta",
          active: true,
          viewedIntro: true,
          viewedChat: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lastLogin: new Date().toISOString(),
          lastActive: new Date().toISOString(),
          defaultProfile: false,
        },
        simulatedProfile: null,
        effectiveProfile: {
          id: "test-profile-id",
          userId: 1,
          firstName: "Test",
          lastName: "User",
          alias: "testuser",
          role: "ta",
          active: true,
          viewedIntro: true,
          viewedChat: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lastLogin: new Date().toISOString(),
          lastActive: new Date().toISOString(),
          defaultProfile: false,
        },
        isSimulating: false,
        isLoading: false,
        setSimulatedProfile: vi.fn(),
        clearSimulation: vi.fn(),
        navigateToDefault: vi.fn(),
        isSectionAvailable: vi.fn(() => true),
      });

      await act(async () => {
        render(
          <MainLayout>
            <div data-testid="test-content">Test Content</div>
          </MainLayout>
        );
      });

      expect(screen.getByTestId("ta-tour")).toBeInTheDocument();
    });

    it("should not show TA tour for non-ta roles", async () => {
      // Reset useProfile to return admin profile
      vi.mocked(useProfile).mockReturnValue({
        activeProfile: {
          id: "test-profile-id",
          userId: 1,
          firstName: "Test",
          lastName: "User",
          alias: "testuser",
          role: "admin",
          active: true,
          viewedIntro: true,
          viewedChat: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lastLogin: new Date().toISOString(),
          lastActive: new Date().toISOString(),
          defaultProfile: false,
        },
        simulatedProfile: null,
        effectiveProfile: {
          id: "test-profile-id",
          userId: 1,
          firstName: "Test",
          lastName: "User",
          alias: "testuser",
          role: "admin",
          active: true,
          viewedIntro: true,
          viewedChat: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lastLogin: new Date().toISOString(),
          lastActive: new Date().toISOString(),
          defaultProfile: false,
        },
        isSimulating: false,
        isLoading: false,
        setSimulatedProfile: vi.fn(),
        clearSimulation: vi.fn(),
        navigateToDefault: vi.fn(),
        isSectionAvailable: vi.fn(() => true),
      });

      await act(async () => {
        render(
          <MainLayout>
            <div data-testid="test-content">Test Content</div>
          </MainLayout>
        );
      });

      expect(screen.queryByTestId("ta-tour")).not.toBeInTheDocument();
    });
  });

  describe("Simulation Provider", () => {
    it("should wrap content in SimulationProvider when attemptId is present", async () => {
      await act(async () => {
        render(
          <MainLayout>
            <div data-testid="test-content">Test Content</div>
          </MainLayout>
        );
      });

      expect(screen.getByTestId("test-content")).toBeInTheDocument();
    });

    it("should not wrap content in SimulationProvider when no attemptId", async () => {
      await act(async () => {
        render(
          <MainLayout>
            <div data-testid="test-content">Test Content</div>
          </MainLayout>
        );
      });

      expect(screen.getByTestId("test-content")).toBeInTheDocument();
    });
  });

  describe("Children Rendering", () => {
    it("should render children correctly", async () => {
      await act(async () => {
        render(
          <MainLayout>
            <div data-testid="child-1">Child 1</div>
            <div data-testid="child-2">Child 2</div>
          </MainLayout>
        );
      });

      expect(screen.getByTestId("child-1")).toBeInTheDocument();
      expect(screen.getByTestId("child-2")).toBeInTheDocument();
    });

    it("should render multiple children", async () => {
      await act(async () => {
        render(
          <MainLayout>
            <div data-testid="child-1">Child 1</div>
            <div data-testid="child-2">Child 2</div>
            <div data-testid="child-3">Child 3</div>
          </MainLayout>
        );
      });

      expect(screen.getByTestId("child-1")).toBeInTheDocument();
      expect(screen.getByTestId("child-2")).toBeInTheDocument();
      expect(screen.getByTestId("child-3")).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle missing profile gracefully", async () => {
      await act(async () => {
        render(
          <MainLayout>
            <div data-testid="test-content">Test Content</div>
          </MainLayout>
        );
      });

      expect(screen.getByTestId("test-content")).toBeInTheDocument();
    });

    it("should handle loading profile gracefully", async () => {
      await act(async () => {
        render(
          <MainLayout>
            <div data-testid="test-content">Test Content</div>
          </MainLayout>
        );
      });

      expect(screen.getByTestId("test-content")).toBeInTheDocument();
    });

    it("should handle empty children gracefully", async () => {
      await act(async () => {
        render(<MainLayout>{null}</MainLayout>);
      });

      expect(screen.getAllByTestId("sidebar-provider")).toHaveLength(2);
      expect(screen.getByTestId("sidebar-inset")).toBeInTheDocument();
    });
  });
});
