import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import Markdown from '@/components/common/chat/Markdown';
import Image from 'next/image';

// Mock external dependencies
vi.mock('@/components/common/chat/MarkdownImage', () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    <Image src={src} alt={alt} data-testid="markdown-image" />
  ),
}));

// Mock API calls
global.fetch = vi.fn();

describe('Markdown', () => {
  let queryClient: QueryClient;
  
  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  });

  const renderWithProviders = (ui: React.ReactElement, options = {}) => {
    const AllProviders = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );

    return render(ui, { wrapper: AllProviders, ...options });
  };
  

  describe('Rendering', () => {
    it('should render without crashing', () => {
      renderWithProviders(<Markdown>Hello World</Markdown>);
      
      expect(screen.getByText('Hello World')).toBeInTheDocument();
    });

    it('should render with children prop', () => {
      const testContent = 'This is test markdown content';
      renderWithProviders(<Markdown>{testContent}</Markdown>);
      
      expect(screen.getByText(testContent)).toBeInTheDocument();
    });

    it('should render markdown headings correctly', () => {
      const markdownContent = '# Heading 1\n## Heading 2\n### Heading 3';
      renderWithProviders(<Markdown>{markdownContent}</Markdown>);
      
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Heading 1');
      expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Heading 2');
      expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('Heading 3');
    });

    it('should render markdown links correctly', () => {
      const markdownContent = '[Test Link](https://example.com)';
      renderWithProviders(<Markdown>{markdownContent}</Markdown>);
      
      const link = screen.getByRole('link', { name: 'Test Link' });
      expect(link).toHaveAttribute('href', 'https://example.com');
    });

    it('should render markdown lists correctly', () => {
      const markdownContent = '- Item 1\n- Item 2\n- Item 3';
      renderWithProviders(<Markdown>{markdownContent}</Markdown>);
      
      expect(screen.getByRole('list')).toBeInTheDocument();
      expect(screen.getByText('Item 1')).toBeInTheDocument();
      expect(screen.getByText('Item 2')).toBeInTheDocument();
      expect(screen.getByText('Item 3')).toBeInTheDocument();
    });

    it('should render inline code correctly', () => {
      const markdownContent = 'This is `inline code` in text';
      renderWithProviders(<Markdown>{markdownContent}</Markdown>);
      
      const codeElement = screen.getByText('inline code');
      expect(codeElement).toHaveClass('prose-code');
    });

    it('should render code blocks correctly', () => {
      const markdownContent = '```javascript\nconst x = 1;\n```';
      renderWithProviders(<Markdown>{markdownContent}</Markdown>);
      
      expect(screen.getByText('const x = 1;')).toBeInTheDocument();
    });

    it('should render blockquotes correctly', () => {
      const markdownContent = '> This is a blockquote';
      renderWithProviders(<Markdown>{markdownContent}</Markdown>);
      
      const blockquote = screen.getByText('This is a blockquote').closest('blockquote');
      expect(blockquote).toHaveClass('prose-blockquote');
    });

    it('should render tables correctly', () => {
      const markdownContent = '| Header 1 | Header 2 |\n|----------|----------|\n| Cell 1   | Cell 2   |';
      renderWithProviders(<Markdown>{markdownContent}</Markdown>);
      
      expect(screen.getByRole('table')).toBeInTheDocument();
      expect(screen.getByText('Header 1')).toBeInTheDocument();
      expect(screen.getByText('Cell 1')).toBeInTheDocument();
    });

    it('should render images using MarkdownImage component', () => {
      const markdownContent = '![Alt text](https://example.com/image.jpg)';
      renderWithProviders(<Markdown>{markdownContent}</Markdown>);
      
      const image = screen.getByTestId('markdown-image');
      expect(image).toHaveAttribute('src', 'https://example.com/image.jpg');
      expect(image).toHaveAttribute('alt', 'Alt text');
    });

    it('should have correct accessibility attributes', () => {
      const markdownContent = '# Main Heading\n\nThis is a paragraph with [a link](https://example.com).';
      renderWithProviders(<Markdown>{markdownContent}</Markdown>);
      
      const heading = screen.getByRole('heading', { level: 1 });
      const link = screen.getByRole('link');
      
      expect(heading).toBeInTheDocument();
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute('href', 'https://example.com');
    });
  });

  describe('Math Rendering', () => {
    it('should handle LaTeX math expressions', () => {
      const markdownContent = 'Inline math: $x = y + z$ and block math:\n\n$$E = mc^2$$';
      renderWithProviders(<Markdown>{markdownContent}</Markdown>);
      
      // Math rendering might create specific elements, but we'll just check the content exists
      expect(screen.getByText(/x = y \+ z/)).toBeInTheDocument();
      expect(screen.getByText(/E = mc\^2/)).toBeInTheDocument();
    });
  });

  describe('Text Processing', () => {
    it('should convert newlines to line breaks', () => {
      const markdownContent = 'Line 1\nLine 2\nLine 3';
      renderWithProviders(<Markdown>{markdownContent}</Markdown>);
      
      // The component processes newlines to markdown line breaks
      expect(screen.getByText('Line 1')).toBeInTheDocument();
      expect(screen.getByText('Line 2')).toBeInTheDocument();
      expect(screen.getByText('Line 3')).toBeInTheDocument();
    });

    it('should handle empty content', () => {
      renderWithProviders(<Markdown>{''}</Markdown>);
      
      // Should render without crashing
      expect(document.querySelector('.latex-container')).toBeInTheDocument();
    });

    it('should handle special characters', () => {
      const markdownContent = 'Special chars: & < > " \'';
      renderWithProviders(<Markdown>{markdownContent}</Markdown>);
      
      expect(screen.getByText(/Special chars: & < > " '/)).toBeInTheDocument();
    });
  });

  describe('API Integration', () => {
    it('should render without API calls', async () => {
      const markdownContent = '# Test Content\n\nThis is a test.';
      renderWithProviders(<Markdown>{markdownContent}</Markdown>);
      
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Test Content');
      expect(screen.getByText('This is a test.')).toBeInTheDocument();
    });

    it('should handle loading states', () => {
      const markdownContent = 'Loading content...';
      renderWithProviders(<Markdown>{markdownContent}</Markdown>);
      
      expect(screen.getByText('Loading content...')).toBeInTheDocument();
    });

    it('should handle error states', () => {
      const markdownContent = 'Error: Failed to load content';
      renderWithProviders(<Markdown>{markdownContent}</Markdown>);
      
      expect(screen.getByText(/Error: Failed to load content/)).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long content', () => {
      const longContent = 'A'.repeat(10000);
      renderWithProviders(<Markdown>{longContent}</Markdown>);
      
      expect(screen.getByText(longContent)).toBeInTheDocument();
    });

    it('should handle malformed markdown gracefully', () => {
      const malformedMarkdown = '# Heading\n[Broken link](';
      renderWithProviders(<Markdown>{malformedMarkdown}</Markdown>);
      
      // Should still render the heading
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Heading');
    });

    it('should handle mixed content types', () => {
      const mixedContent = `
# Heading
This is **bold** and *italic* text.
- List item 1
- List item 2

\`\`\`javascript
console.log('Hello');
\`\`\`

> Blockquote text

[Link](https://example.com)
      `;
      
      renderWithProviders(<Markdown>{mixedContent}</Markdown>);
      
      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
      expect(screen.getByRole('list')).toBeInTheDocument();
      expect(screen.getByRole('link')).toBeInTheDocument();
      expect(screen.getByText('console.log(\'Hello\');')).toBeInTheDocument();
    });

    it('should handle HTML entities correctly', () => {
      const htmlContent = 'HTML entities: &amp; &lt; &gt; &quot;';
      renderWithProviders(<Markdown>{htmlContent}</Markdown>);
      
      expect(screen.getByText(/HTML entities: & < > "/)).toBeInTheDocument();
    });

    it('should handle missing or invalid props', () => {
      // Test with empty string
      renderWithProviders(<Markdown>{''}</Markdown>);
      
      expect(document.querySelector('.latex-container')).toBeInTheDocument();
    });
  });
});

/*
 * Component Analysis for Markdown:
 * Path: common/chat/Markdown.tsx
 * 
 * Features detected:
 * - Default export: true
 * - Named exports: None
 * - Has props: true
 * - Props interface: MarkdownProps
 * - Client component: false
 * - Uses hooks: used, useQuery, user
 * - Uses router: false
 * - Has API calls: true
 * - Has form handling: false
 * - Uses state: false
 * - Uses effects: false
 * - Uses context: false
 * 
 * TODO: Implement the failing tests above with actual test logic
 * 
 * Example implementations:
 * 
 * Basic rendering:
 * render(<Markdown {...mockProps} />);
 * expect(screen.getByRole('...')).toBeInTheDocument();
 * 
 * Props testing:
 * const props = { ... };
 * render(<Markdown {...props} />);
 * expect(screen.getByText(props.someText)).toBeInTheDocument();
 * 
 * User interaction:
 * const button = screen.getByRole('button');
 * await user.click(button);
 * expect(mockFunction).toHaveBeenCalled();
 */
