/**
 * app/management/rubrics/page.tsx
 * Rubric list page - redirects to home with rubrics section
 * @AshokSaravanan222 & @siladiea
 * 06/09/2025
 */
import React from "react";
import Rubrics from "@/components/management/rubrics/Rubrics";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Rubrics",
  description: "Rubrics in GLOW (Graduate Learning Orientation Workshop) at Purdue University.",
};

export default function RubricsPage() {
  return (
    <div className="space-y-6">
      <Rubrics />
    </div>
  );
}
