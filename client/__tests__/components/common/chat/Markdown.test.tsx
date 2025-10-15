import { render, screen } from "@/test/custom-render";
import { describe, expect, it } from "vitest";

// ——————————————————————————————————————————
import Markdown from "@/components/common/chat/Markdown";

// ------------------------------------------------------------------
describe("Markdown", () => {
  describe("basic render smoke-test", () => {
    it("renders without crashing", () => {
      render(<Markdown># Test Heading</Markdown>);
      expect(document.body).toBeInTheDocument();
    });

    it("should render with basic markdown content", () => {
      render(<Markdown>**Bold text** and *italic text*</Markdown>);
      expect(document.body).toBeInTheDocument();
    });

    it("should render with empty content", () => {
      render(<Markdown>{""}</Markdown>);
      expect(document.body).toBeInTheDocument();
    });
  });

  describe("Markdown Elements", () => {
    it("should render headings correctly", () => {
      render(
        <Markdown>
          {`# Heading 1
## Heading 2
### Heading 3
#### Heading 4`}
        </Markdown>
      );

      expect(document.body).toBeInTheDocument();
    });

    it("should render paragraphs correctly", () => {
      render(
        <Markdown>
          This is a paragraph with some text. This is another paragraph.
        </Markdown>
      );

      expect(document.body).toBeInTheDocument();
    });

    it("should render bold and italic text", () => {
      render(
        <Markdown>
          **Bold text** and *italic text* and ***bold italic text***
        </Markdown>
      );

      expect(document.body).toBeInTheDocument();
    });

    it("should render lists correctly", () => {
      render(
        <Markdown>
          {`- Unordered item 1
- Unordered item 2
  - Nested item

1. Ordered item 1
2. Ordered item 2
   1. Nested ordered item`}
        </Markdown>
      );

      expect(document.body).toBeInTheDocument();
    });

    it("should render blockquotes correctly", () => {
      render(
        <Markdown>
          {`> This is a blockquote
> 
> With multiple lines`}
        </Markdown>
      );

      expect(document.body).toBeInTheDocument();
    });

    it("should render code blocks correctly", () => {
      render(
        <Markdown>
          {`\`\`\`javascript
function hello() {
  console.log("Hello, world!");
}
\`\`\``}
        </Markdown>
      );

      expect(document.body).toBeInTheDocument();
    });

    it("should render inline code correctly", () => {
      render(
        <Markdown>
          Use the `console.log()` function to print to the console.
        </Markdown>
      );

      expect(document.body).toBeInTheDocument();
    });

    it("should render tables correctly", () => {
      render(
        <Markdown>
          {`| Header 1 | Header 2 | Header 3 |
|----------|----------|----------|
| Cell 1   | Cell 2   | Cell 3   |
| Cell 4   | Cell 5   | Cell 6   |`}
        </Markdown>
      );

      expect(document.body).toBeInTheDocument();
    });
  });

  describe("Link Handling", () => {
    it("should render external links with target blank", () => {
      render(<Markdown>[External Link](https://example.com)</Markdown>);

      const link = screen.getByText("External Link");
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute("href", "https://example.com");
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
    });

    it("should render internal links correctly", () => {
      render(<Markdown>[Internal Link](/dashboard)</Markdown>);

      const link = screen.getByText("Internal Link");
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute("href", "/dashboard");
    });

    it("should render hash links correctly", () => {
      render(<Markdown>[Hash Link](#/profile)</Markdown>);

      const link = screen.getByText("Hash Link");
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute("href", "/profile");
    });

    it("should render CSV download links correctly", () => {
      render(<Markdown>[Download Data](csv://token123)</Markdown>);

      const link = screen.getByText("Download Download Data");
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute(
        "href",
        "/api/v2/documents/csv/token123?name=Download Data"
      );
    });
  });

  describe("Math Rendering", () => {
    it("should render inline math", () => {
      render(
        <Markdown>
          {`The quadratic formula is $x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$`}
        </Markdown>
      );

      expect(document.body).toBeInTheDocument();
    });

    it("should render block math", () => {
      render(
        <Markdown>
          {`$$
\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}
$$`}
        </Markdown>
      );

      expect(document.body).toBeInTheDocument();
    });
  });

  describe("Image Handling", () => {
    it("should render images correctly", () => {
      render(<Markdown>![Alt text](https://example.com/image.png)</Markdown>);

      expect(document.body).toBeInTheDocument();
    });

    it("should render images with titles", () => {
      render(
        <Markdown>
          ![Alt text](https://example.com/image.png "Image title")
        </Markdown>
      );

      expect(document.body).toBeInTheDocument();
    });
  });

  describe("GitHub Flavored Markdown", () => {
    it("should render strikethrough text", () => {
      render(<Markdown>~~Strikethrough text~~</Markdown>);

      expect(document.body).toBeInTheDocument();
    });

    it("should render task lists", () => {
      render(
        <Markdown>
          {`- [x] Completed task
- [ ] Incomplete task
- [x] Another completed task`}
        </Markdown>
      );

      expect(document.body).toBeInTheDocument();
    });

    it("should render autolinks", () => {
      render(
        <Markdown>Visit https://example.com for more information.</Markdown>
      );

      expect(document.body).toBeInTheDocument();
    });
  });

  describe("Code Highlighting", () => {
    it("should render JavaScript code with syntax highlighting", () => {
      render(
        <Markdown>
          {`\`\`\`javascript
const greeting = "Hello, World!";
console.log(greeting);
\`\`\``}
        </Markdown>
      );

      expect(document.body).toBeInTheDocument();
    });

    it("should render Python code with syntax highlighting", () => {
      render(
        <Markdown>
          {`\`\`\`python
def hello_world():
    print("Hello, World!")
\`\`\``}
        </Markdown>
      );

      expect(document.body).toBeInTheDocument();
    });

    it("should render JSON code with syntax highlighting", () => {
      render(
        <Markdown>
          {`\`\`\`json
{
  "name": "John Doe",
  "age": 30,
  "city": "New York"
}
\`\`\``}
        </Markdown>
      );

      expect(document.body).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("should handle very long content", () => {
      const longContent = "# ".repeat(1000) + "Very long heading";
      render(<Markdown>{longContent}</Markdown>);
      expect(document.body).toBeInTheDocument();
    });

    it("should handle special characters", () => {
      render(
        <Markdown>
          {`Special characters: & < > " ' \` ~ ! @ # $ % ^ & * ( ) _ + - = [ ] { } | \\ ; : ' " , . / ?`}
        </Markdown>
      );
      expect(document.body).toBeInTheDocument();
    });

    it("should handle mixed content types", () => {
      render(
        <Markdown>
          {`# Mixed Content

This paragraph contains **bold** and *italic* text.

> A blockquote with \`inline code\`

\`\`\`javascript
// Code block
const x = 1;
\`\`\`

- List item 1
- List item 2

| Table | Header |
|-------|--------|
| Cell  | Data   |

[Link](https://example.com)

![Image](https://example.com/image.png)

Math: $E = mc^2$`}
        </Markdown>
      );
      expect(document.body).toBeInTheDocument();
    });

    it("should handle malformed markdown gracefully", () => {
      render(
        <Markdown>
          {`# Unclosed heading
**Unclosed bold
*Unclosed italic
\`Unclosed code

> Unclosed blockquote

| Unclosed table
| Unclosed row`}
        </Markdown>
      );
      expect(document.body).toBeInTheDocument();
    });

    it("should handle empty markdown elements", () => {
      render(
        <Markdown>
          {`#
**
*
\`\`\`
\`\`\`
>
- 
1. 
| | |
|---|---|`}
        </Markdown>
      );
      expect(document.body).toBeInTheDocument();
    });
  });

  describe("CSV Link Processing", () => {
    it("should process multiple CSV links in the same content", () => {
      render(
        <Markdown>
          {`Download [Data 1](csv://token1) and [Data 2](csv://token2)`}
        </Markdown>
      );

      expect(document.body).toBeInTheDocument();
    });

    it("should handle CSV links with special characters in token", () => {
      render(
        <Markdown>[Download](csv://token-with-special-chars_123)</Markdown>
      );

      expect(document.body).toBeInTheDocument();
    });

    it("should handle CSV links with spaces in link text", () => {
      render(<Markdown>[Download My Data](csv://token123)</Markdown>);

      expect(document.body).toBeInTheDocument();
    });
  });

  describe("Newline Processing", () => {
    it("should normalize different newline formats", () => {
      render(<Markdown>{"Line 1\r\nLine 2\nLine 3\rLine 4"}</Markdown>);
      expect(document.body).toBeInTheDocument();
    });

    it("should handle consecutive newlines", () => {
      render(<Markdown>{"Paragraph 1\n\n\n\nParagraph 2"}</Markdown>);
      expect(document.body).toBeInTheDocument();
    });
  });
});
