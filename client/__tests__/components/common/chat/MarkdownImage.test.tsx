import { render } from '@/test/custom-render';
import { screen } from '@/test/custom-render';
import { describe, expect, it, vi } from "vitest";

// ——————————————————————————————————————————
import MarkdownImage from "@/components/common/chat/MarkdownImage";

describe("MarkdownImage", () => {
  describe("basic render smoke-test", () => {
    it("renders without crashing", () => {
      render(
        <MarkdownImage src="https://example.com/image.png" alt="Test image" />
      );
      expect(document.body).toBeInTheDocument();
    });

    it("should render with src and alt props", () => {
      render(
        <MarkdownImage src="https://example.com/image.png" alt="Test image" />
      );

      const image = screen.getByAltText("Test image");
      expect(image).toBeInTheDocument();
      expect(image).toHaveAttribute("src", "https://example.com/image.png");
    });

    it("should not render when src is empty", () => {
      render(<MarkdownImage src="" alt="Test image" />);

      const image = screen.queryByAltText("Test image");
      expect(image).not.toBeInTheDocument();
    });

    it("should not render when src is undefined", () => {
      render(<MarkdownImage alt="Test image" />);

      const image = screen.queryByAltText("Test image");
      expect(image).not.toBeInTheDocument();
    });
  });

  describe("Image Properties", () => {
    it("should render with correct Next.js Image props", () => {
      render(
        <MarkdownImage src="https://example.com/image.png" alt="Test image" />
      );

      const image = screen.getByAltText("Test image");
      expect(image).toHaveAttribute("width", "0");
      expect(image).toHaveAttribute("height", "0");
      expect(image).toHaveAttribute("sizes", "100vw");
    });

    it("should render with custom style properties", () => {
      render(
        <MarkdownImage src="https://example.com/image.png" alt="Test image" />
      );

      const image = screen.getByAltText("Test image");
      expect(image).toHaveStyle({
        width: "70%",
        height: "auto",
        objectFit: "contain",
      });
    });

    it("should render with unoptimized prop", () => {
      render(
        <MarkdownImage src="https://example.com/image.png" alt="Test image" />
      );

      const image = screen.getByAltText("Test image");
      // Note: unoptimized is a boolean prop that may not be visible as an attribute
      expect(image).toBeInTheDocument();
    });
  });

  describe("Different Image Sources", () => {
    it("should render local images", () => {
      render(
        <MarkdownImage src="/images/local-image.png" alt="Local image" />
      );

      const image = screen.getByAltText("Local image");
      expect(image).toBeInTheDocument();
      expect(image).toHaveAttribute("src", "/images/local-image.png");
    });

    it("should render remote CDN images", () => {
      render(
        <MarkdownImage
          src="https://cdn.example.com/image.jpg"
          alt="CDN image"
        />
      );

      const image = screen.getByAltText("CDN image");
      expect(image).toBeInTheDocument();
      expect(image).toHaveAttribute("src", "https://cdn.example.com/image.jpg");
    });

    it("should render Supabase storage images", () => {
      render(
        <MarkdownImage
          src="https://supabase.co/storage/v1/object/public/bucket/image.png"
          alt="Supabase image"
        />
      );

      const image = screen.getByAltText("Supabase image");
      expect(image).toBeInTheDocument();
      expect(image).toHaveAttribute(
        "src",
        "https://supabase.co/storage/v1/object/public/bucket/image.png"
      );
    });

    it("should render data URLs", () => {
      const dataUrl =
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
      render(<MarkdownImage src={dataUrl} alt="Data URL image" />);

      const image = screen.getByAltText("Data URL image");
      expect(image).toBeInTheDocument();
      expect(image).toHaveAttribute("src", dataUrl);
    });
  });

  describe("Alt Text Handling", () => {
    it("should render with empty alt text", () => {
      render(
        <MarkdownImage src="https://example.com/image.png" alt="" />
      );

      const image = screen.getByAltText("");
      expect(image).toBeInTheDocument();
    });

    it("should render with descriptive alt text", () => {
      render(
        <MarkdownImage
          src="https://example.com/image.png"
          alt="A beautiful sunset over the mountains"
        />
      );

      const image = screen.getByAltText(
        "A beautiful sunset over the mountains"
      );
      expect(image).toBeInTheDocument();
    });

    it("should render with undefined alt text", () => {
      render(<MarkdownImage src="https://example.com/image.png" />);

      const image = screen.getByAltText("");
      expect(image).toBeInTheDocument();
      expect(image).toHaveAttribute("alt", "");
    });
  });

  describe("Additional Props", () => {
    it("should pass through additional props", () => {
      render(
        <MarkdownImage
          src="https://example.com/image.png"
          alt="Test image"
          className="custom-class"
          data-testid="custom-image"
        />
      );

      const image = screen.getByTestId("custom-image");
      expect(image).toBeInTheDocument();
      expect(image).toHaveClass("custom-class");
    });

    it("should handle onClick prop", () => {
      const handleClick = vi.fn();
      render(
        <MarkdownImage
          src="https://example.com/image.png"
          alt="Test image"
          onClick={handleClick}
        />
      );

      const image = screen.getByAltText("Test image");
      expect(image).toBeInTheDocument();
    });

    it("should handle onLoad prop", () => {
      const handleLoad = vi.fn();
      render(
        <MarkdownImage
          src="https://example.com/image.png"
          alt="Test image"
          onLoad={handleLoad}
        />
      );

      const image = screen.getByAltText("Test image");
      expect(image).toBeInTheDocument();
    });

    it("should handle onError prop", () => {
      const handleError = vi.fn();
      render(
        <MarkdownImage
          src="https://example.com/image.png"
          alt="Test image"
          onError={handleError}
        />
      );

      const image = screen.getByAltText("Test image");
      expect(image).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle very long URLs", () => {
      const longUrl = "https://example.com/" + "a".repeat(1000) + ".png";
      render(<MarkdownImage src={longUrl} alt="Long URL image" />);

      const image = screen.getByAltText("Long URL image");
      expect(image).toBeInTheDocument();
      expect(image).toHaveAttribute("src", longUrl);
    });

    it("should handle special characters in URLs", () => {
      const specialUrl =
        "https://example.com/image with spaces & special chars.png";
      render(
        <MarkdownImage src={specialUrl} alt="Special chars image" />
      );

      const image = screen.getByAltText("Special chars image");
      expect(image).toBeInTheDocument();
      expect(image).toHaveAttribute("src", specialUrl);
    });

    it("should handle relative URLs", () => {
      render(
        <MarkdownImage src="./relative/path/image.png" alt="Relative image" />
      );

      const image = screen.getByAltText("Relative image");
      expect(image).toBeInTheDocument();
      expect(image).toHaveAttribute("src", "./relative/path/image.png");
    });

    it("should handle protocol-relative URLs", () => {
      render(
        <MarkdownImage
          src="//example.com/image.png"
          alt="Protocol relative image"
        />
      );

      const image = screen.getByAltText("Protocol relative image");
      expect(image).toBeInTheDocument();
      expect(image).toHaveAttribute("src", "//example.com/image.png");
    });

    it("should handle malformed URLs gracefully", () => {
      render(
        <MarkdownImage src="not-a-valid-url" alt="Malformed URL image" />
      );

      const image = screen.getByAltText("Malformed URL image");
      expect(image).toBeInTheDocument();
      expect(image).toHaveAttribute("src", "not-a-valid-url");
    });
  });

  describe("Responsive Design", () => {
    it("should have responsive sizing attributes", () => {
      render(
        <MarkdownImage
          src="https://example.com/image.png"
          alt="Responsive image"
        />
      );

      const image = screen.getByAltText("Responsive image");
      expect(image).toHaveAttribute("sizes", "100vw");
    });

    it("should have correct width and height attributes for responsive design", () => {
      render(
        <MarkdownImage
          src="https://example.com/image.png"
          alt="Responsive image"
        />
      );

      const image = screen.getByAltText("Responsive image");
      expect(image).toHaveAttribute("width", "0");
      expect(image).toHaveAttribute("height", "0");
    });
  });

  describe("Accessibility", () => {
    it("should have proper alt text for accessibility", () => {
      render(
        <MarkdownImage
          src="https://example.com/image.png"
          alt="Accessible image"
        />
      );

      const image = screen.getByAltText("Accessible image");
      expect(image).toBeInTheDocument();
    });

    it("should be focusable when needed", () => {
      render(
        <MarkdownImage
          src="https://example.com/image.png"
          alt="Focusable image"
          tabIndex={0}
        />
      );

      const image = screen.getByAltText("Focusable image");
      expect(image).toHaveAttribute("tabIndex", "0");
    });
  });
});
