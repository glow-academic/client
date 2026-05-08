/**
 * MarkdownInline.tsx
 * Minimal Markdown renderer for compact UI surfaces — tooltips, accordion
 * bodies, activity-rail receipts. Stripped down from the chat-grade
 * `Markdown.tsx` (no KaTeX, no syntax highlighting, no autolink-heading
 * arrows, no internal Link wrapping). Just GFM (tables, task lists,
 * strikethrough) so the Jinja-rendered ``output`` strings from tool
 * receipts read cleanly.
 *
 * Sized for cramped containers: every block element gets ``text-xs``,
 * tight margins, and small headings. Drop into any narrow column.
 */

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export interface MarkdownInlineProps {
  children: string;
}

export default function MarkdownInline({ children }: MarkdownInlineProps) {
  return (
    <div className="text-xs leading-snug break-words space-y-1 [&_p]:my-1 [&_ul]:my-1 [&_ul]:pl-4 [&_ul]:list-disc [&_ol]:my-1 [&_ol]:pl-4 [&_ol]:list-decimal [&_li]:my-0 [&_h1]:text-sm [&_h1]:font-semibold [&_h1]:my-1 [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:my-1 [&_h3]:text-xs [&_h3]:font-semibold [&_h3]:my-1 [&_h4]:text-xs [&_h4]:font-semibold [&_h4]:my-1 [&_code]:text-[10px] [&_code]:bg-muted [&_code]:px-1 [&_code]:rounded [&_pre]:text-[10px] [&_pre]:p-1.5 [&_pre]:bg-muted [&_pre]:rounded [&_pre]:overflow-x-auto [&_strong]:font-semibold [&_a]:underline [&_a]:text-foreground [&_table]:my-1 [&_table]:text-[10px] [&_th]:px-1 [&_th]:py-0.5 [&_th]:border [&_td]:px-1 [&_td]:py-0.5 [&_td]:border [&_blockquote]:border-l-2 [&_blockquote]:pl-2 [&_blockquote]:italic [&_blockquote]:my-1 [&_hr]:my-2">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}
