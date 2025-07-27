import { renderWithMocks } from "@/test/renderWithMocks";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

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
      expect(screen.getByRole("button")).toBeInTheDocument();
    });

    it("should have correct accessibility attributes", () => {
      renderWithMocks(<AttemptInput />);

      const textarea = screen.getByPlaceholderText("Type your message...");
      const sendButton = screen.getByRole("button");

      expect(textarea).toBeInTheDocument();
      expect(sendButton).toBeInTheDocument();

      // Check accessibility attributes
      expect(textarea).toHaveAttribute("placeholder", "Type your message...");
      expect(sendButton).toBeEnabled();
    });
  });

  describe("User Interactions", () => {
    it("should handle state changes", async () => {
      const user = userEvent.setup();
      renderWithMocks(<AttemptInput />);

      const textarea = screen.getByPlaceholderText("Type your message...");
      const sendButton = screen.getByRole("button");

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
      const sendButton = screen.getByRole("button");

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
      // Test with completed chat (should not render)
      vi.mocked(
        require("@/contexts/simulation-context").useSimulation
      ).mockReturnValue({
        currentChat: { id: "test-chat-id", completed: true },
        simulation: { timeLimit: null },
        isActive: true,
        isSendingMessage: false,
        isStoppingMessage: false,
        sendMessage: mockSendMessage,
        stopMessage: mockStopMessage,
      });

      const { container } = renderWithMocks(<AttemptInput />);

      // Component should not render when chat is completed
      expect(container.firstChild).toBeNull();
    });
  });
});
