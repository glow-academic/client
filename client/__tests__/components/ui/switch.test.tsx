import { Switch } from "@/components/ui/switch";
import { render } from '@/test/custom-render';
import { screen } from '@/test/custom-render';
import { describe, expect, it } from "vitest";

// ——————————————————————————————————————————

describe("Switch", () => {
  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      render(<Switch />);

      expect(screen.getByRole("switch")).toBeInTheDocument();
    });

    it("should have correct accessibility attributes", () => {
      render(<Switch aria-label="Test Switch" />);

      const switchElement = screen.getByRole("switch", { name: "Test Switch" });
      expect(switchElement).toBeInTheDocument();
    });
  });

  describe("Component States", () => {
    it("should render unchecked by default", () => {
      render(<Switch />);

      const switchElement = screen.getByRole("switch");
      expect(switchElement).not.toBeChecked();
    });

    it("should render checked when checked prop is true", () => {
      render(<Switch checked />);

      const switchElement = screen.getByRole("switch");
      expect(switchElement).toBeChecked();
    });

    it("should render disabled when disabled prop is true", () => {
      render(<Switch disabled />);

      const switchElement = screen.getByRole("switch");
      expect(switchElement).toBeDisabled();
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", () => {
      // Test with minimal props
      render(<Switch />);

      const switchElement = screen.getByRole("switch");
      expect(switchElement).toBeInTheDocument();
    });
  });
});
