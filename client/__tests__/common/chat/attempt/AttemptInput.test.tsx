import { renderWithMocks } from "@/test/renderWithMocks";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ——————————————————————————————————————————
import AttemptInput from "@/components/common/chat/attempt/AttemptInput";

// Mock the contexts
const mockSendMessage = vi.fn();
const mockStopMessage = vi.fn();

vi.mock("@/contexts/simulation-context", () => ({
  useSimulation: vi.fn(() => ({
    currentChat: { id: "test-chat-id", completed: false },
    simulation: { timeLimit: null },
    isActive: true,
    isSendingMessage: false,
    isStoppingMessage: false,
    sendMessage: mockSendMessage,
    stopMessage: mockStopMessage,
  })),
}));

vi.mock("@/contexts/websocket-context", () => ({
  useWebSocket: vi.fn(() => ({
    isConnected: true,
  })),
  WebSocketProvider: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

describe("AttemptInput", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      renderWithMocks(<AttemptInput />);

      expect(
        screen.getByPlaceholderText("Type your message...")
      ).toBeInTheDocument();
      expect(screen.getAllByRole("button")[1]).toBeInTheDocument();
    });

    it("should have correct accessibility attributes", () => {
      renderWithMocks(<AttemptInput />);

      const textarea = screen.getByPlaceholderText("Type your message...");
      const sendButton = screen.getAllByRole("button")[1];

      expect(textarea).toBeInTheDocument();
      expect(sendButton).toBeInTheDocument();

      // Check accessibility attributes
      expect(textarea).toHaveAttribute("placeholder", "Type your message...");
      expect(sendButton).toBeDisabled(); // Button is disabled when no text
    });
  });

  describe("User Interactions", () => {
    it("should handle state changes", async () => {
      const user = userEvent.setup();
      renderWithMocks(<AttemptInput />);

      const textarea = screen.getByPlaceholderText("Type your message...");
      const sendButton = screen.getAllByRole("button")[1];

      // Initially button should be disabled (no text)
      expect(sendButton).toBeDisabled();

      // Type some text
      await user.type(textarea, "Hello world");

      // Button should now be enabled
      expect(sendButton).toBeEnabled();
    });

    it("should handle user events", async () => {
      const user = userEvent.setup();
      renderWithMocks(<AttemptInput />);

      const textarea = screen.getByPlaceholderText("Type your message...");
      const sendButton = screen.getAllByRole("button")[1]!;

      // Type a message
      await user.type(textarea, "Test message");

      // Click send button
      await user.click(sendButton);

      // Should call sendMessage
      expect(mockSendMessage).toHaveBeenCalledWith("Test message");

      // Textarea should be cleared
      expect(textarea).toHaveValue("");
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", () => {
      // Test with empty message (button should be disabled)
      renderWithMocks(<AttemptInput />);

      const textarea = screen.getByPlaceholderText("Type your message...");
      const sendButton = screen.getAllByRole("button")[1];

      // Button should be disabled when no text
      expect(sendButton).toBeDisabled();

      // Type only whitespace
      userEvent.type(textarea, "   ");

      // Button should still be disabled
      expect(sendButton).toBeDisabled();
    });
  });
});
