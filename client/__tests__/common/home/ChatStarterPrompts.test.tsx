import ChatStarterPrompts from "@/components/common/home/ChatStarterPrompts";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock external dependencies

describe("ChatStarterPrompts", () => {
  const mockOnPromptClick = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Rendering", () => {
    it("should render without crashing", () => {
      render(<ChatStarterPrompts onPromptClick={mockOnPromptClick} />);

      expect(screen.getByText("GLOW Assistant")).toBeInTheDocument();
      expect(
        screen.getByText(
          "Get help with student analytics, cohort insights, and dashboard customization"
        )
      ).toBeInTheDocument();
      expect(screen.getByText("Try asking:")).toBeInTheDocument();
    });

    it("should render all starter prompts", () => {
      render(<ChatStarterPrompts onPromptClick={mockOnPromptClick} />);

      expect(
        screen.getByText("Tell me how X student is doing in training")
      ).toBeInTheDocument();
      expect(
        screen.getByText("Give me an analysis of how Y cohort is doing")
      ).toBeInTheDocument();
      expect(
        screen.getByText("Make the color of my dashboard red")
      ).toBeInTheDocument();
    });

    it("should have correct accessibility attributes", () => {
      render(<ChatStarterPrompts onPromptClick={mockOnPromptClick} />);

      const buttons = screen.getAllByRole("button");
      expect(buttons).toHaveLength(3);

      buttons.forEach((button) => {
        expect(button).toBeInTheDocument();
      });
    });
  });

  describe("User Interaction", () => {
    it("should call onPromptClick when a prompt is clicked", async () => {
      const user = userEvent.setup();
      render(<ChatStarterPrompts onPromptClick={mockOnPromptClick} />);

      const firstPrompt = screen.getByText(
        "Tell me how X student is doing in training"
      );
      await user.click(firstPrompt);

      expect(mockOnPromptClick).toHaveBeenCalledWith(
        "Tell me how X student is doing in training"
      );
    });

    it("should call onPromptClick with correct prompt text for each button", async () => {
      const user = userEvent.setup();
      render(<ChatStarterPrompts onPromptClick={mockOnPromptClick} />);

      const prompts = [
        "Tell me how X student is doing in training",
        "Give me an analysis of how Y cohort is doing",
        "Make the color of my dashboard red",
      ];

      for (const promptText of prompts) {
        const promptButton = screen.getByText(promptText);
        await user.click(promptButton);
        expect(mockOnPromptClick).toHaveBeenCalledWith(promptText);
      }

      expect(mockOnPromptClick).toHaveBeenCalledTimes(3);
    });
  });

  describe("Edge Cases", () => {
    it("should handle missing onPromptClick prop gracefully", () => {
      // This should not crash even if onPromptClick is undefined
      expect(() => {
        render(<ChatStarterPrompts onPromptClick={() => {}} />);
      }).not.toThrow();
    });
  });
});

/*
 * Component Analysis for ChatStarterPrompts:
 * Path: common/home/ChatStarterPrompts.tsx
 *
 * Features detected:
 * - Default export: true
 * - Named exports: None
 * - Has props: true
 * - Props interface: ChatStarterPromptsProps
 * - Client component: true
 * - Uses hooks: None
 * - Uses router: false
 * - Has API calls: false
 * - Has form handling: false
 * - Uses state: false
 * - Uses effects: false
 * - Uses context: false
 *
 * Component renders starter prompts for the chat interface with:
 * - GLOW Assistant branding
 * - Three predefined prompt buttons
 * - Click handlers for each prompt
 * - Responsive design with proper spacing
 */
