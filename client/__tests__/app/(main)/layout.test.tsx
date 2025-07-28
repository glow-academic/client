import { renderWithMocks } from "@/test/renderWithMocks";
import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ——————————————————————————————————————————
import MainLayout from "@/app/(main)/layout";

// Mock Next.js router and pathname
const mockPush = vi.fn();
const mockPathname = "/home";
const mockUsePathname = vi.fn().mockReturnValue(mockPathname);
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  usePathname: mockUsePathname,
}));

// Mock profile context
const mockUseProfile = vi.fn();
vi.mock("@/contexts/profile-context", () => ({
  useProfile: () => mockUseProfile(),
}));

// Mock simulation context
const mockUseSimulation = vi.fn();
vi.mock("@/contexts/simulation-context", () => ({
  SimulationProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="simulation-provider">{children}</div>
  ),
  useSimulation: () => mockUseSimulation(),
}));

// Mock query client
const mockQueryClient = {
  invalidateQueries: vi.fn(),
};
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => mockQueryClient,
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
  default: () => <div data-testid="unified-sidebar">Sidebar</div>,
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

// Mock contexts
vi.mock("@/contexts/analytics-context", () => ({
  AnalyticsProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="analytics-provider">{children}</div>
  ),
}));

vi.mock("@/contexts/assistant-context", () => ({
  AssistantProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="assistant-provider">{children}</div>
  ),
}));

vi.mock("@/contexts/tour-context", () => ({
  TourProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="tour-provider">{children}</div>
  ),
}));

// Mock utilities
vi.mock("@/utils/breadcrumb-utils", () => ({
  generateEnhancedBreadcrumbs: vi.fn().mockResolvedValue([]),
  getActiveSectionFromPath: vi.fn().mockReturnValue("home"),
}));

vi.mock("@/utils/navigation-utils", () => ({
  createSectionChangeHandler: vi.fn().mockReturnValue(vi.fn()),
  isMainScreen: vi.fn().mockReturnValue(true),
}));

// Mock API functions
vi.mock("@/utils/api/documents/finalize-document-upload", () => ({
  finalizeDocumentUpload: vi.fn(),
}));

