import { Input } from "@/components/ui/input";
import { render } from '@/test/custom-render';
import { screen } from '@/test/custom-render';
import { describe, expect, it } from "vitest";

// ——————————————————————————————————————————

describe("Input", () => {
  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      render(<Input />);

      expect(screen.getByRole("textbox")).toBeInTheDocument();
    });

    it("should have correct accessibility attributes", () => {
      render(<Input aria-label="Test Input" />);

      const input = screen.getByRole("textbox", { name: "Test Input" });
      expect(input).toBeInTheDocument();
    });
  });

  describe("Component Props", () => {
    it("should render with placeholder", () => {
      render(<Input placeholder="Enter text..." />);

      const input = screen.getByPlaceholderText("Enter text...");
      expect(input).toBeInTheDocument();
    });

    it("should render with value", () => {
      render(<Input value="test value" readOnly />);

      const input = screen.getByDisplayValue("test value");
      expect(input).toBeInTheDocument();
    });

    it("should render disabled when disabled prop is true", () => {
      render(<Input disabled />);

      const input = screen.getByRole("textbox");
      expect(input).toBeDisabled();
    });

    it("should render with different types", () => {
      render(<Input type="email" placeholder="Enter email" />);

      const input = screen.getByRole("textbox");
      expect(input).toHaveAttribute("type", "email");
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", () => {
      // Test with minimal props
      render(<Input />);

      const input = screen.getByRole("textbox");
      expect(input).toBeInTheDocument();
    });
  });
});
