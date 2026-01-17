/**
 * MessageContentAdapter.tsx
 * Pure component for adapting message content with replacements and highlights
 * Used in GradedMessagesView (not MessagesView)
 * Explicit, self-contained types
 */
"use client";

import Markdown from "@/components/common/chat/markdown/Markdown";

export interface MessageContentAdapterProps {
  content: string;
  replaces: Array<{ section: string; replace: string }>;
  highlights: Array<{ section: string }>;
}

export function MessageContentAdapter({
  content,
  replaces,
  highlights,
}: MessageContentAdapterProps) {
  if (replaces.length === 0 && highlights.length === 0) {
    return <Markdown>{content}</Markdown>;
  }

  // Process replacements first (strikethrough + replacement)
  let adaptedContent = content;
  const replacementRanges: Array<{
    start: number;
    end: number;
    original: string;
    replacement: string;
  }> = [];

  for (const replaceItem of replaces) {
    const section = replaceItem.section;
    const index = adaptedContent.indexOf(section);
    if (index !== -1) {
      replacementRanges.push({
        start: index,
        end: index + section.length,
        original: section,
        replacement: replaceItem.replace,
      });
    }
  }

  // Sort by start position (reverse order to avoid index shifting)
  replacementRanges.sort((a, b) => b.start - a.start);

  // Apply replacements
  for (const range of replacementRanges) {
    const before = adaptedContent.substring(0, range.start);
    const after = adaptedContent.substring(range.end);
    adaptedContent =
      before +
      `<span class="line-through text-muted-foreground">${range.original}</span> <span class="text-green-600 dark:text-green-400">${range.replacement}</span>` +
      after;
  }

  // Process highlights
  const highlightRanges: Array<{ start: number; end: number; text: string }> =
    [];
  for (const highlightItem of highlights) {
    const section = highlightItem.section;
    const index = adaptedContent.indexOf(section);
    if (index !== -1) {
      highlightRanges.push({
        start: index,
        end: index + section.length,
        text: section,
      });
    }
  }

  // Sort by start position (reverse order)
  highlightRanges.sort((a, b) => b.start - a.start);

  // Apply highlights (only if not already replaced)
  for (const range of highlightRanges) {
    // Check if this range overlaps with any replacement
    const overlapsReplacement = replacementRanges.some(
      (r) => !(range.end <= r.start || range.start >= r.end)
    );
    if (!overlapsReplacement) {
      const before = adaptedContent.substring(0, range.start);
      const after = adaptedContent.substring(range.end);
      adaptedContent =
        before +
        `<span class="bg-yellow-200 dark:bg-yellow-900 px-1 rounded">${range.text}</span>` +
        after;
    }
  }

  return <Markdown>{adaptedContent}</Markdown>;
}
