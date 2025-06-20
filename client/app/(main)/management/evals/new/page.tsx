/**
 * app/(main)/management/evals/new/page.tsx
 * New eval page for the evals section.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import NewEval from "@/components/management/evals/NewEval";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Evals",
  description: "Create new evals in GLOW (Graduate Learning Orientation Workshop) at Purdue University.",
};

export default function NewEvalPage() {
  return (
    <div className="space-y-6">
      <NewEval />
    </div>
  );
}
