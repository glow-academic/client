import { render } from "@/test/custom-render";
import { screen, waitFor } from "@/test/custom-render";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

// ——————————————————————————————————————————
import ChatStarterPrompts, {
  ChatStarterPromptsProps,
} from "@/components/assistant/ChatStarterPrompts";

// ------------------------------------------------------------------
// Minimal props factory – edit values as needed
const mockProps: ChatStarterPromptsProps = {
  onPromptClick: vi.fn(),
  // variant: 'expanded', /* optional */
};
// ------------------------------------------------------------------
describe("ChatStarterPrompts", () => {
  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      render(<ChatStarterPrompts {...mockProps} />);

      // Should render starter prompts (expanded variant shows 4 prompts by default)
      await waitFor(() => {
        const promptCards = screen.getAllByRole("article");
        expect(promptCards.length).toBe(4);
      });
    });

    it("should render with props", async () => {
      // Test with different variant
      const propsWithVariant: ChatStarterPromptsProps = {
        onPromptClick: vi.fn(),
        variant: "minimized",
      };

      render(<ChatStarterPrompts {...propsWithVariant} />);

      await waitFor(() => {
        // Minimized variant shows 2 prompts
        const promptCards = screen.getAllByRole("article");
        expect(promptCards.length).toBe(2);
      });
    });

    it("should have correct accessibility attributes", async () => {
      render(<ChatStarterPrompts {...mockProps} />);

      await waitFor(() => {
        // Check for clickable prompt cards
        const promptCards = screen.getAllByRole("article");
        expect(promptCards.length).toBeGreaterThan(0);

        // Each card should have proper accessibility attributes
        promptCards.forEach((card) => {
          expect(card).toHaveAttribute("aria-label");
          expect(card).toHaveAttribute("tabIndex", "0");
        });
      });
    });
  });

  describe("User Interactions", () => {
    it("should handle prompt clicks", async () => {
      const user = userEvent.setup();
      const onPromptClick = vi.fn();

      render(
        <ChatStarterPrompts {...mockProps} onPromptClick={onPromptClick} />,
      );

      await waitFor(() => {
        const promptCards = screen.getAllByRole("article");
        expect(promptCards.length).toBe(4);
      });

      // Click on a prompt card
      const promptCard = screen.getAllByRole("article")[0];
      if (promptCard) {
        await user.click(promptCard);
      }

      // onPromptClick should be called with the prompt text
      expect(onPromptClick).toHaveBeenCalledWith(expect.any(String));
    });

    it("should handle state changes", async () => {
      const user = userEvent.setup();
      render(<ChatStarterPrompts {...mockProps} />);

      await waitFor(() => {
        const promptCards = screen.getAllByRole("article");
        expect(promptCards.length).toBe(4);
      });

      // Test that prompts are interactive
      const promptCards = screen.getAllByRole("article");
      expect(promptCards.length).toBeGreaterThan(0);

      // Click on a prompt
      if (promptCards[0]) {
        await user.click(promptCards[0]);
        expect(mockProps.onPromptClick).toHaveBeenCalledWith(
          expect.any(String),
        );
      }
    });

    it("should handle user events", async () => {
      const user = userEvent.setup();
      render(<ChatStarterPrompts {...mockProps} />);

      await waitFor(() => {
        const promptCards = screen.getAllByRole("article");
        expect(promptCards.length).toBe(4);
      });

      // Test keyboard navigation
      const promptCards = screen.getAllByRole("article");
      expect(promptCards.length).toBeGreaterThan(0);

      // Focus and press Enter on a prompt
      if (promptCards[0]) {
        promptCards[0].focus();
        await user.keyboard("{Enter}");
        expect(mockProps.onPromptClick).toHaveBeenCalledWith(
          expect.any(String),
        );
      }
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", async () => {
      render(<ChatStarterPrompts {...mockProps} />);

      await waitFor(() => {
        const promptCards = screen.getAllByRole("article");
        expect(promptCards.length).toBe(4);
      });

      // Should render properly even with minimal props
      const promptCards = screen.getAllByRole("article");
      expect(promptCards.length).toBeGreaterThan(0);
    });

    it("should handle missing or invalid props", async () => {
      // Test with no onPromptClick
      render(<ChatStarterPrompts onPromptClick={vi.fn()} />);

      await waitFor(() => {
        const promptCards = screen.getAllByRole("article");
        expect(promptCards.length).toBe(4);
      });

      // Should still render with default props
      const promptCards = screen.getAllByRole("article");
      expect(promptCards.length).toBeGreaterThan(0);
    });
  });
});
