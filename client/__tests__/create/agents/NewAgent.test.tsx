import NewAgent from "@/components/create/agents/NewAgent";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRouter } from "next/navigation";
import { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
  let mockPush: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    mockPush = vi.fn();

    vi.mocked(useRouter).mockReturnValue({
      push: mockPush,
      back: vi.fn(),
      forward: vi.fn(),
      refresh: vi.fn(),
      replace: vi.fn(),
      prefetch: vi.fn(),
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
          "Create a new AI student agent with specific personality and behavior characteristics"
        )
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /create agent/i })
      ).toBeInTheDocument();
    });

    it("should have correct accessibility attributes", () => {
      renderWithProviders(<NewAgent />);

      const nameInput = screen.getByLabelText(/agent name/i);

      expect(nameInput).toHaveAttribute("required");
      expect(nameInput).toHaveAttribute(
        "placeholder",
        "e.g., Enthusiastic Student Agent"
      );
    });
  });

  describe("Integration", () => {
    it("should integrate properly with the Agent component", () => {
      renderWithProviders(<NewAgent />);

      // The component should render the Agent component in create mode
      expect(screen.getByText("Create Agent")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /create agent/i })
      ).toBeInTheDocument();
    });

    it("should handle form submission with valid data", async () => {
      const { createAgent } = await import(
        "@/utils/mutations/agents/create-agent"
      );
      vi.mocked(createAgent).mockResolvedValue({
        id: "new-agent-id",
        createdAt: "2024-01-01T00:00:00Z",
        name: "Test Agent",
        description: "Test Description",
        systemPrompt: "Test System Prompt",
        agentType: "student" as const,
        temperature: 0.8,
      });

      const user = userEvent.setup();
      renderWithProviders(<NewAgent />);

      const nameInput = screen.getByLabelText(/agent name/i);
      const descriptionTextarea = screen.getByLabelText(/description/i);
      const systemPromptTextarea = screen.getByLabelText(/system prompt/i);
      const temperatureSlider = screen.getByLabelText(/temperature/i);
      const submitButton = screen.getByRole("button", {
        name: /create agent/i,
      });

      await user.type(nameInput, "Test Agent");
      await user.type(descriptionTextarea, "Test Description");
      await user.type(systemPromptTextarea, "Test System Prompt");
      await user.clear(temperatureSlider);
      await user.type(temperatureSlider, "0.8");
      await user.click(submitButton);

      await waitFor(() => {
        expect(createAgent).toHaveBeenCalledWith({
          name: "Test Agent",
          description: "Test Description",
          systemPrompt: "Test System Prompt",
          agentType: "student",
          temperature: 0.8,
        });
        expect(mockPush).toHaveBeenCalledWith("/management/agents");
      });
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
