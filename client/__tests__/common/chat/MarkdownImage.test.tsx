/**
 * tests/components/MarkdownImage.spec.tsx
 */
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeAll } from "vitest";

import MarkdownImage from "@/components/common/chat/MarkdownImage";
import Image, { ImageProps } from "next/image";

/* ------------------------------------------------------------------ */
/* one-time mock: next/image                                          */
/* ------------------------------------------------------------------ */
beforeAll(() => {
  vi.mock("next/image", () => ({
    //  tiny shim – Vitest already polyfills <img> so this is enough
    __esModule: true,
    default: (props: ImageProps) => <Image {...props} alt="test image" data-testid="img" />,
  }));
});

/* helper */
const renderImg = (p: Partial<Parameters<typeof MarkdownImage>[0]>) =>
  render(<MarkdownImage {...p} />);

describe("<MarkdownImage />", () => {
  it("returns null when no src", () => {
    const { container } = renderImg({ src: "" });
    expect(container.firstChild).toBeNull();
  });

  it("renders src + alt", () => {
    renderImg({ src: "/pic.png", alt: "alt text" });
    const img = screen.getByTestId("img");
    expect(img).toHaveAttribute("src", "/pic.png");
    expect(img).toHaveAttribute("alt", "alt text");
  });

  it("is responsive by default", () => {
    renderImg({ src: "/a.jpg", alt: "" });
    const img = screen.getByTestId("img");
    expect(img).toHaveAttribute("width", "0");
    expect(img).toHaveAttribute("height", "0");
    expect(img).toHaveAttribute("sizes", "100vw");
    expect(img).toHaveAttribute("unoptimized");
  });

  it("forwards extra props (className, data-*, …)", () => {
    renderImg({
      src: "/b.webp",
      alt: "",
      className: "rounded",
    });
    const img = screen.getByTestId("img");
    expect(img).toHaveClass("rounded");
  });

  it("allows overriding width / height", () => {
    renderImg({ src: "/c.bmp", alt: "", width: 99, height: 42 });
    const img = screen.getByTestId("img");
    expect(img).toHaveAttribute("width", "99");
    expect(img).toHaveAttribute("height", "42");
  });

  it("handles remote URLs", () => {
    const url = "https://cdn.example.com/img.jpg";
    renderImg({ src: url, alt: "" });
    expect(screen.getByTestId("img")).toHaveAttribute("src", url);
  });
});
