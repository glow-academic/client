import { renderWithMocks } from "@/test/renderWithMocks";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

// ——————————————————————————————————————————
import ChatInput, { ChatInputProps } from "@/components/common/home/ChatInput";

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
        expect(textarea).toBeInTheDocument();
        expect(textarea).toHaveAttribute("placeholder");

        const sendButton = screen.getByRole("button", { name: /send/i });
        expect(sendButton).toBeInTheDocument();
        expect(sendButton).toHaveAttribute("title");
      });
    });
  });

  describe("User Interactions", () => {
    it("should handle form submissions", async () => {
      const user = userEvent.setup();
      renderWithMocks(<ChatInput {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByRole("form")).toBeInTheDocument();
      });

      const textarea = screen.getByRole("textbox");
      const sendButton = screen.getByRole("button", { name: /send/i });

      // Type a message
      await user.type(textarea, "Hello, world!");
      expect(textarea).toHaveValue("Hello, world!");

      // Submit the form
      await user.click(sendButton);

      // The message should be sent and textarea cleared
      expect(textarea).toHaveValue("");
    });

    it("should handle state changes", async () => {
      const user = userEvent.setup();
      const togglePrompt = vi.fn();

      renderWithMocks(<ChatInput {...mockProps} togglePrompt={togglePrompt} />);

      await waitFor(() => {
        expect(screen.getByRole("form")).toBeInTheDocument();
      });

      const textarea = screen.getByRole("textbox");

      // Type a message
      await user.type(textarea, "Test message");

      // togglePrompt should be called when message changes
      expect(togglePrompt).toHaveBeenCalledWith(false);

      // Clear the message
      await user.clear(textarea);

      // togglePrompt should be called again
      expect(togglePrompt).toHaveBeenCalledWith(true);
    });

    it("should handle user events", async () => {
      const user = userEvent.setup();
      renderWithMocks(<ChatInput {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByRole("form")).toBeInTheDocument();
      });

      const textarea = screen.getByRole("textbox");

      // Test typing
      await user.type(textarea, "Test message");
      expect(textarea).toHaveValue("Test message");

      // Test Enter key submission
      await user.keyboard("{Enter}");
      expect(textarea).toHaveValue("");
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", async () => {
      renderWithMocks(<ChatInput {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByRole("form")).toBeInTheDocument();
      });

      const textarea = screen.getByRole("textbox");
      const sendButton = screen.getByRole("button", { name: /send/i });

      // Send button should be disabled when textarea is empty
      expect(sendButton).toBeDisabled();

      // Type whitespace only
      await userEvent.type(textarea, "   ");
      expect(sendButton).toBeDisabled();
    });

    it("should handle missing or invalid props", async () => {
      // Test with no props
      renderWithMocks(<ChatInput />);

      await waitFor(() => {
        expect(screen.getByRole("form")).toBeInTheDocument();
      });

      // Should render with default placeholder
      const textarea = screen.getByRole("textbox");
      expect(textarea).toHaveAttribute(
        "placeholder",
        "Start a conversation..."
      );
    });
  });
});
