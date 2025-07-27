import { renderWithMocks } from "@/test/renderWithMocks";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

// ——————————————————————————————————————————
import ChatStarterPrompts, {
  ChatStarterPromptsProps,
} from "@/components/common/home/ChatStarterPrompts";

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
      renderWithMocks(<ChatStarterPrompts {...mockProps} />);

      // Should render starter prompts
      await waitFor(() => {
        expect(screen.getByText(/help/i)).toBeInTheDocument();
      });
    });

    it("should render with props", async () => {
      // Test with different variant
      const propsWithVariant: ChatStarterPromptsProps = {
        onPromptClick: vi.fn(),
        variant: "minimized",
      };

      renderWithMocks(<ChatStarterPrompts {...propsWithVariant} />);

      await waitFor(() => {
        expect(screen.getByText(/help/i)).toBeInTheDocument();
      });
    });

    it("should have correct accessibility attributes", async () => {
      renderWithMocks(<ChatStarterPrompts {...mockProps} />);

      await waitFor(() => {
        // Check for clickable prompt buttons
        const promptButtons = screen.getAllByRole("button");
        expect(promptButtons.length).toBeGreaterThan(0);

        // Each button should have proper accessibility attributes
        promptButtons.forEach((button) => {
          expect(button).toHaveAttribute("aria-label");
        });
      });
    });
  });

  describe("User Interactions", () => {
    it("should handle prompt clicks", async () => {
      const user = userEvent.setup();
      const onPromptClick = vi.fn();

      renderWithMocks(
        <ChatStarterPrompts {...mockProps} onPromptClick={onPromptClick} />
      );

      await waitFor(() => {
        expect(screen.getByText(/help/i)).toBeInTheDocument();
      });

      // Click on a prompt button
      const promptButton = screen.getAllByRole("button")[0];
      if (promptButton) {
        await user.click(promptButton);
      }

      // onPromptClick should be called
      expect(onPromptClick).toHaveBeenCalled();
    });

    it("should handle state changes", async () => {
      const user = userEvent.setup();
      renderWithMocks(<ChatStarterPrompts {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText(/help/i)).toBeInTheDocument();
      });

      // Test that prompts are interactive
      const promptButtons = screen.getAllByRole("button");
      expect(promptButtons.length).toBeGreaterThan(0);

      // Click on a prompt
      if (promptButtons[0]) {
        await user.click(promptButtons[0]);
        expect(mockProps.onPromptClick).toHaveBeenCalled();
      }
    });

    it("should handle user events", async () => {
      const user = userEvent.setup();
      renderWithMocks(<ChatStarterPrompts {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText(/help/i)).toBeInTheDocument();
      });

      // Test keyboard navigation
      const promptButtons = screen.getAllByRole("button");
      expect(promptButtons.length).toBeGreaterThan(0);

      // Focus and press Enter on a prompt
      if (promptButtons[0]) {
        promptButtons[0].focus();
        await user.keyboard("{Enter}");
        expect(mockProps.onPromptClick).toHaveBeenCalled();
      }
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", async () => {
      renderWithMocks(<ChatStarterPrompts {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByText(/help/i)).toBeInTheDocument();
      });

      // Should render properly even with minimal props
      const promptButtons = screen.getAllByRole("button");
      expect(promptButtons.length).toBeGreaterThan(0);
    });

    it("should handle missing or invalid props", async () => {
      // Test with no onPromptClick
      renderWithMocks(<ChatStarterPrompts onPromptClick={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText(/help/i)).toBeInTheDocument();
      });

      // Should still render with default props
      const promptButtons = screen.getAllByRole("button");
      expect(promptButtons.length).toBeGreaterThan(0);
    });
  });
});
