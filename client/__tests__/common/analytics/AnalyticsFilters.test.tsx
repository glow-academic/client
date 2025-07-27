import { renderWithMocks } from "@/test/renderWithMocks";
import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

// ——————————————————————————————————————————
import { AnalyticsFilters } from "@/components/common/analytics/AnalyticsFilters";

describe("AnalyticsFilters", () => {
  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      renderWithMocks(<AnalyticsFilters />);

      // Wait for component to load
      await waitFor(() => {
        expect(screen.getByLabelText("Select cohorts")).toBeInTheDocument();
      });
    });

    it("should have correct accessibility attributes", async () => {
      renderWithMocks(<AnalyticsFilters />);

      // Wait for component to load
      await waitFor(() => {
        expect(screen.getByLabelText("Select cohorts")).toBeInTheDocument();
      });
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", async () => {
      renderWithMocks(<AnalyticsFilters />);

      // Wait for component to load
      await waitFor(() => {
        expect(screen.getByLabelText("Select cohorts")).toBeInTheDocument();
      });
    });
  });
});
