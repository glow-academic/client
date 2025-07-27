import { Input } from "@/components/ui/input";
import { renderWithMocks } from "@/test/renderWithMocks";
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

// ——————————————————————————————————————————

describe("Input", () => {
  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      renderWithMocks(<Input />);

      expect(screen.getByRole("textbox")).toBeInTheDocument();
    });

    it("should have correct accessibility attributes", () => {
      renderWithMocks(<Input aria-label="Test Input" />);

      const input = screen.getByRole("textbox", { name: "Test Input" });
      expect(input).toBeInTheDocument();
    });
  });

  describe("Component Props", () => {
    it("should render with placeholder", () => {
      renderWithMocks(<Input placeholder="Enter text..." />);

      const input = screen.getByPlaceholderText("Enter text...");
      expect(input).toBeInTheDocument();
    });

    it("should render with value", () => {
      renderWithMocks(<Input value="test value" readOnly />);

      const input = screen.getByDisplayValue("test value");
      expect(input).toBeInTheDocument();
    });

    it("should render disabled when disabled prop is true", () => {
      renderWithMocks(<Input disabled />);

      const input = screen.getByRole("textbox");
      expect(input).toBeDisabled();
    });

    it("should render with different types", () => {
      renderWithMocks(<Input type="email" placeholder="Enter email" />);

      const input = screen.getByRole("textbox");
      expect(input).toHaveAttribute("type", "email");
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", () => {
      // Test with minimal props
      renderWithMocks(<Input />);

      const input = screen.getByRole("textbox");
      expect(input).toBeInTheDocument();
    });
  });
});
