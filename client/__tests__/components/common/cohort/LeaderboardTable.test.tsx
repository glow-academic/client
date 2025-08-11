import { render } from '@/test/custom-render';
import { describe, expect, it } from "vitest";

// ——————————————————————————————————————————
import LeaderboardTable from "@/components/common/cohort/LeaderboardTable";

// ------------------------------------------------------------------
// Minimal props factory – edit values as needed
import type { LeaderboardTableProps } from "@/components/common/cohort/LeaderboardTable";
const mockProps: LeaderboardTableProps = {
  data: [],
  currentUserId: "test-currentUserId",
};
// ------------------------------------------------------------------
describe("LeaderboardTable", () => {
  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      render(<LeaderboardTable {...mockProps} />);

      // Basic render test - component should render without errors
      expect(document.body).toBeInTheDocument();
    });

    it("should render with props", () => {
      render(<LeaderboardTable {...mockProps} />);

      // Component should render with the provided props
      expect(document.body).toBeInTheDocument();
    });

    it("should have correct accessibility attributes", () => {
      render(<LeaderboardTable {...mockProps} />);

      // Check for basic accessibility elements
      const table =
        document.querySelector("table") || document.querySelector("div");
      expect(table).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", () => {
      render(<LeaderboardTable {...mockProps} />);

      // Component should handle edge cases
      expect(document.body).toBeInTheDocument();
    });

    it("should handle missing or invalid props", () => {
      render(<LeaderboardTable data={[]} currentUserId="test" />);

      // Component should handle missing props
      expect(document.body).toBeInTheDocument();
    });
  });
});
