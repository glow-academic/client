"use client";
import { useEffect, useState } from "react";

export interface MarkdownRendererProps {
  content: string;
}

export default function MarkdownRenderer({ content }: MarkdownRendererProps) {
  const [renderedContent, setRenderedContent] = useState<string>("");

  useEffect(() => {
    // Simple markdown to HTML conversion
    // This is a basic implementation - you might want to use a proper markdown library
    const convertMarkdown = (markdown: string): string => {
      if (!markdown) return "";

      return (
        markdown
          // Headers
          .replace(
            /^### (.*$)/gim,
            '<h3 class="text-lg font-semibold mt-4 mb-2">$1</h3>',
          )
          .replace(
            /^## (.*$)/gim,
            '<h2 class="text-xl font-semibold mt-6 mb-3">$1</h2>',
          )
          .replace(
            /^# (.*$)/gim,
            '<h1 class="text-2xl font-bold mt-8 mb-4">$1</h1>',
          )

          // Bold and italic
          .replace(
            /\*\*(.*?)\*\*/g,
            '<strong class="font-semibold">$1</strong>',
          )
          .replace(/\*(.*?)\*/g, '<em class="italic">$1</em>')

          // Code blocks
          .replace(
            /```([\s\S]*?)```/g,
            '<pre class="bg-gray-100 dark:bg-gray-800 p-3 rounded-md overflow-x-auto my-4"><code>$1</code></pre>',
          )
          .replace(
            /`([^`]+)`/g,
            '<code class="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-sm">$1</code>',
          )

          // Links
          .replace(
            /\[([^\]]+)\]\(([^)]+)\)/g,
            '<a href="$2" class="text-primary underline-offset-4 hover:underline" target="_blank" rel="noopener noreferrer">$1</a>',
          )

          // Lists
          .replace(/^\* (.*$)/gim, '<li class="ml-4">$1</li>')
          .replace(/^- (.*$)/gim, '<li class="ml-4">$1</li>')
          .replace(/^\d+\. (.*$)/gim, '<li class="ml-4">$1</li>')

          // Paragraphs
          .replace(/\n\n/g, '</p><p class="mb-4">')
          .replace(/^(.+)$/gm, '<p class="mb-4">$1</p>')

          // Clean up empty paragraphs
          .replace(/<p class="mb-4"><\/p>/g, "")
          .replace(/<p class="mb-4">\s*<\/p>/g, "")

          // Clean up list items that are wrapped in paragraphs
          .replace(/<p class="mb-4"><li/g, "<li")
          .replace(/<\/li><\/p>/g, "</li>")

          // Wrap consecutive list items in ul/ol
          .replace(
            /(<li[^>]*>.*?<\/li>)/g,
            '<ul class="list-disc mb-4">$1</ul>',
          )
          .replace(/<\/ul>\s*<ul[^>]*>/g, "")

          // Line breaks
          .replace(/\n/g, "<br>")
      );
    };

    setRenderedContent(convertMarkdown(content));
  }, [content]);

  if (!content.trim()) {
    return (
      <div className="text-muted-foreground italic">No content to preview</div>
    );
  }

  return (
    <div
      className="prose prose-sm max-w-none dark:prose-invert"
      dangerouslySetInnerHTML={{ __html: renderedContent }}
    />
  );
}
