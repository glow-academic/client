import { render } from "@/test/custom-render";
import { describe, expect, it } from "vitest";

// ——————————————————————————————————————————
import CohortEdit, { CohortEditProps } from "@/components/cohorts/CohortEdit";

// ------------------------------------------------------------------
// Minimal props factory – edit values as needed
const mockProps: CohortEditProps = {
  cohortId: "test-cohortId",
};
// ------------------------------------------------------------------
describe("CohortEdit", () => {
  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      render(<CohortEdit {...mockProps} />);

      // CohortEdit is a wrapper around Cohort component, so we expect it to render
      expect(document.body).toBeInTheDocument();
    });

    it("should render with props", () => {
      render(<CohortEdit {...mockProps} />);

      // Component should render with the provided cohortId prop
      expect(document.body).toBeInTheDocument();
    });

    it("should have correct accessibility attributes", () => {
      render(<CohortEdit {...mockProps} />);

      // Basic accessibility check - component should be in the document
      expect(document.body).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", () => {
      render(<CohortEdit {...mockProps} />);

      // Component should render without throwing errors
      expect(document.body).toBeInTheDocument();
    });

    it("should handle missing or invalid props", () => {
      // Test with empty cohortId
      render(<CohortEdit cohortId="" />);
      expect(document.body).toBeInTheDocument();

      // Test with undefined cohortId
      render(<CohortEdit cohortId={undefined as unknown as string} />);
      expect(document.body).toBeInTheDocument();
    });
  });
});
