/**
 * app/(main)/create/cohorts/page.tsx
 * Cohorts list page - redirects to home with cohorts section
 * @AshokSaravanan222 & @siladiea
 * 06/18/2025
 */
import Cohorts from "@/components/create/cohorts/Cohorts";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cohorts",
  description: `Manage cohorts in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
};

export default function CohortsPage() {
  return (
    <div className="space-y-6">
      <Cohorts />
    </div>
  );
}
