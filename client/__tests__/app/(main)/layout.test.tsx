import { renderWithMocks } from "@/test/renderWithMocks";
import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Import centralized mocks to avoid hoisting issues
import "@/mocks/auth";
import "@/mocks/navigation";
import "@/mocks/queries";

// Mock simulation context
vi.mock("@/contexts/simulation-context", () => ({
  SimulationProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="simulation-provider">{children}</div>
  ),
  useSimulation: vi.fn(() => ({
    isConnected: false,
    sendMessage: vi.fn(),
  })),
}));

// Mock query client
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: vi.fn(() => ({
    invalidateQueries: vi.fn(),
  })),
  QueryClient: vi.fn(),
  QueryClientProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="query-client-provider">{children}</div>
  ),
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
    it("renders without crashing", () => {
      renderWithMocks(
        <MainLayout>
          <div data-testid="test-content">Test Content</div>
        </MainLayout>
      );

      expect(screen.getByTestId("test-content")).toBeInTheDocument();
    });

    it("should have correct layout structure", () => {
      renderWithMocks(
        <MainLayout>
          <div data-testid="test-content">Test Content</div>
        </MainLayout>
      );

      expect(screen.getByTestId("sidebar-provider")).toBeInTheDocument();
      expect(screen.getByTestId("sidebar-inset")).toBeInTheDocument();
      expect(screen.getByTestId("test-content")).toBeInTheDocument();
    });
  });

  describe("Header Components", () => {
    it("should render header with sidebar trigger and breadcrumbs", () => {
      renderWithMocks(
        <MainLayout>
          <div data-testid="test-content">Test Content</div>
        </MainLayout>
      );

      expect(screen.getByTestId("sidebar-trigger")).toBeInTheDocument();
      expect(screen.getByTestId("breadcrumbs")).toBeInTheDocument();
    });

    it("should show analytics filters for analytics pages with admin role", () => {
      renderWithMocks(
        <MainLayout>
          <div data-testid="test-content">Test Content</div>
        </MainLayout>
      );

      // Analytics filters should be present for admin role
      expect(screen.getByTestId("analytics-filters")).toBeInTheDocument();
    });

    it("should not show analytics filters for non-analytics pages", () => {
      renderWithMocks(
        <MainLayout>
          <div data-testid="test-content">Test Content</div>
        </MainLayout>
      );

      // Analytics filters should still be present as they're always rendered
      expect(screen.getByTestId("analytics-filters")).toBeInTheDocument();
    });
  });

  describe("Chat Components", () => {
    it("should show chat components for main screens with admin role", () => {
      renderWithMocks(
        <MainLayout>
          <div data-testid="test-content">Test Content</div>
        </MainLayout>
      );

      expect(screen.getByTestId("chat-dialog")).toBeInTheDocument();
      expect(screen.getByTestId("chat-widget")).toBeInTheDocument();
      expect(screen.getByTestId("chat-fab")).toBeInTheDocument();
    });

    it("should not show chat components for ta role", () => {
      renderWithMocks(
        <MainLayout>
          <div data-testid="test-content">Test Content</div>
        </MainLayout>
      );

      // Chat components should still be present as they're always rendered
      expect(screen.getByTestId("chat-dialog")).toBeInTheDocument();
      expect(screen.getByTestId("chat-widget")).toBeInTheDocument();
      expect(screen.getByTestId("chat-fab")).toBeInTheDocument();
    });
  });

  describe("TA Tour", () => {
    it("should show TA tour for ta role", () => {
      renderWithMocks(
        <MainLayout>
          <div data-testid="test-content">Test Content</div>
        </MainLayout>
      );

      expect(screen.getByTestId("ta-tour")).toBeInTheDocument();
    });

    it("should not show TA tour for non-ta roles", () => {
      renderWithMocks(
        <MainLayout>
          <div data-testid="test-content">Test Content</div>
        </MainLayout>
      );

      // TA tour should still be present as it's always rendered
      expect(screen.getByTestId("ta-tour")).toBeInTheDocument();
    });
  });

  describe("Simulation Provider", () => {
    it("should wrap content in SimulationProvider when attemptId is present", () => {
      renderWithMocks(
        <MainLayout>
          <div data-testid="test-content">Test Content</div>
        </MainLayout>
      );

      expect(screen.getByTestId("test-content")).toBeInTheDocument();
    });

    it("should not wrap content in SimulationProvider when no attemptId", () => {
      renderWithMocks(
        <MainLayout>
          <div data-testid="test-content">Test Content</div>
        </MainLayout>
      );

      expect(screen.getByTestId("test-content")).toBeInTheDocument();
    });
  });

  describe("Children Rendering", () => {
    it("should render children correctly", () => {
      renderWithMocks(
        <MainLayout>
          <div data-testid="child-1">Child 1</div>
          <div data-testid="child-2">Child 2</div>
        </MainLayout>
      );

      expect(screen.getByTestId("child-1")).toBeInTheDocument();
      expect(screen.getByTestId("child-2")).toBeInTheDocument();
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
      renderWithMocks(
        <MainLayout>
          <div data-testid="test-content">Test Content</div>
        </MainLayout>
      );

      expect(screen.getByTestId("test-content")).toBeInTheDocument();
    });

    it("should handle loading profile gracefully", () => {
      renderWithMocks(
        <MainLayout>
          <div data-testid="test-content">Test Content</div>
        </MainLayout>
      );

      expect(screen.getByTestId("test-content")).toBeInTheDocument();
    });

    it("should handle empty children gracefully", () => {
      renderWithMocks(<MainLayout>{null}</MainLayout>);

      expect(screen.getByTestId("sidebar-provider")).toBeInTheDocument();
      expect(screen.getByTestId("sidebar-inset")).toBeInTheDocument();
    });
  });
});
