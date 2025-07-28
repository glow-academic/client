import { Checkbox } from "@/components/ui/checkbox";
import { renderWithMocks } from "@/test/renderWithMocks";
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

// ——————————————————————————————————————————

describe("Checkbox", () => {
  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      renderWithMocks(<Checkbox />);

      expect(screen.getByRole("checkbox")).toBeInTheDocument();
    });

    it("should have correct accessibility attributes", () => {
      renderWithMocks(<Checkbox aria-label="Test Checkbox" />);

      const checkbox = screen.getByRole("checkbox", { name: "Test Checkbox" });
      expect(checkbox).toBeInTheDocument();
    });
  });

  describe("Component States", () => {
    it("should render unchecked by default", () => {
      renderWithMocks(<Checkbox />);

      const checkbox = screen.getByRole("checkbox");
      expect(checkbox).not.toBeChecked();
    });

    it("should render checked when checked prop is true", () => {
      renderWithMocks(<Checkbox checked />);

      const checkbox = screen.getByRole("checkbox");
      expect(checkbox).toBeChecked();
    });

    it("should render disabled when disabled prop is true", () => {
      renderWithMocks(<Checkbox disabled />);

      const checkbox = screen.getByRole("checkbox");
      expect(checkbox).toBeDisabled();
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", () => {
      // Test with minimal props
      renderWithMocks(<Checkbox />);

      const checkbox = screen.getByRole("checkbox");
      expect(checkbox).toBeInTheDocument();
    });
  });
});
