/**
 * ChatHeaderBadge.tsx
 * Badge component to show chat mode (preview/live) in chat headers
 * @AshokSaravanan222 & @siladiea
 * 06/20/2025
 */
"use client";

interface ChatHeaderBadgeProps {
  mode: "live" | "preview";
}

export default function ChatHeaderBadge({ mode }: ChatHeaderBadgeProps) {
  if (mode !== "preview") return null;

  return (
    <span className="ml-2 rounded px-2 py-0.5 text-xs font-semibold bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200">
      PREVIEW
    </span>
  );
}
