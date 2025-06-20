/**
 * app/(main)/analytics/history/page.tsx
 * History page for the analytics section.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import History from "@/components/analytics/History";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "History",
  description: "History in GLOW (Graduate Learning Orientation Workshop) at Purdue University.",
};

export default function HistoryPage() {
  return (
    <div className="space-y-6">
      <History />
    </div>
  );
}
