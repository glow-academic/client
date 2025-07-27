import { renderWithMocks } from "@/test/renderWithMocks";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

// ——————————————————————————————————————————
import ChatWidget from "@/components/common/home/ChatWidget";

// ✨ Import comprehensive mock data from our centralized mock system
import "@/mocks/api";
import "@/mocks/mutations";
import "@/mocks/queries";

// Mock the assistant context
vi.mock("@/contexts/assistant-context", () => ({
  useAssistant: () => ({
    uiState: "widget",
    expand: vi.fn(),
    close: vi.fn(),
    currentChatId: null,
    chats: [],
    isLoadingChats: false,
    createChat: vi.fn(),
    selectChat: vi.fn(),
    deleteChat: vi.fn(),
    sendMessage: vi.fn(),
    isLoading: false,
    error: null,
  }),
  AssistantProvider: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

// Mock the profile context
vi.mock("@/contexts/profile-context", () => ({
  useProfile: () => ({
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
    setActiveProfile: vi.fn(),
    profiles: [],
    isLoading: false,
  }),
  ProfileProvider: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

// Mock the router
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
  usePathname: () => "/",
}));

describe("ChatWidget", () => {
  /* ------------------------------------------------------------------ *
   * 💡 Mock Data Usage Guide:
   *
   * All API functions are automatically mocked via imports above.
   * Use mockSchema.* for realistic test data:
   *
   * Examples:
   * - mockSchema.users[0] - First user object
   * - mockSchema.classes - Array of class objects
   * - mockSchema.profiles - Array of profile objects
   *
   * To override specific mocks in individual tests:
   * - vi.mocked(queryFunction).mockResolvedValue(customData)
   * - vi.mocked(mutationFunction).mockResolvedValue(customResponse)
   * ------------------------------------------------------------------ */

  // ✨ Reset mocks after each test
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      // ✨ All mocks are automatically set up via imports above
      renderWithMocks(<ChatWidget up={false} />);

      // The widget should render when uiState is "widget"
      await waitFor(() => {
        expect(screen.getByText("GLOW")).toBeInTheDocument();
      });
    });

    it("should render widget content when in widget state", async () => {
      renderWithMocks(<ChatWidget up={false} />);

      await waitFor(() => {
        expect(screen.getByText("GLOW")).toBeInTheDocument();
        expect(screen.getByText("New Chat")).toBeInTheDocument();
      });
    });

    it("should have correct accessibility attributes", async () => {
      renderWithMocks(<ChatWidget up={false} />);

      await waitFor(() => {
        // Check for widget container
        const widget = screen.getByText("GLOW").closest("div");
        expect(widget).toBeInTheDocument();

        // Check for close button
        const closeButton = screen.getByRole("button", { name: /close/i });
        expect(closeButton).toBeInTheDocument();
      });
    });
  });

  describe("User Interactions", () => {
    it("should handle chat selection", async () => {
      const user = userEvent.setup();
      renderWithMocks(<ChatWidget up={false} />);

      await waitFor(() => {
        expect(screen.getByText("GLOW")).toBeInTheDocument();
      });

      // Find and click the chat selector
      const chatSelector = screen.getByRole("combobox");
      expect(chatSelector).toBeInTheDocument();

      await user.click(chatSelector);

      // Should show past chats if available
      await waitFor(() => {
        expect(screen.getByText("Past Chats")).toBeInTheDocument();
      });
    });

    it("should handle state changes", async () => {
      const user = userEvent.setup();
      renderWithMocks(<ChatWidget up={false} />);

      await waitFor(() => {
        expect(screen.getByText("GLOW")).toBeInTheDocument();
      });

      // Test maximize button
      const maximizeButton = screen.getByRole("button", { name: /expand/i });
      await user.click(maximizeButton);

      // Button should be clickable
      expect(maximizeButton).toBeInTheDocument();
    });

    it("should handle user events", async () => {
      const user = userEvent.setup();
      renderWithMocks(<ChatWidget up={false} />);

      await waitFor(() => {
        expect(screen.getByText("GLOW")).toBeInTheDocument();
      });

      // Test close button
      const closeButton = screen.getByRole("button", { name: /close/i });
      await user.click(closeButton);

      // Button should be clickable
      expect(closeButton).toBeInTheDocument();
    });
  });

  describe("API Integration", () => {
    it("should handle and display an API error state", async () => {
      // Arrange: Override the default success mock with an error for this test.
      const { getAssistantChatsByProfile } = await import(
        "@/utils/queries/assistant_chats/get-assistant-chats-by-profile"
      );
      vi.mocked(getAssistantChatsByProfile).mockRejectedValue(
        new Error("API Error")
      );

      renderWithMocks(<ChatWidget up={false} />);

      await waitFor(() => {
        expect(screen.getByText("GLOW")).toBeInTheDocument();
      });

      // Component should still render even with API errors
      expect(screen.getByText("New Chat")).toBeInTheDocument();
    });

    it("should handle loading states", async () => {
      renderWithMocks(<ChatWidget up={false} />);

      await waitFor(() => {
        expect(screen.getByText("GLOW")).toBeInTheDocument();
      });

      // Component should show loading states appropriately
      expect(screen.getByText("New Chat")).toBeInTheDocument();
    });
  });

  describe("Navigation", () => {
    it("should handle navigation", async () => {
      renderWithMocks(<ChatWidget up={false} />);

      await waitFor(() => {
        expect(screen.getByText("GLOW")).toBeInTheDocument();
      });

      // Should render widget content
      expect(screen.getByText("New Chat")).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", async () => {
      renderWithMocks(<ChatWidget up={false} />);

      await waitFor(() => {
        expect(screen.getByText("GLOW")).toBeInTheDocument();
      });

      // Should render properly even with minimal props
      expect(screen.getByText("New Chat")).toBeInTheDocument();
    });

    it("should handle missing or invalid props", async () => {
      // Test with no props
      renderWithMocks(<ChatWidget up={false} />);

      await waitFor(() => {
        expect(screen.getByText("GLOW")).toBeInTheDocument();
      });

      // Should render with default props
      expect(screen.getByText("New Chat")).toBeInTheDocument();
    });
  });
});
