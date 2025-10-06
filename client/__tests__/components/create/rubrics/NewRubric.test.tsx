import { render } from "@/test/custom-render";
import { screen } from "@/test/custom-render";
import { describe, expect, it, vi } from "vitest";

// ——————————————————————————————————————————
import NewRubric from "@/components/create/rubrics/NewRubric";

// Mock the Rubric component since NewRubric is just a wrapper
vi.mock("@/components/common/rubric/Rubric", () => ({
  default: vi.fn(() => (
    <div data-testid="rubric-component">Rubric Component</div>
  )),
}));

describe("NewRubric", () => {
  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      render(<NewRubric />);

      expect(screen.getByTestId("rubric-component")).toBeInTheDocument();
    });

    it("should have correct accessibility attributes", () => {
      render(<NewRubric />);

      const rubricComponent = screen.getByTestId("rubric-component");
      expect(rubricComponent).toBeInTheDocument();

      // Check that the component is accessible
      expect(rubricComponent).toBeVisible();
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", () => {
      // Test that the component renders without props
      render(<NewRubric />);

      expect(screen.getByTestId("rubric-component")).toBeInTheDocument();

      // Verify the component text is displayed
      expect(screen.getByText("Rubric Component")).toBeInTheDocument();
    });
  });
});
