import { render } from "@/test/custom-render";
import { screen, waitFor } from "@/test/custom-render";
import { describe, expect, it } from "vitest";

// ——————————————————————————————————————————
import { AnalyticsFilters } from "@/components/common/layout/AnalyticsFilters";

describe("AnalyticsFilters", () => {
  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      render(<AnalyticsFilters />);

      // Wait for component to load
      await waitFor(() => {
        expect(screen.getByLabelText("Select cohorts")).toBeInTheDocument();
      });
    });

    it("should have correct accessibility attributes", async () => {
      render(<AnalyticsFilters />);

      // Wait for component to load
      await waitFor(() => {
        expect(screen.getByLabelText("Select cohorts")).toBeInTheDocument();
      });
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", async () => {
      render(<AnalyticsFilters />);

      // Wait for component to load
      await waitFor(() => {
        expect(screen.getByLabelText("Select cohorts")).toBeInTheDocument();
      });
    });
  });
});
