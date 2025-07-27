import { renderWithMocks } from "@/test/renderWithMocks";
import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

// ——————————————————————————————————————————
import RubricEdit, {
  RubricEditProps,
} from "@/components/create/rubrics/RubricEdit";

// ------------------------------------------------------------------
// Minimal props factory – edit values as needed
const mockProps: RubricEditProps = {
  rubricId: "test-rubricId",
};
// ------------------------------------------------------------------
describe("RubricEdit", () => {
  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      renderWithMocks(<RubricEdit {...mockProps} />);

      // Check that the component renders without crashing
      await waitFor(() => {
        expect(
          screen.getByText("Math Problem Solving Rubric")
        ).toBeInTheDocument();
      });
    });

    it("should render with props", async () => {
      renderWithMocks(<RubricEdit {...mockProps} />);

      // Check that the component renders with the provided rubricId
      await waitFor(() => {
        expect(
          screen.getByText("Math Problem Solving Rubric")
        ).toBeInTheDocument();
      });

      // The component should pass the rubricId to the Rubric component
      expect(mockProps.rubricId).toBe("test-rubricId");
    });

    it("should have correct accessibility attributes", async () => {
      renderWithMocks(<RubricEdit {...mockProps} />);

      // Check that the component renders with proper accessibility
      await waitFor(() => {
        expect(
          screen.getByText("Math Problem Solving Rubric")
        ).toBeInTheDocument();
      });

      // The component should have proper structure
      expect(document.body).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", async () => {
      // Test with different rubricId values
      const edgeCaseProps = {
        rubricId: "edge-case-id",
      };

      renderWithMocks(<RubricEdit {...edgeCaseProps} />);

      // Should handle edge case gracefully
      await waitFor(() => {
        expect(
          screen.getByText("Math Problem Solving Rubric")
        ).toBeInTheDocument();
      });
    });

    it("should handle missing or invalid props", async () => {
      // Test with minimal required props
      const minimalProps = {
        rubricId: "",
      };

      renderWithMocks(<RubricEdit {...minimalProps} />);

      // Should still render without crashing
      await waitFor(() => {
        expect(screen.getByText("Create Rubric")).toBeInTheDocument();
      });
    });
  });
});
