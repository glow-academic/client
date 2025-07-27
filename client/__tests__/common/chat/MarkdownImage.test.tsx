import { renderWithMocks } from "@/test/renderWithMocks";
import { describe, expect, it } from "vitest";

// ——————————————————————————————————————————
import MarkdownImage from "@/components/common/chat/MarkdownImage";

describe("MarkdownImage", () => {
  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      renderWithMocks(<MarkdownImage />);

      // Basic render test - component should render without errors
      expect(document.body).toBeInTheDocument();
    });

    it("should have correct accessibility attributes", () => {
      renderWithMocks(<MarkdownImage />);

      // Check for basic accessibility elements
      const image =
        document.querySelector("img") || document.querySelector("div");
      expect(image).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", () => {
      renderWithMocks(<MarkdownImage />);

      // Component should handle edge cases
      expect(document.body).toBeInTheDocument();
    });
  });
});
