/**
 * MessageContentAdapter.tsx
 * Pure component for adapting message content with hover-based annotations
 * Shows highlights/replacements only for the currently hovered feedback
 */
"use client";

import Markdown from "@/components/artifacts/attempt/chat/markdown/Markdown";

// Feedback entry type (matches API schema)
export interface FeedbackEntryForAdapter {
  id: string;
  type: string | null; // "strength" | "improvement"
  highlights?: Array<{ section: string | null }> | null;
  replaces?: Array<{ section: string | null; replace: string | null }> | null;
}

export interface MessageContentAdapterProps {
  content: string;
  feedbacks: FeedbackEntryForAdapter[];
  hoveredFeedbackId: string | null;
}

export function MessageContentAdapter({
  content,
  feedbacks,
  hoveredFeedbackId,
}: MessageContentAdapterProps) {
  // If nothing hovered, show clean text
  if (!hoveredFeedbackId) {
    return <Markdown>{content}</Markdown>;
  }

  // Find the hovered feedback
  const hoveredFeedback = feedbacks.find((f) => f.id === hoveredFeedbackId);
  if (!hoveredFeedback) {
    return <Markdown>{content}</Markdown>;
  }

  // Get annotations for this specific feedback
  const highlights = hoveredFeedback.highlights || [];
  const replaces = hoveredFeedback.replaces || [];

  if (highlights.length === 0 && replaces.length === 0) {
    return <Markdown>{content}</Markdown>;
  }

  // Single-pass annotation: collect all ranges first
  type AnnotationRange = {
    start: number;
    end: number;
    type: "highlight" | "replacement";
    original: string;
    replacement?: string;
  };

  const ranges: AnnotationRange[] = [];

  // Collect highlight ranges
  for (const h of highlights) {
    if (!h.section) continue;
    const index = content.indexOf(h.section);
    if (index !== -1) {
      ranges.push({
        start: index,
        end: index + h.section.length,
        type: "highlight",
        original: h.section,
      });
    }
  }

  // Collect replacement ranges
  for (const r of replaces) {
    if (!r.section || !r.replace) continue;
    const index = content.indexOf(r.section);
    if (index !== -1) {
      ranges.push({
        start: index,
        end: index + r.section.length,
        type: "replacement",
        original: r.section,
        replacement: r.replace,
      });
    }
  }

  if (ranges.length === 0) {
    return <Markdown>{content}</Markdown>;
  }

  // Sort by start position (ascending for building output)
  ranges.sort((a, b) => a.start - b.start);

  // Build annotated content
  let result = "";
  let lastEnd = 0;

  for (const range of ranges) {
    // Skip overlapping ranges (keep first one)
    if (range.start < lastEnd) continue;

    // Add text before this range
    result += content.substring(lastEnd, range.start);

    // Add annotated text
    if (range.type === "highlight") {
      // Strength: green underline on the good text
      result += `<span class="underline decoration-2 decoration-green-500 dark:decoration-green-400 underline-offset-2">${range.original}</span>`;
    } else {
      // Improvement: amber strikethrough on original (keep text color), then underlined replacement
      result += `<span class="line-through decoration-amber-500 decoration-2">${range.original}</span> <span class="underline decoration-2 decoration-green-500 dark:decoration-green-400 underline-offset-2">${range.replacement}</span>`;
    }

    lastEnd = range.end;
  }

  // Add remaining text
  result += content.substring(lastEnd);

  return (
    <div className="transition-all duration-200 ease-in-out">
      <Markdown>{result}</Markdown>
    </div>
  );
}
