/**
 * app/(main)/analytics/leaderboard/page.tsx
 * Leaderboard page for the analytics section.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import Leaderboard from "@/components/analytics/Leaderboard";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Leaderboard",
  description: `Leaderboard in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
};

export default function LeaderboardPage() {
  return (
    <div className="space-y-6">
      <Leaderboard />
    </div>
  );
}
