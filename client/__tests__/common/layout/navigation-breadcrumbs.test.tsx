import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { NavigationBreadcrumbs } from "@/components/common/layout/navigation-breadcrumbs";

// Mock external dependencies
vi.mock("@/components/ui/breadcrumb", () => ({
  Breadcrumb: ({ children }: { children: React.ReactNode }) => (
    <nav data-testid="breadcrumb">{children}</nav>
  ),
  BreadcrumbList: ({ children }: { children: React.ReactNode }) => (
    <ol data-testid="breadcrumb-list">{children}</ol>
  ),
  BreadcrumbItem: ({ children }: { children: React.ReactNode }) => (
    <li data-testid="breadcrumb-item">{children}</li>
  ),
  BreadcrumbLink: ({
    children,
    onClick,
    className,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    className?: string;
  }) => (
    <button
      data-testid="breadcrumb-link"
      onClick={onClick}
      className={className}
    >
      {children}
    </button>
  ),
  BreadcrumbPage: ({ children }: { children: React.ReactNode }) => (
    <span data-testid="breadcrumb-page">{children}</span>
  ),
  BreadcrumbSeparator: () => <span data-testid="breadcrumb-separator">/</span>,
}));

// Mock navigation utils
const mockBreadcrumbNavigate = vi.fn();
vi.mock("@/utils/navigation-utils", () => ({
  createBreadcrumbSectionChangeHandler: () => mockBreadcrumbNavigate,
}));

// Mock Next.js router
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

