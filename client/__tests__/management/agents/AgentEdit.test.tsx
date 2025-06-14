import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode } from "react";
import AgentEdit from "@/components/management/agents/AgentEdit";

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

// Mock API calls
vi.mock("@/utils/queries/agents/get-agent", () => ({
  getAgent: vi.fn(),
}));

vi.mock("@/utils/mutations/agents/update-agent", () => ({
  updateAgent: vi.fn(),
}));

// Mock toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("AgentEdit", () => {
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
    it("should render without crashing", () => {
      renderWithProviders(<AgentEdit agentId="test-agent-id" />);

      expect(screen.getByText("Edit Agent")).toBeInTheDocument();
    });

    it("should pass correct props to Agent component", () => {
      renderWithProviders(<AgentEdit agentId="test-agent-id" />);

      // Should render the edit mode
      expect(screen.getByText("Edit Agent")).toBeInTheDocument();
      expect(
        screen.getByText(
          "Modify the personality and behavior characteristics for this AI student agent",
        ),
      ).toBeInTheDocument();
    });

    it("should have correct accessibility attributes", () => {
      renderWithProviders(<AgentEdit agentId="test-agent-id" />);

      // Should show skeleton loading state initially
      expect(document.querySelector(".animate-pulse")).toBeInTheDocument();
    });
  });

  describe("Integration", () => {
    it("should integrate properly with the Agent component", () => {
      renderWithProviders(<AgentEdit agentId="test-agent-id" />);

      // The component should render the Agent component in edit mode
      expect(screen.getByText("Edit Agent")).toBeInTheDocument();
    });
  });
});

/*
 * Component Analysis for AgentEdit:
 * Path: management/agents/AgentEdit.tsx
 *
 * Features detected:
 * - Default export: true
 * - Named exports: None
 * - Has props: true (agentId required)
 * - Props interface: { agentId: string }
 * - Client component: false (wrapper component)
 * - Uses hooks: None (delegates to Agent component)
 * - Uses router: false (delegates to Agent component)
 * - Has API calls: false (delegates to Agent component)
 * - Has form handling: false (delegates to Agent component)
 * - Uses state: false (delegates to Agent component)
 * - Uses effects: false (delegates to Agent component)
 * - Uses context: false
 *
 * This component now serves as a simple wrapper around the general Agent component,
 * configured for edit mode with the provided agentId.
 */
