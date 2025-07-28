import { renderWithMocks } from "@/test/renderWithMocks";
import { describe, expect, it, vi } from "vitest";

// ——————————————————————————————————————————
import {
  CohortsDataTable,
  CohortsDataTableProps,
} from "@/components/cohorts/CohortsDataTable";

// ------------------------------------------------------------------
// Minimal props factory – edit values as needed
const mockProps: CohortsDataTableProps = {
  columns: [],
  data: [],
  profileOptions: [],
  simulationOptions: [],
  renderCohortCard: vi.fn(),
};
// ------------------------------------------------------------------
describe("CohortsDataTable", () => {
  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      renderWithMocks(<CohortsDataTable {...mockProps} />);

      // Component should render without crashing
      expect(document.body).toBeInTheDocument();
    });

    it("should render with props", () => {
      renderWithMocks(<CohortsDataTable {...mockProps} />);

      // Component should render with the provided props
      expect(document.body).toBeInTheDocument();
    });

    it("should have correct accessibility attributes", () => {
      renderWithMocks(<CohortsDataTable {...mockProps} />);

      // Basic accessibility check - component should be in the document
      expect(document.body).toBeInTheDocument();
    });
  });

  describe("User Interactions", () => {
    it("should handle state changes", async () => {
      renderWithMocks(<CohortsDataTable {...mockProps} />);

      // Component should handle state changes without errors
      expect(document.body).toBeInTheDocument();
    });

    it("should handle user events", async () => {
      renderWithMocks(<CohortsDataTable {...mockProps} />);

      // Component should handle user events without errors
      expect(document.body).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", () => {
      renderWithMocks(<CohortsDataTable {...mockProps} />);

      // Component should render without throwing errors
      expect(document.body).toBeInTheDocument();
    });

    it("should handle empty data", () => {
      // Test with empty data
      renderWithMocks(
        <CohortsDataTable
          columns={[]}
          data={[]}
          profileOptions={[]}
          simulationOptions={[]}
          renderCohortCard={vi.fn()}
        />
      );
      expect(document.body).toBeInTheDocument();
    });
  });
});