describe("NavigationBreadcrumbs", () => {
  const mockOnSectionChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockBreadcrumbs = [
    { title: "Home", section: "home" },
    { title: "Analytics", section: "analytics" },
    { title: "Performance", section: "performance" },
  ];

  describe("Rendering", () => {
    it("should render without crashing", () => {
      render(<NavigationBreadcrumbs breadcrumbs={mockBreadcrumbs} />);
      expect(screen.getByTestId("breadcrumb")).toBeInTheDocument();
    });

    it("should render with props", () => {
      render(
        <NavigationBreadcrumbs
          breadcrumbs={mockBreadcrumbs}
          onSectionChange={mockOnSectionChange}
        />,
      );

      expect(screen.getByTestId("breadcrumb")).toBeInTheDocument();
      expect(screen.getByTestId("breadcrumb-list")).toBeInTheDocument();
      expect(screen.getAllByTestId("breadcrumb-item")).toHaveLength(3);
      expect(screen.getByText("Home")).toBeInTheDocument();
      expect(screen.getByText("Analytics")).toBeInTheDocument();
      expect(screen.getByText("Performance")).toBeInTheDocument();
    });

    it("should render empty state when no breadcrumbs provided", () => {
      const { container } = render(<NavigationBreadcrumbs breadcrumbs={[]} />);
      expect(container.firstChild).toBeNull();
    });

    it("should render with right content", () => {
      const rightContent = <button data-testid="right-content">Action</button>;
      render(
        <NavigationBreadcrumbs
          breadcrumbs={mockBreadcrumbs}
          rightContent={rightContent}
        />,
      );

      expect(screen.getByTestId("right-content")).toBeInTheDocument();
      expect(screen.getByText("Action")).toBeInTheDocument();
    });

    it("should have correct accessibility attributes", () => {
      render(<NavigationBreadcrumbs breadcrumbs={mockBreadcrumbs} />);

      const breadcrumb = screen.getByTestId("breadcrumb");
      expect(breadcrumb.tagName).toBe("NAV");

      const breadcrumbList = screen.getByTestId("breadcrumb-list");
      expect(breadcrumbList.tagName).toBe("OL");
    });
  });

  describe("User Interactions", () => {
    it("should handle breadcrumb clicks", async () => {
      const user = userEvent.setup();
      render(
        <NavigationBreadcrumbs
          breadcrumbs={mockBreadcrumbs}
          onSectionChange={mockOnSectionChange}
        />,
      );

      const homeLink = screen.getByText("Home").closest("button");
      expect(homeLink).toBeInTheDocument();

      await user.click(homeLink!);
      expect(mockOnSectionChange).toHaveBeenCalledWith("home");
    });

    it("should handle Classes breadcrumb navigation specially when no onSectionChange", async () => {
      const user = userEvent.setup();
      const classesBreadcrumbs = [
        { title: "Classes", section: "classes" },
        { title: "CS101", section: "class-123" },
      ];

      render(<NavigationBreadcrumbs breadcrumbs={classesBreadcrumbs} />);

      const classesLink = screen.getByText("Classes").closest("button");
      expect(classesLink).toBeInTheDocument();

      await user.click(classesLink!);
      // Should use breadcrumb navigation handler instead of onSectionChange
      expect(mockBreadcrumbNavigate).toHaveBeenCalledWith("classes");
      expect(mockOnSectionChange).not.toHaveBeenCalled();
    });

    it("should not call onSectionChange for last breadcrumb (current page)", async () => {
      const user = userEvent.setup();
      render(
        <NavigationBreadcrumbs
          breadcrumbs={mockBreadcrumbs}
          onSectionChange={mockOnSectionChange}
        />,
      );

      // Last breadcrumb should be rendered as BreadcrumbPage, not BreadcrumbLink
      const performancePage = screen.getByTestId("breadcrumb-page");
      expect(performancePage).toHaveTextContent("Performance");

      // Should not be clickable
      expect(performancePage.tagName).toBe("SPAN");
    });

    it("should handle missing onSectionChange gracefully", async () => {
      const user = userEvent.setup();
      render(<NavigationBreadcrumbs breadcrumbs={mockBreadcrumbs} />);

      const homeLink = screen.getByText("Home").closest("button");
      expect(homeLink).toBeInTheDocument();

      // Should use breadcrumb navigation handler when no onSectionChange
      await user.click(homeLink!);
      expect(mockBreadcrumbNavigate).toHaveBeenCalledWith("home");
      expect(mockOnSectionChange).not.toHaveBeenCalled();
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", () => {
      // Test with undefined breadcrumbs
      render(<NavigationBreadcrumbs breadcrumbs={undefined as any} />);
      expect(screen.queryByTestId("breadcrumb")).not.toBeInTheDocument();
    });

    it("should handle missing or invalid props", () => {
      // Test with breadcrumbs without sections
      const breadcrumbsWithoutSections = [
        { title: "Home" },
        { title: "Analytics" },
      ];

      render(
        <NavigationBreadcrumbs
          breadcrumbs={breadcrumbsWithoutSections}
          onSectionChange={mockOnSectionChange}
        />,
      );
      expect(screen.getByText("Home")).toBeInTheDocument();
      expect(screen.getByText("Analytics")).toBeInTheDocument();
    });

    it("should render separators between breadcrumbs", () => {
      render(<NavigationBreadcrumbs breadcrumbs={mockBreadcrumbs} />);

      const separators = screen.getAllByTestId("breadcrumb-separator");
      // Should have n-1 separators for n breadcrumbs
      expect(separators).toHaveLength(mockBreadcrumbs.length - 1);
    });

    it("should render only right content when no breadcrumbs and right content provided", () => {
      const rightContent = <button data-testid="right-content">Action</button>;
      render(
        <NavigationBreadcrumbs breadcrumbs={[]} rightContent={rightContent} />,
      );

      expect(screen.getByTestId("right-content")).toBeInTheDocument();
      expect(screen.queryByTestId("breadcrumb")).not.toBeInTheDocument();
    });
  });
});

/*
 * Component Analysis for navigation-breadcrumbs:
 * Path: common/layout/navigation-breadcrumbs.tsx
 *
 * Features detected:
 * - Default export: false
 * - Named exports: NavigationBreadcrumbs
 * - Has props: true
 * - Props interface: NavigationBreadcrumbsProps
 * - Client component: false
 * - Uses hooks: useRouter
 * - Uses router: true
 * - Has API calls: false
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
 * render(<navigation-breadcrumbs {...mockProps} />);
 * expect(screen.getByRole('...')).toBeInTheDocument();
 *
 * Props testing:
 * const props = { ... };
 * render(<navigation-breadcrumbs {...props} />);
 * expect(screen.getByText(props.someText)).toBeInTheDocument();
 *
 * User interaction:
 * const button = screen.getByRole('button');
 * await user.click(button);
 * expect(mockFunction).toHaveBeenCalled();
 */
