/**
 * app/(main)/management/evals/page.tsx
 * Eval list page - redirects to home with evals section
 * @AshokSaravanan222 & @siladiea
 * 06/09/2025
 */
import React from "react";
import Evals from "@/components/management/evals/Evals";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Evals",
  description: "Manage evals in GLOW (Graduate Learning Orientation Workshop) at Purdue University.",
};

export default function RubricsPage() {
  return (
    <div className="space-y-6">
      <Evals />
    </div>
  );
}
