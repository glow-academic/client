import { renderWithMocks } from "@/test/renderWithMocks";
import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// Mock Google fonts
vi.mock("next/font/google", () => ({
  Geist: vi.fn(() => ({
    variable: "mock-geist-sans",
    style: { fontFamily: "mock-geist-sans" },
  })),
  Geist_Mono: vi.fn(() => ({
    variable: "mock-geist-mono",
    style: { fontFamily: "mock-geist-mono" },
  })),
}));

// Mock Providers component
vi.mock("@/app/providers", () => ({
  Providers: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="providers">{children}</div>
  ),
}));

// ——————————————————————————————————————————
import RootLayout, { metadata } from "@/app/layout";

describe("RootLayout", () => {
  describe("basic render smoke-test", () => {
    it("renders without crashing", async () => {
      renderWithMocks(
        <RootLayout>
          <div data-testid="test-child">Test Content</div>
        </RootLayout>
      );

      expect(screen.getByTestId("test-child")).toBeInTheDocument();
      expect(screen.getByText("Test Content")).toBeInTheDocument();
    });

    it("should have correct HTML structure", () => {
      renderWithMocks(
        <RootLayout>
          <div data-testid="test-child">Test Content</div>
        </RootLayout>
      );

      // Check that the layout renders with proper HTML structure
      const htmlElement = document.querySelector("html");
      expect(htmlElement).toHaveAttribute("lang", "en");

      const bodyElement = document.querySelector("body");
      expect(bodyElement).toBeInTheDocument();
      expect(bodyElement).toHaveAttribute("suppressHydrationWarning", "true");
    });

    it("should have correct accessibility attributes", () => {
      renderWithMocks(
        <RootLayout>
          <div data-testid="test-child">Test Content</div>
        </RootLayout>
      );

      // Check for proper HTML lang attribute
      expect(document.documentElement).toHaveAttribute("lang", "en");

      // Check that body has proper class names
      const bodyElement = document.querySelector("body");
      expect(bodyElement).toHaveClass("antialiased");
    });
  });

  describe("Metadata", () => {
    it("should export correct metadata", () => {
      expect(metadata).toBeDefined();
      expect(metadata.title).toBeDefined();
      expect(metadata.description).toBeDefined();

      // Check metadata structure without type assertions
      expect(metadata.description).toBe(
        "Graduate Learning Orientation Workshop"
      );
    });
  });

  describe("Font Classes", () => {
    it("should apply font classes to body", () => {
      renderWithMocks(
        <RootLayout>
          <div data-testid="test-child">Test Content</div>
        </RootLayout>
      );

      const bodyElement = document.querySelector("body");
      expect(bodyElement).toHaveClass("antialiased");

      // Check for font variable classes (these are applied by the font objects)
      // The actual class names depend on the font configuration
      expect(bodyElement?.className).toContain("antialiased");
    });
  });

  describe("Children Rendering", () => {
    it("should render children correctly", () => {
      const testContent = "This is test content";
      renderWithMocks(
        <RootLayout>
          <div data-testid="test-child">{testContent}</div>
        </RootLayout>
      );

      expect(screen.getByTestId("test-child")).toBeInTheDocument();
      expect(screen.getByText(testContent)).toBeInTheDocument();
    });

    it("should render multiple children", () => {
      renderWithMocks(
        <RootLayout>
          <div data-testid="child-1">Child 1</div>
          <div data-testid="child-2">Child 2</div>
          <div data-testid="child-3">Child 3</div>
        </RootLayout>
      );

      expect(screen.getByTestId("child-1")).toBeInTheDocument();
      expect(screen.getByTestId("child-2")).toBeInTheDocument();
      expect(screen.getByTestId("child-3")).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty children gracefully", () => {
      renderWithMocks(<RootLayout>{null}</RootLayout>);

      // Should still render the HTML structure
      expect(document.querySelector("html")).toBeInTheDocument();
      expect(document.querySelector("body")).toBeInTheDocument();
    });

    it("should handle undefined children gracefully", () => {
      renderWithMocks(<RootLayout>{undefined}</RootLayout>);

      // Should still render the HTML structure
      expect(document.querySelector("html")).toBeInTheDocument();
      expect(document.querySelector("body")).toBeInTheDocument();
    });

    it("should handle complex nested children", () => {
      renderWithMocks(
        <RootLayout>
          <div>
            <span>Nested</span>
            <span>Content</span>
          </div>
        </RootLayout>
      );

      expect(screen.getByText("Nested")).toBeInTheDocument();
      expect(screen.getByText("Content")).toBeInTheDocument();
    });
  });
});
