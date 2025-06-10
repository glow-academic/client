import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { useRouter } from "next/navigation";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode } from "react";
import Agent from "@/components/common/agent/Agent";

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

vi.mock("@/utils/mutations/agents/create-agent", () => ({
  createAgent: vi.fn(),
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

describe("Agent", () => {
  let queryClient: QueryClient;
  const mockPush = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    (useRouter as any).mockReturnValue({
      push: mockPush,
      back: vi.fn(),
      forward: vi.fn(),
      refresh: vi.fn(),
      replace: vi.fn(),
    });
  });

  const renderWithProviders = (ui: React.ReactElement, options = {}) => {
    const AllProviders = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    return render(ui, { wrapper: AllProviders, ...options });
  };

  describe("Rendering", () => {
    it("should render create mode by default", () => {
      renderWithProviders(<Agent />);

      expect(
        screen.getByRole("button", { name: /create agent/i }),
      ).toBeInTheDocument();
      expect(screen.getByLabelText(/agent name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/subtitle/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/system prompt/i)).toBeInTheDocument();
    });

    it("should render edit mode when agentId is provided", () => {
      renderWithProviders(<Agent agentId="test-id" mode="edit" />);

      // Should show skeleton loading initially
      expect(document.querySelector(".animate-pulse")).toBeInTheDocument();
    });

    it("should have correct form fields and accessibility attributes", () => {
      renderWithProviders(<Agent />);

      const nameInput = screen.getByLabelText(/agent name/i);
      const subtitleInput = screen.getByLabelText(/subtitle/i);
      const descriptionTextarea = screen.getByLabelText(/description/i);
      const systemPromptTextarea = screen.getByLabelText(/system prompt/i);
      const agentTypeSelect = screen.getByLabelText(/agent type/i);
      const temperatureInput = screen.getByLabelText(/temperature/i);

      expect(nameInput).toHaveAttribute("required");
      expect(nameInput).toHaveAttribute(
        "placeholder",
        "e.g., Enthusiastic Student Agent",
      );
      expect(subtitleInput).toHaveAttribute("required");
      expect(subtitleInput).toHaveAttribute(
        "placeholder",
        "Brief description of the agent",
      );
      expect(descriptionTextarea).toHaveAttribute("required");
      expect(descriptionTextarea).toHaveAttribute(
        "placeholder",
        "Detailed behavior description and personality traits",
      );
      expect(systemPromptTextarea).toHaveAttribute("required");
      expect(systemPromptTextarea).toHaveAttribute(
        "placeholder",
        "System prompt that defines how the agent should behave and respond",
      );
      expect(agentTypeSelect).toBeInTheDocument();
      expect(temperatureInput).toHaveAttribute("type", "number");
      expect(temperatureInput).toHaveAttribute("min", "0");
      expect(temperatureInput).toHaveAttribute("max", "100");
    });

    it("should show helper text for system prompt and temperature", () => {
      renderWithProviders(<Agent />);

      expect(
        screen.getByText(
          "This prompt defines the agent's behavior and personality in conversations.",
        ),
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          "Temperature value for response randomness (0-100). Lower values are more deterministic.",
        ),
      ).toBeInTheDocument();
    });
  });

  describe("User Interactions", () => {
    it("should handle form submissions for create mode", async () => {
      const { createAgent } = await import(
        "@/utils/mutations/agents/create-agent"
      );
      (createAgent as any).mockResolvedValue({ id: "new-agent-id" });

      const user = userEvent.setup();
      renderWithProviders(<Agent />);

      const nameInput = screen.getByLabelText(/agent name/i);
      const subtitleInput = screen.getByLabelText(/subtitle/i);
      const descriptionTextarea = screen.getByLabelText(/description/i);
      const systemPromptTextarea = screen.getByLabelText(/system prompt/i);
      const submitButton = screen.getByRole("button", {
        name: /create agent/i,
      });

      await user.type(nameInput, "Test Agent");
      await user.type(subtitleInput, "Test Subtitle");
      await user.type(descriptionTextarea, "Test Description");
      await user.type(systemPromptTextarea, "Test System Prompt");
      await user.click(submitButton);

      await waitFor(() => {
        expect(createAgent).toHaveBeenCalledWith({
          name: "Test Agent",
          subtitle: "Test Subtitle",
          description: "Test Description",
          systemPrompt: "Test System Prompt",
          agentType: "student",
          temperature: 0,
        });
      });

      expect(mockPush).toHaveBeenCalledWith("/management/agents");
    });

    it("should handle agent type selection", async () => {
      const user = userEvent.setup();
      renderWithProviders(<Agent />);

      const agentTypeSelect = screen.getByLabelText(/agent type/i);
      await user.click(agentTypeSelect);

      const taOption = screen.getByText("Teaching Assistant");
      await user.click(taOption);

      expect(agentTypeSelect).toHaveTextContent("Teaching Assistant");
    });

    it("should handle temperature input", async () => {
      const user = userEvent.setup();
      renderWithProviders(<Agent />);

      const temperatureInput = screen.getByLabelText(/temperature/i);
      await user.clear(temperatureInput);
      await user.type(temperatureInput, "50");

      expect(temperatureInput).toHaveValue(50);
    });

    it("should validate required fields", async () => {
      const { toast } = await import("sonner");
      const user = userEvent.setup();
      renderWithProviders(<Agent />);

      const submitButton = screen.getByRole("button", {
        name: /create agent/i,
      });
      await user.click(submitButton);

      expect(toast.error).toHaveBeenCalledWith("Agent name is required");
    });

    it("should validate all required fields in sequence", async () => {
      const { toast } = await import("sonner");
      const user = userEvent.setup();
      renderWithProviders(<Agent />);

      const nameInput = screen.getByLabelText(/agent name/i);
      const subtitleInput = screen.getByLabelText(/subtitle/i);
      const descriptionTextarea = screen.getByLabelText(/description/i);
      const submitButton = screen.getByRole("button", {
        name: /create agent/i,
      });

      // Test name validation
      await user.click(submitButton);
      expect(toast.error).toHaveBeenCalledWith("Agent name is required");

      // Test subtitle validation
      await user.type(nameInput, "Test Agent");
      await user.click(submitButton);
      expect(toast.error).toHaveBeenCalledWith("Agent subtitle is required");

      // Test description validation
      await user.type(subtitleInput, "Test Subtitle");
      await user.click(submitButton);
      expect(toast.error).toHaveBeenCalledWith("Agent description is required");

      // Test system prompt validation
      await user.type(descriptionTextarea, "Test Description");
      await user.click(submitButton);
      expect(toast.error).toHaveBeenCalledWith("System prompt is required");
    });

    it("should show loading state during submission", async () => {
      const { createAgent } = await import(
        "@/utils/mutations/agents/create-agent"
      );
      (createAgent as any).mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100)),
      );

      const user = userEvent.setup();
      renderWithProviders(<Agent />);

      const nameInput = screen.getByLabelText(/agent name/i);
      const subtitleInput = screen.getByLabelText(/subtitle/i);
      const descriptionTextarea = screen.getByLabelText(/description/i);
      const systemPromptTextarea = screen.getByLabelText(/system prompt/i);
      const submitButton = screen.getByRole("button", {
        name: /create agent/i,
      });

      await user.type(nameInput, "Test Agent");
      await user.type(subtitleInput, "Test Subtitle");
      await user.type(descriptionTextarea, "Test Description");
      await user.type(systemPromptTextarea, "Test System Prompt");
      await user.click(submitButton);

      expect(
        screen.getByRole("button", { name: /creating.../i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /creating.../i }),
      ).toBeDisabled();
    });
  });

  describe("API Integration", () => {
    it("should handle loading states in edit mode", () => {
      renderWithProviders(<Agent agentId="test-id" mode="edit" />);

      // Should show skeleton loading state
      expect(document.querySelector(".animate-pulse")).toBeInTheDocument();
    });

    it("should handle error states when agent not found", async () => {
      const { getAgent } = await import("@/utils/queries/agents/get-agent");
      (getAgent as any).mockResolvedValue(null);

      renderWithProviders(<Agent agentId="non-existent-id" mode="edit" />);

      await waitFor(() => {
        expect(screen.getByText("Agent Not Found")).toBeInTheDocument();
        expect(
          screen.getByText("The agent you're looking for doesn't exist."),
        ).toBeInTheDocument();
        expect(
          screen.getByRole("button", { name: /back to agents/i }),
        ).toBeInTheDocument();
      });
    });

    it("should populate form data in edit mode", async () => {
      const mockAgent = {
        name: "Existing Agent",
        subtitle: "Existing Subtitle",
        description: "Existing Description",
        systemPrompt: "Existing System Prompt",
        agentType: "ta" as const,
        temperature: 75,
      };

      const { getAgent } = await import("@/utils/queries/agents/get-agent");
      (getAgent as any).mockResolvedValue(mockAgent);

      renderWithProviders(<Agent agentId="test-id" mode="edit" />);

      await waitFor(() => {
        expect(screen.getByDisplayValue("Existing Agent")).toBeInTheDocument();
        expect(
          screen.getByDisplayValue("Existing Subtitle"),
        ).toBeInTheDocument();
        expect(
          screen.getByDisplayValue("Existing Description"),
        ).toBeInTheDocument();
        expect(
          screen.getByDisplayValue("Existing System Prompt"),
        ).toBeInTheDocument();
        expect(screen.getByDisplayValue("75")).toBeInTheDocument();
      });

      expect(
        screen.getByRole("button", { name: /update agent/i }),
      ).toBeInTheDocument();
    });

    it("should handle update agent submission", async () => {
      const mockAgent = {
        name: "Existing Agent",
        subtitle: "Existing Subtitle",
        description: "Existing Description",
        systemPrompt: "Existing System Prompt",
        agentType: "student" as const,
        temperature: 0,
      };

      const { getAgent } = await import("@/utils/queries/agents/get-agent");
      const { updateAgent } = await import(
        "@/utils/mutations/agents/update-agent"
      );
      (getAgent as any).mockResolvedValue(mockAgent);
      (updateAgent as any).mockResolvedValue({ id: "test-id" });

      const user = userEvent.setup();
      renderWithProviders(<Agent agentId="test-id" mode="edit" />);

      await waitFor(() => {
        expect(screen.getByDisplayValue("Existing Agent")).toBeInTheDocument();
      });

      const nameInput = screen.getByLabelText(/agent name/i);
      const submitButton = screen.getByRole("button", {
        name: /update agent/i,
      });

      await user.clear(nameInput);
      await user.type(nameInput, "Updated Agent");
      await user.click(submitButton);

      await waitFor(() => {
        expect(updateAgent).toHaveBeenCalledWith("test-id", {
          name: "Updated Agent",
          subtitle: "Existing Subtitle",
          description: "Existing Description",
          systemPrompt: "Existing System Prompt",
          agentType: "student",
          temperature: 0,
        });
      });

      expect(mockPush).toHaveBeenCalledWith("/management/agents");
    });

    it("should handle API errors gracefully", async () => {
      const { createAgent } = await import(
        "@/utils/mutations/agents/create-agent"
      );
      const { toast } = await import("sonner");
      (createAgent as any).mockRejectedValue(new Error("API Error"));

      const user = userEvent.setup();
      renderWithProviders(<Agent />);

      const nameInput = screen.getByLabelText(/agent name/i);
      const subtitleInput = screen.getByLabelText(/subtitle/i);
      const descriptionTextarea = screen.getByLabelText(/description/i);
      const systemPromptTextarea = screen.getByLabelText(/system prompt/i);
      const submitButton = screen.getByRole("button", {
        name: /create agent/i,
      });

      await user.type(nameInput, "Test Agent");
      await user.type(subtitleInput, "Test Subtitle");
      await user.type(descriptionTextarea, "Test Description");
      await user.type(systemPromptTextarea, "Test System Prompt");
      await user.click(submitButton);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Failed to create agent");
      });
    });
  });
});

/*
 * Component Analysis for Agent:
 * Path: common/agent/Agent.tsx
 *
 * Features detected:
 * - Default export: true
 * - Named exports: None
 * - Has props: true (AgentProps interface)
 * - Props interface: AgentProps with agentId and mode
 * - Client component: true
 * - Uses hooks: useState, useEffect, useRouter, useQuery
 * - Uses router: true
 * - Has API calls: true (getAgent, createAgent, updateAgent)
 * - Has form handling: true
 * - Uses state: true
 * - Uses effects: true
 * - Uses context: false
 *
 * The component has been simplified to remove Card wrapper and header elements,
 * focusing on direct form rendering with proper validation and API integration.
 */
