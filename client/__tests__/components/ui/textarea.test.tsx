import { Textarea } from "@/components/ui/textarea";
import { render } from '@/test/custom-render';
import { screen } from '@/test/custom-render';
import { describe, expect, it } from "vitest";

// ——————————————————————————————————————————

describe("Textarea", () => {
  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      render(<Textarea />);

      expect(screen.getByRole("textbox")).toBeInTheDocument();
    });

    it("should have correct accessibility attributes", () => {
      render(<Textarea aria-label="Test Textarea" />);

      const textarea = screen.getByRole("textbox", { name: "Test Textarea" });
      expect(textarea).toBeInTheDocument();
    });
  });

  describe("Component Props", () => {
    it("should render with placeholder", () => {
      render(<Textarea placeholder="Enter text..." />);

      const textarea = screen.getByPlaceholderText("Enter text...");
      expect(textarea).toBeInTheDocument();
    });

    it("should render with value", () => {
      render(<Textarea value="test value" readOnly />);

      const textarea = screen.getByDisplayValue("test value");
      expect(textarea).toBeInTheDocument();
    });

    it("should render disabled when disabled prop is true", () => {
      render(<Textarea disabled />);

      const textarea = screen.getByRole("textbox");
      expect(textarea).toBeDisabled();
    });

    it("should render with custom className", () => {
      render(<Textarea className="custom-class" />);

      const textarea = screen.getByRole("textbox");
      expect(textarea).toHaveClass("custom-class");
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", () => {
      // Test with minimal props
      render(<Textarea />);

      const textarea = screen.getByRole("textbox");
      expect(textarea).toBeInTheDocument();
    });
  });
});
