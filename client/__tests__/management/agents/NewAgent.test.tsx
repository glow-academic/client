import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode } from "react";
import NewAgent from "@/components/management/agents/NewAgent";

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
vi.mock("@/utils/mutations/agents/create-agent", () => ({
  createAgent: vi.fn(),
}));

// Mock toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("NewAgent", () => {
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
      renderWithProviders(<NewAgent />);

      expect(screen.getByText("Create Agent")).toBeInTheDocument();
    });

    it("should render create mode by default", () => {
      renderWithProviders(<NewAgent />);

      expect(screen.getByText("Create Agent")).toBeInTheDocument();
      expect(
        screen.getByText(
          "Create a new AI student agent with specific personality and behavior characteristics",
        ),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /create agent/i }),
      ).toBeInTheDocument();
    });

    it("should have correct accessibility attributes", () => {
      renderWithProviders(<NewAgent />);

      const nameInput = screen.getByLabelText(/agent name/i);
      const subtitleInput = screen.getByLabelText(/subtitle/i);

      expect(nameInput).toHaveAttribute("required");
      expect(nameInput).toHaveAttribute(
        "placeholder",
        "e.g., Enthusiastic Student Agent",
      );
      expect(subtitleInput).toHaveAttribute("required");
    });
  });

  describe("Integration", () => {
    it("should integrate properly with the Agent component", () => {
      renderWithProviders(<NewAgent />);

      // The component should render the Agent component in create mode
      expect(screen.getByText("Create Agent")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /create agent/i }),
      ).toBeInTheDocument();
    });
  });
});

/*
 * Component Analysis for NewAgent:
 * Path: management/agents/NewAgent.tsx
 *
 * Features detected:
 * - Default export: true
 * - Named exports: None
 * - Has props: false
 * - Props interface: None
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
 * configured for create mode.
 */