// Mock toast
vi.mock("sonner", () => ({
  toast: {
    loading: vi.fn().mockReturnValue("toast-id"),
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock TUS upload
vi.mock("tus-js-client", () => ({
  Upload: vi.fn().mockImplementation(() => ({
    start: vi.fn(),
  })),
}));

// Mock UUID
vi.mock("uuid", () => ({
  v4: vi.fn().mockReturnValue("test-uuid"),
}));

describe("MainLayout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseProfile.mockReturnValue({
      effectiveProfile: { role: "admin" },
      isLoading: false,
    });
    mockUseSimulation.mockReturnValue(null);
  });

  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      renderWithMocks(
        <MainLayout>
          <div data-testid="test-child">Test Content</div>
        </MainLayout>
      );

      expect(screen.getByTestId("analytics-provider")).toBeInTheDocument();
      expect(screen.getByTestId("tour-provider")).toBeInTheDocument();
      expect(screen.getByTestId("assistant-provider")).toBeInTheDocument();
      expect(screen.getByTestId("sidebar-provider")).toBeInTheDocument();
      expect(screen.getByTestId("unified-sidebar")).toBeInTheDocument();
      expect(screen.getByTestId("sidebar-inset")).toBeInTheDocument();
      expect(screen.getByTestId("access-control")).toBeInTheDocument();
      expect(screen.getByTestId("test-child")).toBeInTheDocument();
    });

    it("should have correct layout structure", () => {
      renderWithMocks(
        <MainLayout>
          <div data-testid="test-child">Test Content</div>
        </MainLayout>
      );

      // Check that all layout components are rendered
      expect(screen.getByTestId("sidebar-provider")).toBeInTheDocument();
      expect(screen.getByTestId("sidebar-inset")).toBeInTheDocument();
      expect(screen.getByTestId("unified-sidebar")).toBeInTheDocument();
      expect(screen.getByTestId("breadcrumbs")).toBeInTheDocument();
      expect(screen.getByTestId("access-control")).toBeInTheDocument();
    });
  });

  describe("Header Components", () => {
    it("should render header with sidebar trigger and breadcrumbs", () => {
      renderWithMocks(
        <MainLayout>
          <div data-testid="test-child">Test Content</div>
        </MainLayout>
      );

      expect(screen.getByTestId("sidebar-trigger")).toBeInTheDocument();
      expect(screen.getByTestId("breadcrumbs")).toBeInTheDocument();
    });

    it("should show analytics filters for analytics pages with admin role", () => {
      mockUseProfile.mockReturnValue({
        effectiveProfile: { role: "admin" },
        isLoading: false,
      });

      // Mock pathname to be analytics
      mockUsePathname.mockReturnValue("/analytics");

      renderWithMocks(
        <MainLayout>
          <div data-testid="test-child">Test Content</div>
        </MainLayout>
      );

      expect(screen.getByTestId("analytics-filters")).toBeInTheDocument();
    });

    it("should not show analytics filters for non-analytics pages", () => {
      mockUseProfile.mockReturnValue({
        effectiveProfile: { role: "admin" },
        isLoading: false,
      });

      // Mock pathname to be home
      mockUsePathname.mockReturnValue("/home");

      renderWithMocks(
        <MainLayout>
          <div data-testid="test-child">Test Content</div>
        </MainLayout>
      );

      expect(screen.queryByTestId("analytics-filters")).not.toBeInTheDocument();
    });
  });

  describe("Chat Components", () => {
    it("should show chat components for main screens with admin role", () => {
      mockUseProfile.mockReturnValue({
        effectiveProfile: { role: "admin" },
        isLoading: false,
      });

      renderWithMocks(
        <MainLayout>
          <div data-testid="test-child">Test Content</div>
        </MainLayout>
      );

      expect(screen.getByTestId("chat-fab")).toBeInTheDocument();
      expect(screen.getByTestId("chat-widget")).toBeInTheDocument();
      expect(screen.getByTestId("chat-dialog")).toBeInTheDocument();
    });

    it("should not show chat components for ta role", () => {
      mockUseProfile.mockReturnValue({
        effectiveProfile: { role: "ta" },
        isLoading: false,
      });

      renderWithMocks(
        <MainLayout>
          <div data-testid="test-child">Test Content</div>
        </MainLayout>
      );

      expect(screen.queryByTestId("chat-fab")).not.toBeInTheDocument();
      expect(screen.queryByTestId("chat-widget")).not.toBeInTheDocument();
      expect(screen.queryByTestId("chat-dialog")).not.toBeInTheDocument();
    });
  });

  describe("TA Tour", () => {
    it("should show TA tour for ta role", () => {
      mockUseProfile.mockReturnValue({
        effectiveProfile: { role: "ta" },
        isLoading: false,
      });

      renderWithMocks(
        <MainLayout>
          <div data-testid="test-child">Test Content</div>
        </MainLayout>
      );

      expect(screen.getByTestId("ta-tour")).toBeInTheDocument();
    });

    it("should not show TA tour for non-ta roles", () => {
      mockUseProfile.mockReturnValue({
        effectiveProfile: { role: "admin" },
        isLoading: false,
      });

      renderWithMocks(
        <MainLayout>
          <div data-testid="test-child">Test Content</div>
        </MainLayout>
      );

      expect(screen.queryByTestId("ta-tour")).not.toBeInTheDocument();
    });
  });

  describe("Simulation Provider", () => {
    it("should wrap content in SimulationProvider when attemptId is present", () => {
      // Mock pathname with attemptId
      mockUsePathname.mockReturnValue("/home/a/test-attempt-id");

      renderWithMocks(
        <MainLayout>
          <div data-testid="test-child">Test Content</div>
        </MainLayout>
      );

      expect(screen.getByTestId("simulation-provider")).toBeInTheDocument();
      expect(screen.getByTestId("test-child")).toBeInTheDocument();
    });

    it("should not wrap content in SimulationProvider when no attemptId", () => {
      // Mock pathname without attemptId
      mockUsePathname.mockReturnValue("/home");

      renderWithMocks(
        <MainLayout>
          <div data-testid="test-child">Test Content</div>
        </MainLayout>
      );

      expect(
        screen.queryByTestId("simulation-provider")
      ).not.toBeInTheDocument();
      expect(screen.getByTestId("test-child")).toBeInTheDocument();
    });
  });

  describe("Children Rendering", () => {
    it("should render children correctly", () => {
      const testContent = "This is test content";
      renderWithMocks(
        <MainLayout>
          <div data-testid="test-child">{testContent}</div>
        </MainLayout>
      );

      expect(screen.getByTestId("test-child")).toBeInTheDocument();
      expect(screen.getByText(testContent)).toBeInTheDocument();
    });

    it("should render multiple children", () => {
      renderWithMocks(
        <MainLayout>
          <div data-testid="child-1">Child 1</div>
          <div data-testid="child-2">Child 2</div>
          <div data-testid="child-3">Child 3</div>
        </MainLayout>
      );

      expect(screen.getByTestId("child-1")).toBeInTheDocument();
      expect(screen.getByTestId("child-2")).toBeInTheDocument();
      expect(screen.getByTestId("child-3")).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle missing profile gracefully", () => {
      mockUseProfile.mockReturnValue({
        effectiveProfile: null,
        isLoading: false,
      });

      renderWithMocks(
        <MainLayout>
          <div data-testid="test-child">Test Content</div>
        </MainLayout>
      );

      expect(screen.getByTestId("test-child")).toBeInTheDocument();
    });

    it("should handle loading profile gracefully", () => {
      mockUseProfile.mockReturnValue({
        effectiveProfile: null,
        isLoading: true,
      });

      renderWithMocks(
        <MainLayout>
          <div data-testid="test-child">Test Content</div>
        </MainLayout>
      );

      expect(screen.getByTestId("test-child")).toBeInTheDocument();
    });

    it("should handle empty children gracefully", () => {
      renderWithMocks(<MainLayout>{null}</MainLayout>);

      expect(screen.getByTestId("access-control")).toBeInTheDocument();
    });
  });
});
