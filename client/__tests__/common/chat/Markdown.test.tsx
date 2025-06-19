/**
 * tests/components/Markdown.spec.tsx
 */
import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import Markdown from "@/components/common/chat/Markdown";
import Image from "next/image";

/* ------------------------------------------------------------------ */
/* one-time mocks                                                     */
/* ------------------------------------------------------------------ */
vi.mock("@/components/common/chat/MarkdownImage", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    // next/image is mocked by Vitest automatically, here we just proxy
    // so that we can assert on data-testids easily.
    <Image src={src} alt={alt} data-testid="markdown-image" />
  ),
}));

/* If MD fetches remote images or files through fetch() you can keep   */
/* a global stub; for this component the default empty mock is fine.   */
global.fetch = vi.fn();

/* ------------------------------------------------------------------ */
/* helper – no react-query needed                                      */
/* ------------------------------------------------------------------ */
const renderMD = (md: string | React.ReactNode) =>
  render(<Markdown>{md as string}</Markdown>);

/* ------------------------------------------------------------------ */
/* specs                                                               */
/* ------------------------------------------------------------------ */
describe("<Markdown />", () => {
  it("renders basic text", () => {
    renderMD("Hello **world**");
    expect(screen.getByText("Hello world")).toBeInTheDocument();
  });

  it("supports headings, links and lists", () => {
    const md = `
# H1
[Doc](https://example.com)
- A
- B`;
    renderMD(md);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("H1");
    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "https://example.com"
    );
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("shows inline and block code", () => {
    renderMD("`inline`  \n```js\nconst x = 1;\n```");
    expect(screen.getByText("inline")).toHaveClass("prose-code");
    expect(screen.getByText("const x = 1;")).toBeInTheDocument();
  });

  it("renders tables", () => {
    renderMD("| A | B |\n| - | - |\n| 1 | 2 |");
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("passes images to <MarkdownImage />", () => {
    renderMD("![Alt](https://cdn/img.png)");
    const img = screen.getByTestId("markdown-image");
    expect(img).toHaveAttribute("src", "https://cdn/img.png");
    expect(img).toHaveAttribute("alt", "Alt");
  });

  it("handles math", () => {
    renderMD("Inline $x^2$ and $$E=mc^2$$");
    // KaTeX renders into <span class="katex"> – simplest check:
    expect(document.querySelectorAll(".katex").length).toBeGreaterThan(0);
  });

  it("does not crash on empty string", () => {
    renderMD("");
    expect(document.querySelector(".latex-container")).toBeInTheDocument();
  });

  it("renders very long input quickly", () => {
    const long = "A".repeat(5_000);
    renderMD(long);
    expect(screen.getByText(long)).toBeInTheDocument();
  });
});
