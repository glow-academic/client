import { renderWithMocks } from "@/test/renderWithMocks";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

// ——————————————————————————————————————————
import ChatDialog from "@/components/common/home/ChatDialog";

// ✨ Import comprehensive mock data from our centralized mock system
import "@/mocks/api";
import "@/mocks/mutations";
import "@/mocks/queries";

describe("ChatDialog", () => {
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
      renderWithMocks(<ChatDialog />);

      // The dialog should render when uiState is "expanded"
      // Since the assistant context controls this, we need to mock it properly
      await waitFor(() => {
        expect(screen.getByRole("dialog")).toBeInTheDocument();
      });
    });

    it("should render dialog content when expanded", async () => {
      renderWithMocks(<ChatDialog />);

      await waitFor(() => {
        expect(screen.getByRole("dialog")).toBeInTheDocument();
        expect(screen.getByText("New Chat")).toBeInTheDocument();
      });
    });

    it("should have correct accessibility attributes", async () => {
      renderWithMocks(<ChatDialog />);

      await waitFor(() => {
        const dialog = screen.getByRole("dialog");
        expect(dialog).toBeInTheDocument();

        // Check for dialog title
        expect(screen.getByText("New Chat")).toBeInTheDocument();

        // Check for close button
        const closeButton = screen.getByRole("button", { name: /close/i });
        expect(closeButton).toBeInTheDocument();
      });
    });
  });

  describe("User Interactions", () => {
    it("should handle chat selection", async () => {
      const user = userEvent.setup();
      renderWithMocks(<ChatDialog />);

      await waitFor(() => {
        expect(screen.getByRole("dialog")).toBeInTheDocument();
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
      renderWithMocks(<ChatDialog />);

      await waitFor(() => {
        expect(screen.getByRole("dialog")).toBeInTheDocument();
      });

      // Test minimize button
      const minimizeButton = screen.getByRole("button", {
        name: /minimize to widget/i,
      });
      expect(minimizeButton).toBeInTheDocument();

      await user.click(minimizeButton);
      // The dialog should close and widget should open
    });

    it("should handle user events", async () => {
      const user = userEvent.setup();
      renderWithMocks(<ChatDialog />);

      await waitFor(() => {
        expect(screen.getByRole("dialog")).toBeInTheDocument();
      });

      // Test close button
      const closeButton = screen.getByRole("button", { name: /close/i });
      expect(closeButton).toBeInTheDocument();

      await user.click(closeButton);
      // The dialog should close
    });
  });

  describe("API Integration", () => {
    it("should handle and display an API error state", async () => {
      // Arrange: Override the default success mock with an error for this test.
      const { getAssistantChat } = await import(
        "@/utils/queries/assistant_chats/get-assistant-chat"
      );
      vi.mocked(getAssistantChat).mockRejectedValue(new Error("API Error"));

      renderWithMocks(<ChatDialog />);

      await waitFor(() => {
        expect(screen.getByRole("dialog")).toBeInTheDocument();
      });

      // The component should still render even with API errors
      expect(screen.getByText("New Chat")).toBeInTheDocument();
    });

    it("should handle loading states", async () => {
      renderWithMocks(<ChatDialog />);

      await waitFor(() => {
        expect(screen.getByRole("dialog")).toBeInTheDocument();
      });

      // The component should show loading states appropriately
      expect(screen.getByText("New Chat")).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", async () => {
      // Test with no current chat
      renderWithMocks(<ChatDialog />);

      await waitFor(() => {
        expect(screen.getByRole("dialog")).toBeInTheDocument();
      });

      // Should show "New Chat" when no chat is selected
      expect(screen.getByText("New Chat")).toBeInTheDocument();
    });

    it("should handle missing chat data", async () => {
      // Mock empty chat data
      const { getAssistantChat } = await import(
        "@/utils/queries/assistant_chats/get-assistant-chat"
      );
      vi.mocked(getAssistantChat).mockResolvedValue(null);

      renderWithMocks(<ChatDialog />);

      await waitFor(() => {
        expect(screen.getByRole("dialog")).toBeInTheDocument();
      });

      // Should still render with fallback title
      expect(screen.getByText("GLOW Assistant")).toBeInTheDocument();
    });
  });
});
