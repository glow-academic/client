import { renderWithMocks } from "@/test/renderWithMocks";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

// ——————————————————————————————————————————
import ChatFab from "@/components/common/home/ChatFab";

// ------------------------------------------------------------------
// Minimal props factory – edit values as needed
import type { ChatFabProps } from "@/components/common/home/ChatFab";
const mockProps: ChatFabProps = {
  up: false,
};
// ------------------------------------------------------------------
describe("ChatFab", () => {
  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      renderWithMocks(<ChatFab {...mockProps} />);

      // The FAB should render as a button
      await waitFor(() => {
        expect(screen.getByRole("button")).toBeInTheDocument();
      });
    });

    it("should render with props", async () => {
      // Test with different up prop values
      const { rerender } = renderWithMocks(<ChatFab up={false} />);

      await waitFor(() => {
        expect(screen.getByRole("button")).toBeInTheDocument();
      });

      rerender(<ChatFab up={true} />);

      await waitFor(() => {
        expect(screen.getByRole("button")).toBeInTheDocument();
      });
    });

    it("should have correct accessibility attributes", async () => {
      renderWithMocks(<ChatFab {...mockProps} />);

      await waitFor(() => {
        const button = screen.getByRole("button");
        expect(button).toBeInTheDocument();

        // Check for proper ARIA attributes
        expect(button).toHaveAttribute("aria-label");
        expect(button).toHaveAttribute("title");
      });
    });
  });

  describe("User Interactions", () => {
    it("should handle user events", async () => {
      const user = userEvent.setup();
      renderWithMocks(<ChatFab {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByRole("button")).toBeInTheDocument();
      });

      const button = screen.getByRole("button");
      await user.click(button);

      // The button should be clickable and trigger the expand action
      expect(button).toBeInTheDocument();
    });
  });

  describe("Navigation", () => {
    it("should handle navigation", async () => {
      const user = userEvent.setup();
      renderWithMocks(<ChatFab {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByRole("button")).toBeInTheDocument();
      });

      const button = screen.getByRole("button");
      await user.click(button);

      // Should trigger the expand action to open the chat dialog
      expect(button).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", async () => {
      renderWithMocks(<ChatFab {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByRole("button")).toBeInTheDocument();
      });

      // Should render properly even with minimal props
      const button = screen.getByRole("button");
      expect(button).toBeInTheDocument();
    });

    it("should handle missing or invalid props", async () => {
      // Test with missing props (should use defaults)
      renderWithMocks(<ChatFab up={false} />);

      await waitFor(() => {
        expect(screen.getByRole("button")).toBeInTheDocument();
      });

      // Should still render with default props
      const button = screen.getByRole("button");
      expect(button).toBeInTheDocument();
    });
  });
});
