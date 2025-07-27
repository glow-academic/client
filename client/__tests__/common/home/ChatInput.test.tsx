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
    uiState: "closed",
    setUiState: vi.fn(),
    openWidget: vi.fn(),
    expand: vi.fn(),
    close: vi.fn(),
    setCurrentChatId: vi.fn(),
  })),
  AssistantProvider: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
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
        expect(screen.getByRole("textbox")).toBeInTheDocument();
        expect(screen.getByTitle("Send")).toBeInTheDocument();
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
        expect(screen.getByDisplayValue("test prompt")).toBeInTheDocument();
      });
    });

    it("should have correct accessibility attributes", async () => {
      renderWithMocks(<ChatInput {...mockProps} />);

      await waitFor(() => {
        const textarea = screen.getByRole("textbox");
        const sendButton = screen.getByTitle("Send");

        expect(textarea).toBeInTheDocument();
        expect(sendButton).toBeInTheDocument();
        expect(textarea).toHaveAttribute(
          "placeholder",
          "Start a conversation...",
        );
      });
    });
  });

  describe("User Interactions", () => {
    it("should handle text input", async () => {
      const _user = userEvent.setup();
      renderWithMocks(<ChatInput {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByRole("textbox")).toBeInTheDocument();
      });

      const textarea = screen.getByRole("textbox");
      await _user.type(textarea, "Hello World");

      expect(textarea).toHaveValue("Hello World");
    });

    it("should handle form submission", async () => {
      const _user = userEvent.setup();
      renderWithMocks(<ChatInput {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByRole("textbox")).toBeInTheDocument();
      });

      const textarea = screen.getByRole("textbox");
      const sendButton = screen.getByTitle("Send");

      await _user.type(textarea, "Test message");
      await _user.click(sendButton);

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

      const sendButton = screen.getByTitle("Send");
      expect(sendButton).toBeDisabled();
    });

    it("should handle Shift+Enter for new lines", async () => {
      const user = userEvent.setup();
      renderWithMocks(<ChatInput {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByRole("textbox")).toBeInTheDocument();
      });

      const textarea = screen.getByRole("textbox");
      await user.type(textarea, "Line 1");
      await user.keyboard("{Shift>}{Enter}{/Shift}");
      await user.type(textarea, "Line 2");

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
        />,
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
        uiState: "closed",
        setUiState: vi.fn(),
        openWidget: vi.fn(),
        expand: vi.fn(),
        close: vi.fn(),
        setCurrentChatId: vi.fn(),
      });

      renderWithMocks(<ChatInput {...mockProps} />);

      await waitFor(() => {
        const textarea = screen.getByRole("textbox");
        expect(textarea).toHaveAttribute("placeholder", "Type a message...");
      });
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", async () => {
      renderWithMocks(<ChatInput {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByRole("textbox")).toBeInTheDocument();
      });

      // Should render properly even with minimal props
      expect(screen.getByRole("textbox")).toBeInTheDocument();
    });

    it("should handle missing or invalid props", async () => {
      // Test with no props
      renderWithMocks(<ChatInput />);

      await waitFor(() => {
        expect(screen.getByRole("textbox")).toBeInTheDocument();
      });

      // Should render with default props
      expect(screen.getByRole("textbox")).toBeInTheDocument();
    });

    it("should handle sending state", async () => {
      // Mock the context to return isSendingMessage: true
      const { useAssistant } = await import("@/contexts/assistant-context");
      vi.mocked(useAssistant).mockReturnValue({
        sendMessage: vi.fn(),
        stopMessage: vi.fn(),
        isSendingMessage: true,
        isStoppingMessage: false,
        currentChatId: null,
        uiState: "closed",
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
        // Should show stop button instead of send button
        expect(screen.getByTitle("Stop")).toBeInTheDocument();
        expect(screen.queryByTitle("Send")).not.toBeInTheDocument();
      });
    });
  });
});
