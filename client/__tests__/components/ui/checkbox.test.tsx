import { Checkbox } from "@/components/ui/checkbox";
import { render } from '@/test/custom-render';
import { screen } from '@/test/custom-render';
import { describe, expect, it } from "vitest";

// ——————————————————————————————————————————

describe("Checkbox", () => {
  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      render(<Checkbox />);

      expect(screen.getByRole("checkbox")).toBeInTheDocument();
    });

    it("should have correct accessibility attributes", () => {
      render(<Checkbox aria-label="Test Checkbox" />);

      const checkbox = screen.getByRole("checkbox", { name: "Test Checkbox" });
      expect(checkbox).toBeInTheDocument();
    });
  });

  describe("Component States", () => {
    it("should render unchecked by default", () => {
      render(<Checkbox />);

      const checkbox = screen.getByRole("checkbox");
      expect(checkbox).not.toBeChecked();
    });

    it("should render checked when checked prop is true", () => {
      render(<Checkbox checked />);

      const checkbox = screen.getByRole("checkbox");
      expect(checkbox).toBeChecked();
    });

    it("should render disabled when disabled prop is true", () => {
      render(<Checkbox disabled />);

      const checkbox = screen.getByRole("checkbox");
      expect(checkbox).toBeDisabled();
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", () => {
      // Test with minimal props
      render(<Checkbox />);

      const checkbox = screen.getByRole("checkbox");
      expect(checkbox).toBeInTheDocument();
    });
  });
});
