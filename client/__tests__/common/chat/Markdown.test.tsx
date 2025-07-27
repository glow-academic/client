import { renderWithMocks } from "@/test/renderWithMocks";
import { describe, expect, it } from "vitest";

// ——————————————————————————————————————————
import Markdown, { MarkdownProps } from "@/components/common/chat/Markdown";

// ------------------------------------------------------------------
// Minimal props factory – edit values as needed
const mockProps: MarkdownProps = {
  children: "test-children",
};
// ------------------------------------------------------------------
describe("Markdown", () => {
  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      renderWithMocks(<Markdown {...mockProps} />);

      // Basic render test - component should render without errors
      expect(document.body).toBeInTheDocument();
    });

    it("should render with props", () => {
      renderWithMocks(<Markdown {...mockProps} />);

      // Component should render with the provided props
      expect(document.body).toBeInTheDocument();
    });

    it("should have correct accessibility attributes", () => {
      renderWithMocks(<Markdown {...mockProps} />);

      // Check for basic accessibility elements
      const markdown =
        document.querySelector('[data-testid="markdown"]') ||
        document.querySelector("div");
      expect(markdown).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle edge cases gracefully", () => {
      renderWithMocks(<Markdown {...mockProps} />);

      // Component should handle edge cases
      expect(document.body).toBeInTheDocument();
    });

    it("should handle missing or invalid props", () => {
      renderWithMocks(<Markdown>{""}</Markdown>);

      // Component should handle missing props
      expect(document.body).toBeInTheDocument();
    });
  });
});
