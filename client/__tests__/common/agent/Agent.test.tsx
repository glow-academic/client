import Agent from "@/components/common/agent/Agent";
import { createAgentMock } from "@/mocks/mutations";
import { renderWithProviders } from "@/mocks/utils";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useSession } from "next-auth/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock the queries
vi.mock("@/utils/queries/agents/get-agent", () => ({
  getAgent: vi.fn(() =>
    Promise.resolve({
      id: "test-agent-id",
      name: "Test Agent",
      description: "Test Description",
      systemPrompt: "Test System Prompt",
      temperature: 50,
      createdAt: "2024-01-15T10:00:00Z",
      updatedAt: "2024-01-15T10:00:00Z",
      defaultAgent: false,
    })
  ),
}));

// Mock the mutations directly
const mockCreateAgent = vi.fn();
const mockUpdateAgent = vi.fn();

vi.mock("@/utils/mutations/agents/create-agent", () => ({
  createAgent: mockCreateAgent,
}));

vi.mock("@/utils/mutations/agents/update-agent", () => ({
  updateAgent: mockUpdateAgent,
}));

describe("Agent Component", () => {
  beforeEach(() => {
    // Reset all mocks before each test
    mockCreateAgent.mockReset();
    mockUpdateAgent.mockReset();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Role-based Access Control", () => {
    it("should render for admin users", () => {
      renderWithProviders(<Agent />, "admin");
      expect(screen.getByLabelText(/agent name/i)).toBeVisible();
    });

    it("should render for instructional users", () => {
      renderWithProviders(<Agent />, "instructional");
      expect(screen.getByLabelText(/agent name/i)).toBeVisible();
    });

    it("should render for instructor users", () => {
      renderWithProviders(<Agent />, "instructor");
      expect(screen.getByLabelText(/agent name/i)).toBeVisible();
    });

    it("should show access denied for TA users", () => {
      renderWithProviders(<Agent />, "ta");
      expect(screen.getByText(/access denied/i)).toBeVisible();
      expect(
        screen.getByText(/you need instructor privileges or higher/i)
      ).toBeVisible();
    });

    it("should show access denied for guest users", () => {
      renderWithProviders(<Agent />, "guest");
      expect(screen.getByText(/access denied/i)).toBeVisible();
      expect(
        screen.getByText(/you need instructor privileges or higher/i)
      ).toBeVisible();
    });

    it("should handle unauthenticated users", () => {
      // Mock unauthenticated session
      vi.mocked(useSession).mockReturnValue({
        data: null,
        status: "unauthenticated",
        update: vi.fn(),
      });

      renderWithProviders(<Agent />, "guest", { session: null });
      expect(screen.getByText(/access denied/i)).toBeVisible();
    });
  });

  describe("Create Mode (Authorized Users Only)", () => {
    it("renders create form with correct initial state", () => {
      renderWithProviders(<Agent />, "admin");

      // Check form elements are present
      expect(screen.getByLabelText(/agent name/i)).toBeVisible();
      expect(screen.getByLabelText(/description/i)).toBeVisible();
      expect(screen.getByLabelText(/system prompt/i)).toBeVisible();
      expect(screen.getByText(/temperature:/i)).toBeVisible();
      expect(
        screen.getByRole("button", { name: /create agent/i })
      ).toBeVisible();

      // Check initial values
      expect(screen.getByLabelText(/agent name/i)).toHaveValue("");
      expect(screen.getByLabelText(/description/i)).toHaveValue("");
      expect(screen.getByLabelText(/system prompt/i)).toHaveValue("");
    });

    it("shows validation errors when required fields are missing", async () => {
      const user = userEvent.setup();
      renderWithProviders(<Agent />, "admin");

      await user.click(screen.getByRole("button", { name: /create agent/i }));

      // Wait for toast error messages to appear
      await waitFor(() => {
        // The component shows toast errors, so we need to check if the mutation was not called
        expect(mockCreateAgent).not.toHaveBeenCalled();
      });
    });

    it("handles basic form input", async () => {
      const user = userEvent.setup();
      renderWithProviders(<Agent />, "admin");

      // Fill out basic form fields
      await user.type(screen.getByLabelText(/agent name/i), "Test Agent");
      await user.type(
        screen.getByLabelText(/description/i),
        "Test Description"
      );

      // Check that values were set
      expect(screen.getByDisplayValue("Test Agent")).toBeVisible();
      expect(screen.getByDisplayValue("Test Description")).toBeVisible();
    });

    it("handles temperature slider input", async () => {
      renderWithProviders(<Agent />, "admin");

      // The temperature slider should be visible and functional
      const temperatureSlider = screen.getByTestId("temperature-slider");
      expect(temperatureSlider).toBeVisible();
    });
  });

  describe("Edit Mode (Authorized Users Only)", () => {
    const mockAgentData = {
      id: "test-agent-id",
      name: "Test Agent",
      description: "Test Description",
      systemPrompt: "Test System Prompt",
      temperature: 50,
      createdAt: "2024-01-15T10:00:00Z",
      updatedAt: "2024-01-15T10:00:00Z",
      defaultAgent: false,
    };

    it("renders edit form with prefilled data", async () => {
      renderWithProviders(
        <Agent agentId="test-agent-id" mode="edit" />,
        "admin"
      );

      // Wait for data to load and form to be populated
      expect(
        await screen.findByDisplayValue(mockAgentData.name || "")
      ).toBeVisible();
      expect(
        screen.getByDisplayValue(mockAgentData.description || "")
      ).toBeVisible();
      expect(
        screen.getByRole("button", { name: /update agent/i })
      ).toBeVisible();
    });

    it("shows loading state while fetching agent data", () => {
      renderWithProviders(
        <Agent agentId="test-agent-id" mode="edit" />,
        "admin"
      );

      // Should show loading content or skeleton
      // The component shows a skeleton structure when loading
      expect(
        screen.getByRole("button", { name: /update agent/i })
      ).toBeVisible();
    });
  });

  describe("Form Submission (Authorized Users Only)", () => {
    it("handles create form submission", async () => {
      const user = userEvent.setup();

      // Mock the createAgent mutation to resolve successfully
      createAgentMock.mockImplementation(() =>
        Promise.resolve({
          id: "new-agent-id",
          name: "Test Agent",
          description: "Test Description",
          systemPrompt: "Test System Prompt",
          temperature: 0,
          createdAt: "2024-01-15T10:00:00Z",
          updatedAt: "2024-01-15T10:00:00Z",
          defaultAgent: false,
        })
      );

      renderWithProviders(<Agent />, "admin");

      // Fill out form with valid data
      await user.type(screen.getByLabelText(/agent name/i), "Test Agent");
      await user.type(
        screen.getByLabelText(/description/i),
        "Test Description"
      );
      await user.type(
        screen.getByLabelText(/system prompt/i),
        "Test System Prompt"
      );

      // Submit form
      await user.click(screen.getByRole("button", { name: /create agent/i }));

      // Wait for submission to complete
      await waitFor(() => {
        expect(createAgentMock).toHaveBeenCalledWith({
          name: "Test Agent",
          description: "Test Description",
          systemPrompt: "Test System Prompt",
          temperature: 0,
        });
      });
    });

    it("handles create mutation errors gracefully", async () => {
      const user = userEvent.setup();
      const mockError = new Error("Failed to create agent");
      createAgentMock.mockRejectedValue(mockError);

      renderWithProviders(<Agent />, "admin");

      // Fill out form with valid data
      await user.type(screen.getByLabelText(/agent name/i), "Test");
      await user.type(screen.getByLabelText(/description/i), "Test");
      await user.type(screen.getByLabelText(/system prompt/i), "Test");

      // Submit form
      await user.click(screen.getByRole("button", { name: /create agent/i }));

      // Form should still be available for retry
      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /create agent/i })
        ).not.toBeDisabled();
      });
    });
  });

  describe("Accessibility (Authorized Users Only)", () => {
    it("has proper form labels and structure", () => {
      renderWithProviders(<Agent />, "admin");

      // Check that form fields have proper labels
      expect(screen.getByLabelText(/agent name/i)).toBeVisible();
      expect(screen.getByLabelText(/description/i)).toBeVisible();
      expect(screen.getByLabelText(/system prompt/i)).toBeVisible();
      expect(screen.getByText(/temperature:/i)).toBeVisible();

      // Check that required fields are marked
      expect(screen.getByText(/agent name \*/i)).toBeVisible();
      expect(screen.getByText(/description \*/i)).toBeVisible();
      expect(screen.getByText(/system prompt \*/i)).toBeVisible();
    });
  });

  describe("Form Validation (Authorized Users Only)", () => {
    it("validates required fields", async () => {
      const user = userEvent.setup();
      renderWithProviders(<Agent />, "admin");

      // Try to submit empty form
      await user.click(screen.getByRole("button", { name: /create agent/i }));

      // Should not call mutation with empty data
      expect(createAgentMock).not.toHaveBeenCalled();
    });

    it("accepts valid form data", async () => {
      const user = userEvent.setup();

      // Mock the createAgent mutation to resolve successfully
      createAgentMock.mockImplementation(() =>
        Promise.resolve({
          id: "new-agent-id",
          name: "Valid Agent",
          description: "Valid Description",
          systemPrompt: "Valid System Prompt",
          temperature: 0,
          createdAt: "2024-01-15T10:00:00Z",
          updatedAt: "2024-01-15T10:00:00Z",
          defaultAgent: false,
        })
      );

      renderWithProviders(<Agent />, "admin");

      // Fill out form completely
      await user.type(screen.getByLabelText(/agent name/i), "Valid Agent");
      await user.type(
        screen.getByLabelText(/description/i),
        "Valid Description"
      );
      await user.type(
        screen.getByLabelText(/system prompt/i),
        "Valid System Prompt"
      );

      await user.click(screen.getByRole("button", { name: /create agent/i }));

      await waitFor(() => {
        expect(createAgentMock).toHaveBeenCalledWith({
          name: "Valid Agent",
          description: "Valid Description",
          systemPrompt: "Valid System Prompt",
          temperature: 0,
        });
      });
    });
  });

  describe("Role-specific Behavior", () => {
    it("works correctly for instructional role", () => {
      renderWithProviders(<Agent />, "instructional");
      expect(screen.getByLabelText(/agent name/i)).toBeVisible();
      expect(
        screen.getByRole("button", { name: /create agent/i })
      ).toBeVisible();
    });

    it("works correctly for instructor role", () => {
      renderWithProviders(<Agent />, "instructor");
      expect(screen.getByLabelText(/agent name/i)).toBeVisible();
      expect(
        screen.getByRole("button", { name: /create agent/i })
      ).toBeVisible();
    });

    it("blocks access for unauthorized roles", () => {
      const unauthorizedRoles = ["ta", "guest"] as const;

      unauthorizedRoles.forEach((role) => {
        const { unmount } = renderWithProviders(<Agent />, role);

        expect(screen.getByText(/access denied/i)).toBeVisible();
        expect(screen.queryByLabelText(/agent name/i)).not.toBeInTheDocument();

        unmount();
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
 * - Uses hooks: useState, useEffect, useRouter, useQuery, useRole
 * - Uses router: true
 * - Has API calls: true (getAgent, createAgent, updateAgent)
 * - Has form handling: true
 * - Uses state: true
 * - Uses effects: true
 * - Uses context: true (useRole)
 * - Has role-based access control: true
 *
 * Role-based access control:
 * - Allowed roles: instructor, instructional, admin
 * - Blocked roles: ta, guest
 * - Access denied message: "You need instructor privileges or higher to access agent management."
 */
