import { renderWithMocks } from "@/test/renderWithMocks";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

// ——————————————————————————————————————————
import ChatInput, { ChatInputProps } from "@/components/common/home/ChatInput";

// Mock the assistant context
vi.mock("@/contexts/assistant-context", () => ({
  useAssistant: vi.fn(() => ({
    sendMessage: vi.fn(),
    stopMessage: vi.fn(),
    isSendingMessage: false,
    isStoppingMessage: false,
    currentChatId: null,
    uiState: { isOpen: false, isExpanded: false },
    setUiState: vi.fn(),
    openWidget: vi.fn(),
    expand: vi.fn(),
    minimize: vi.fn(),
    close: vi.fn(),
    toggle: vi.fn(),
    setCurrentChatId: vi.fn(),
    clearCurrentChatId: vi.fn(),
  })),
}));

// ------------------------------------------------------------------
// Minimal props factory – edit values as needed
const mockProps: ChatInputProps = {
  // promptToSet: 'test-promptToSet', /* optional */
};
// ------------------------------------------------------------------
describe("ChatInput", () => {
  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      renderWithMocks(<ChatInput {...mockProps} />);

      // Should render a form with textarea and send button
      await waitFor(() => {
        expect(screen.getByRole("form")).toBeInTheDocument();
        expect(screen.getByRole("textbox")).toBeInTheDocument();
        expect(
          screen.getByRole("button", { name: /send/i })
        ).toBeInTheDocument();
      });
    });

    it("should render with props", async () => {
      // Test with promptToSet prop
      const propsWithPrompt: ChatInputProps = {
        promptToSet: "test prompt",
        onPromptSet: vi.fn(),
        togglePrompt: vi.fn(),
      };

      renderWithMocks(<ChatInput {...propsWithPrompt} />);

      await waitFor(() => {
        expect(screen.getByRole("form")).toBeInTheDocument();
        expect(screen.getByDisplayValue("test prompt")).toBeInTheDocument();
      });
    });

    it("should have correct accessibility attributes", async () => {
      renderWithMocks(<ChatInput {...mockProps} />);

      await waitFor(() => {
        const textarea = screen.getByRole("textbox");
        const sendButton = screen.getByRole("button", { name: /send/i });

        expect(textarea).toBeInTheDocument();
        expect(sendButton).toBeInTheDocument();
        expect(textarea).toHaveAttribute(
          "placeholder",
          "Start a conversation..."
        );
      });
    });
  });

  describe("User Interactions", () => {
    it("should handle text input", async () => {
      const user = userEvent.setup();
      renderWithMocks(<ChatInput {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByRole("textbox")).toBeInTheDocument();
      });

      const textarea = screen.getByRole("textbox");
      await user.type(textarea, "Hello World");

      expect(textarea).toHaveValue("Hello World");
    });

    it("should handle form submission", async () => {
      const user = userEvent.setup();
      renderWithMocks(<ChatInput {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByRole("textbox")).toBeInTheDocument();
      });

      const textarea = screen.getByRole("textbox");
      const sendButton = screen.getByRole("button", { name: /send/i });

      await user.type(textarea, "Test message");
      await user.click(sendButton);

      // Message should be cleared after sending
      expect(textarea).toHaveValue("");
    });

    it("should handle Enter key submission", async () => {
      const user = userEvent.setup();
      renderWithMocks(<ChatInput {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByRole("textbox")).toBeInTheDocument();
      });

      const textarea = screen.getByRole("textbox");
      await user.type(textarea, "Test message{enter}");

      // Message should be cleared after sending
      expect(textarea).toHaveValue("");
    });

    it("should not submit empty messages", async () => {
      const user = userEvent.setup();
      renderWithMocks(<ChatInput {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByRole("textbox")).toBeInTheDocument();
      });

      const sendButton = screen.getByRole("button", { name: /send/i });
      expect(sendButton).toBeDisabled();
    });

    it("should handle Shift+Enter for new lines", async () => {
      const user = userEvent.setup();
      renderWithMocks(<ChatInput {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByRole("textbox")).toBeInTheDocument();
      });

      const textarea = screen.getByRole("textbox");
      await user.type(textarea, "Line 1{shift+enter}Line 2");

      // Should not submit, should add new line
      expect(textarea).toHaveValue("Line 1\nLine 2");
    });
  });

  describe("Props and State", () => {
    it("should handle promptToSet prop", async () => {
      const onPromptSet = vi.fn();
      renderWithMocks(
        <ChatInput
          {...mockProps}
          promptToSet="Set prompt"
          onPromptSet={onPromptSet}
        />
      );

      await waitFor(() => {
        expect(screen.getByDisplayValue("Set prompt")).toBeInTheDocument();
      });

      expect(onPromptSet).toHaveBeenCalled();
    });

    it("should handle togglePrompt callback", async () => {
      const togglePrompt = vi.fn();
      renderWithMocks(<ChatInput {...mockProps} togglePrompt={togglePrompt} />);

      await waitFor(() => {
        expect(screen.getByRole("textbox")).toBeInTheDocument();
      });

      // Should call togglePrompt with true when message is empty
      expect(togglePrompt).toHaveBeenCalledWith(true);
    });

    it("should update placeholder based on currentChatId", async () => {
      // Mock the context to return a currentChatId
      const { useAssistant } = await import("@/contexts/assistant-context");
      vi.mocked(useAssistant).mockReturnValue({
        sendMessage: vi.fn(),
        stopMessage: vi.fn(),
        isSendingMessage: false,
        isStoppingMessage: false,
        currentChatId: "test-chat-id",
        uiState: { isOpen: false, isExpanded: false },
        setUiState: vi.fn(),
        openWidget: vi.fn(),
        expand: vi.fn(),
        minimize: vi.fn(),
        close: vi.fn(),
        toggle: vi.fn(),
        setCurrentChatId: vi.fn(),
        clearCurrentChatId: vi.fn(),
      });

      renderWithMocks(<ChatInput {...mockProps} />);

      await waitFor(() => {
        expect(
          screen.getByPlaceholderText("Type a message...")
        ).toBeInTheDocument();
      });
    });
  });

  describe("Edge Cases", () => {
    it("should handle disabled state during sending", async () => {
      // Mock the context to return isSendingMessage: true
      const { useAssistant } = await import("@/contexts/assistant-context");
      vi.mocked(useAssistant).mockReturnValue({
        sendMessage: vi.fn(),
        stopMessage: vi.fn(),
        isSendingMessage: true,
        isStoppingMessage: false,
        currentChatId: null,
        uiState: { isOpen: false, isExpanded: false },
        setUiState: vi.fn(),
        openWidget: vi.fn(),
        expand: vi.fn(),
        minimize: vi.fn(),
        close: vi.fn(),
        toggle: vi.fn(),
        setCurrentChatId: vi.fn(),
        clearCurrentChatId: vi.fn(),
      });

      renderWithMocks(<ChatInput {...mockProps} />);

      await waitFor(() => {
        const textarea = screen.getByRole("textbox");
        expect(textarea).toBeDisabled();
      });
    });

    it("should handle stop button when sending", async () => {
      // Mock the context to return isSendingMessage: true
      const { useAssistant } = await import("@/contexts/assistant-context");
      vi.mocked(useAssistant).mockReturnValue({
        sendMessage: vi.fn(),
        stopMessage: vi.fn(),
        isSendingMessage: true,
        isStoppingMessage: false,
        currentChatId: null,
        uiState: { isOpen: false, isExpanded: false },
        setUiState: vi.fn(),
        openWidget: vi.fn(),
        expand: vi.fn(),
        minimize: vi.fn(),
        close: vi.fn(),
        toggle: vi.fn(),
        setCurrentChatId: vi.fn(),
        clearCurrentChatId: vi.fn(),
      });

      renderWithMocks(<ChatInput {...mockProps} />);

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /stop/i })
        ).toBeInTheDocument();
      });
    });

    it("should handle very long messages", async () => {
      const user = userEvent.setup();
      renderWithMocks(<ChatInput {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByRole("textbox")).toBeInTheDocument();
      });

      const textarea = screen.getByRole("textbox");
      const longMessage = "A".repeat(1000);
      await user.type(textarea, longMessage);

      expect(textarea).toHaveValue(longMessage);
    });
  });
});
