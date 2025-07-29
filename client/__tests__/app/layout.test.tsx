import { render, screen } from "@testing-library/react";
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

// Mock Providers component with a simpler implementation
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
      render(
        <RootLayout>
          <div data-testid="test-child">Test Content</div>
        </RootLayout>
      );

      // The providers wrapper should be present
      expect(screen.getByTestId("providers")).toBeInTheDocument();
      expect(screen.getByTestId("test-child")).toBeInTheDocument();
      expect(screen.getByText("Test Content")).toBeInTheDocument();
    });

    it("should have correct HTML structure", () => {
      render(
        <RootLayout>
          <div data-testid="test-child">Test Content</div>
        </RootLayout>
      );

      // Check that the layout renders with proper HTML structure
      const htmlElement = document.querySelector("html");
      expect(htmlElement).toHaveAttribute("lang", "en");

      const bodyElement = document.querySelector("body");
      expect(bodyElement).toBeInTheDocument();
      // Note: suppressHydrationWarning is not applied in test environment
    });

    it("should have correct accessibility attributes", () => {
      render(
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

  describe("Children Rendering", () => {
    it("should render children correctly", () => {
      const testContent = "Custom Test Content";
      render(
        <RootLayout>
          <div data-testid="test-child">{testContent}</div>
        </RootLayout>
      );

      expect(screen.getByTestId("test-child")).toBeInTheDocument();
      expect(screen.getByText(testContent)).toBeInTheDocument();
    });

    it("should render multiple children", () => {
      render(
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

    it("should handle complex nested children", () => {
      render(
        <RootLayout>
          <div>
            <span>Nested</span>
            <div>
              <p>Deep</p>
            </div>
          </div>
        </RootLayout>
      );

      expect(screen.getByText("Nested")).toBeInTheDocument();
      expect(screen.getByText("Deep")).toBeInTheDocument();
    });
  });

  describe("Metadata", () => {
    it("should export correct metadata", () => {
      expect(metadata.title).toBeDefined();
      expect(metadata.description).toBeDefined();
    });
  });

  describe("Font Classes", () => {
    it("should apply font classes to body", () => {
      render(
        <RootLayout>
          <div>Test</div>
        </RootLayout>
      );

      const bodyElement = document.querySelector("body");
      expect(bodyElement).toHaveClass("mock-geist-sans");
      expect(bodyElement).toHaveClass("mock-geist-mono");
    });
  });
});
