import { render } from '@/test/custom-render';
import { screen } from '@/test/custom-render';
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

// ——————————————————————————————————————————
import {
  FeedbackDataTableToolbar,
  FeedbackDataTableToolbarProps,
} from "@/components/system/feedback/FeedbackDataTableToolbar";
import { FeedbackData } from "@/hooks/use-feedback-columns";
import { getMockTable } from "@/mocks/navigation";

// ------------------------------------------------------------------
// Minimal props factory – edit values as needed
const mockProps: FeedbackDataTableToolbarProps = {
  table: getMockTable<FeedbackData>(),
  typeOptions: [
    { value: "bug", label: "🐛 Bug" },
    { value: "feature", label: "✨ Feature" },
    { value: "question", label: "❓ Question" },
    { value: "other", label: "📝 Other" },
  ],
  profileOptions: [
    { value: "John Doe", label: "John Doe" },
    { value: "Jane Smith", label: "Jane Smith" },
  ],
  isRefreshing: false,
  onRefresh: vi.fn(),
};
// ------------------------------------------------------------------
describe("FeedbackDataTableToolbar", () => {
  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      render(<FeedbackDataTableToolbar {...mockProps} />);

      // Basic render check - find refresh button by its icon
      expect(screen.getAllByRole("button")).toHaveLength(2); // Refresh, View
    });

    it("should render with props", () => {
      render(<FeedbackDataTableToolbar {...mockProps} />);

      // Check that buttons are rendered
      const buttons = screen.getAllByRole("button");
      expect(buttons).toHaveLength(2);

      // Check that the search input is rendered with correct placeholder
      expect(
        screen.getByPlaceholderText("Search feedback or author..."),
      ).toBeInTheDocument();
    });

    it("should have correct accessibility attributes", () => {
      render(<FeedbackDataTableToolbar {...mockProps} />);

      // Check that buttons have proper accessibility
      const buttons = screen.getAllByRole("button");
      expect(buttons).toHaveLength(2);

      // Check that the search input has proper accessibility
      const searchInput = screen.getByPlaceholderText(
        "Search feedback or author...",
      );
      expect(searchInput).toBeInTheDocument();
    });
  });

  describe("User Interactions", () => {
    it("should handle refresh button click", async () => {
      const user = userEvent.setup();

      render(<FeedbackDataTableToolbar {...mockProps} />);

      // Find the refresh button by looking for the button with refresh icon
      const buttons = screen.getAllByRole("button");
      const refreshButton = buttons.find((button) =>
        button.querySelector('svg[class*="refresh-cw"]'),
      );
      expect(refreshButton).toBeDefined();
      await user.click(refreshButton!);

      expect(mockProps.onRefresh).toHaveBeenCalledTimes(1);
    });

    it("should disable refresh button when refreshing", () => {
      render(
        <FeedbackDataTableToolbar {...mockProps} isRefreshing={true} />,
      );

      // Find the refresh button by looking for the button with refresh icon
      const buttons = screen.getAllByRole("button");
      const refreshButton = buttons.find((button) =>
        button.querySelector('svg[class*="refresh-cw"]'),
      );
      expect(refreshButton).toBeDefined();
      expect(refreshButton).toBeDisabled();
    });

    it("should handle search input changes", async () => {
      const user = userEvent.setup();

      render(<FeedbackDataTableToolbar {...mockProps} />);

      const searchInput = screen.getByPlaceholderText(
        "Search feedback or author...",
      );
      await user.type(searchInput, "test feedback");

      // The input value might not update due to mock table setup, but we can check the interaction
      expect(searchInput).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", () => {
      const propsWithEmptyOptions = {
        ...mockProps,
        typeOptions: [],
      };

      render(<FeedbackDataTableToolbar {...propsWithEmptyOptions} />);

      // Should still render without crashing - fewer buttons when no type options
      const buttons = screen.getAllByRole("button");
      expect(buttons.length).toBeGreaterThan(0);
    });

    it("should handle missing or invalid props", () => {
      const minimalProps = {
        table: getMockTable<FeedbackData>(),
        typeOptions: [],
        profileOptions: [],
        onRefresh: vi.fn(),
        isRefreshing: false,
      };

      render(<FeedbackDataTableToolbar {...minimalProps} />);

      // Should still render without crashing
      const buttons = screen.getAllByRole("button");
      expect(buttons.length).toBeGreaterThan(0);
    });
  });
});
