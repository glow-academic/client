/**
 * app/(main)/management/cohorts/page.tsx
 * Cohorts list page - redirects to home with cohorts section
 * @AshokSaravanan222 & @siladiea
 * 06/18/2025
 */
import Cohorts from "@/components/management/cohorts/Cohorts";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cohorts",
  description: "Manage cohorts in GLOW (Graduate Learning Orientation Workshop) at Purdue University.",
};

export default function CohortsPage() {
  return (
    <div className="space-y-6">
      <Cohorts />
    </div>
  );
}
