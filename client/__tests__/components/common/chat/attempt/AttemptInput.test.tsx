import { render } from '@/test/custom-render';
import { screen } from '@/test/custom-render';
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
      render(<AttemptInput />);

      expect(
        screen.getByPlaceholderText("Type your message...")
      ).toBeInTheDocument();

      // Look for the send button by its type attribute
      const sendButton = document.querySelector('button[type="submit"]');
      expect(sendButton).toBeInTheDocument();
    });

    it("should have correct accessibility attributes", () => {
      render(<AttemptInput />);

      const textarea = screen.getByPlaceholderText("Type your message...");

      // Check accessibility attributes
      expect(textarea).toHaveAttribute("placeholder", "Type your message...");

      // The button should be disabled when no text (we'll test this in user interactions)
      const sendButton = document.querySelector('button[type="submit"]');
      expect(sendButton).toBeInTheDocument();
    });
  });

  describe("User Interactions", () => {
    it("should handle state changes", async () => {
      const user = userEvent.setup();
      render(<AttemptInput />);

      const textarea = screen.getByPlaceholderText("Type your message...");
      const sendButton = document.querySelector(
        'button[type="submit"]'
      ) as HTMLButtonElement;

      // Initially button should be disabled (no text)
      expect(sendButton).toBeDisabled();

      // Type some text
      await user.type(textarea, "Hello world");

      // Button should now be enabled
      expect(sendButton).toBeEnabled();
    });

    it("should handle user events", async () => {
      const user = userEvent.setup();
      render(<AttemptInput />);

      const textarea = screen.getByPlaceholderText("Type your message...");
      const sendButton = document.querySelector(
        'button[type="submit"]'
      ) as HTMLButtonElement;

      // Type a message
      await user.type(textarea, "Test message");

      // Click send button
      await user.click(sendButton);

      // Should call sendMessage
      expect(mockSendMessage).toHaveBeenCalledWith("Test message");

      // Textarea should be cleared
      expect(textarea).toHaveValue("");
    });

    it("should handle Enter key submission", async () => {
      const user = userEvent.setup();
      render(<AttemptInput />);

      const textarea = screen.getByPlaceholderText("Type your message...");

      // Type a message and press Enter
      await user.type(textarea, "Test message{enter}");

      // Should call sendMessage
      expect(mockSendMessage).toHaveBeenCalledWith("Test message");

      // Textarea should be cleared
      expect(textarea).toHaveValue("");
    });

    it("should not submit on Shift+Enter", async () => {
      const user = userEvent.setup();
      render(<AttemptInput />);

      const textarea = screen.getByPlaceholderText("Type your message...");

      // Type a message
      await user.type(textarea, "Test message");

      // Press Shift+Enter (this should not submit)
      await user.keyboard("{Shift>}{Enter}{/Shift}");

      // Should not call sendMessage
      expect(mockSendMessage).not.toHaveBeenCalled();

      // Textarea should still have the text (Shift+Enter should add a newline)
      expect(textarea).toHaveValue("Test message\n");
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", async () => {
      const user = userEvent.setup();

      // Test with empty message (button should be disabled)
      render(<AttemptInput />);

      const sendButton = document.querySelector(
        'button[type="submit"]'
      ) as HTMLButtonElement;

      // Button should be disabled when no text
      expect(sendButton).toBeDisabled();

      // Type only whitespace
      await user.type(
        screen.getByPlaceholderText("Type your message..."),
        "   "
      );

      // Button should still be disabled
      expect(sendButton).toBeDisabled();
    });

    it("should handle empty message submission", async () => {
      const user = userEvent.setup();
      render(<AttemptInput />);

      const sendButton = document.querySelector(
        'button[type="submit"]'
      ) as HTMLButtonElement;

      // Try to submit empty message
      await user.click(sendButton);

      // Should not call sendMessage
      expect(mockSendMessage).not.toHaveBeenCalled();
    });

    it("should handle whitespace-only message", async () => {
      const user = userEvent.setup();
      render(<AttemptInput />);

      const textarea = screen.getByPlaceholderText("Type your message...");
      const sendButton = document.querySelector(
        'button[type="submit"]'
      ) as HTMLButtonElement;

      // Type only whitespace
      await user.type(textarea, "   ");

      // Try to submit
      await user.click(sendButton);

      // Should not call sendMessage
      expect(mockSendMessage).not.toHaveBeenCalled();
    });
  });
});
