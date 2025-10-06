import { Button } from "@/components/ui/button";
import { render } from "@/test/custom-render";
import { screen } from "@/test/custom-render";
import { describe, expect, it } from "vitest";

// ——————————————————————————————————————————

describe("Button", () => {
  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      render(<Button>Test Button</Button>);

      expect(
        screen.getByRole("button", { name: "Test Button" }),
      ).toBeInTheDocument();
    });

    it("should have correct accessibility attributes", () => {
      render(<Button>Accessible Button</Button>);

      const button = screen.getByRole("button", { name: "Accessible Button" });
      expect(button).toBeInTheDocument();
      expect(button).toHaveAttribute("data-slot", "button");
    });
  });

  describe("Component Variants", () => {
    it("should render with default variant", () => {
      render(<Button>Default Button</Button>);

      const button = screen.getByRole("button", { name: "Default Button" });
      expect(button).toBeInTheDocument();
    });

    it("should render with secondary variant", () => {
      render(<Button variant="secondary">Secondary Button</Button>);

      const button = screen.getByRole("button", { name: "Secondary Button" });
      expect(button).toBeInTheDocument();
    });

    it("should render with destructive variant", () => {
      render(<Button variant="destructive">Destructive Button</Button>);

      const button = screen.getByRole("button", { name: "Destructive Button" });
      expect(button).toBeInTheDocument();
    });

    it("should render with outline variant", () => {
      render(<Button variant="outline">Outline Button</Button>);

      const button = screen.getByRole("button", { name: "Outline Button" });
      expect(button).toBeInTheDocument();
    });

    it("should render with ghost variant", () => {
      render(<Button variant="ghost">Ghost Button</Button>);

      const button = screen.getByRole("button", { name: "Ghost Button" });
      expect(button).toBeInTheDocument();
    });

    it("should render with link variant", () => {
      render(<Button variant="link">Link Button</Button>);

      const button = screen.getByRole("button", { name: "Link Button" });
      expect(button).toBeInTheDocument();
    });
  });

  describe("Component Sizes", () => {
    it("should render with default size", () => {
      render(<Button>Default Size</Button>);

      const button = screen.getByRole("button", { name: "Default Size" });
      expect(button).toBeInTheDocument();
    });

    it("should render with small size", () => {
      render(<Button size="sm">Small Button</Button>);

      const button = screen.getByRole("button", { name: "Small Button" });
      expect(button).toBeInTheDocument();
    });

    it("should render with large size", () => {
      render(<Button size="lg">Large Button</Button>);

      const button = screen.getByRole("button", { name: "Large Button" });
      expect(button).toBeInTheDocument();
    });

    it("should render with icon size", () => {
      render(<Button size="icon">Icon Button</Button>);

      const button = screen.getByRole("button", { name: "Icon Button" });
      expect(button).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", () => {
      // Test with disabled state
      render(<Button disabled>Disabled Button</Button>);

      const button = screen.getByRole("button", { name: "Disabled Button" });
      expect(button).toBeInTheDocument();
      expect(button).toBeDisabled();
    });

    it("should handle asChild prop", () => {
      render(
        <Button asChild>
          <a href="/test">Link Button</a>
        </Button>,
      );

      const link = screen.getByRole("link", { name: "Link Button" });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute("href", "/test");
    });
  });
});
