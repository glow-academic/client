import { Textarea } from "@/components/ui/textarea";
import { renderWithMocks } from "@/test/renderWithMocks";
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

// ——————————————————————————————————————————

describe("Textarea", () => {
  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      renderWithMocks(<Textarea />);

      expect(screen.getByRole("textbox")).toBeInTheDocument();
    });

    it("should have correct accessibility attributes", () => {
      renderWithMocks(<Textarea aria-label="Test Textarea" />);

      const textarea = screen.getByRole("textbox", { name: "Test Textarea" });
      expect(textarea).toBeInTheDocument();
    });
  });

  describe("Component Props", () => {
    it("should render with placeholder", () => {
      renderWithMocks(<Textarea placeholder="Enter text..." />);

      const textarea = screen.getByPlaceholderText("Enter text...");
      expect(textarea).toBeInTheDocument();
    });

    it("should render with value", () => {
      renderWithMocks(<Textarea value="test value" readOnly />);

      const textarea = screen.getByDisplayValue("test value");
      expect(textarea).toBeInTheDocument();
    });

    it("should render disabled when disabled prop is true", () => {
      renderWithMocks(<Textarea disabled />);

      const textarea = screen.getByRole("textbox");
      expect(textarea).toBeDisabled();
    });

    it("should render with custom className", () => {
      renderWithMocks(<Textarea className="custom-class" />);

      const textarea = screen.getByRole("textbox");
      expect(textarea).toHaveClass("custom-class");
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", () => {
      // Test with minimal props
      renderWithMocks(<Textarea />);

      const textarea = screen.getByRole("textbox");
      expect(textarea).toBeInTheDocument();
    });
  });
});
