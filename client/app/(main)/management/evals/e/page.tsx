/**
 * app/(main)/management/evals/e/[evalId]/page.tsx
 * Eval details page for the evals section.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import { redirect } from "next/navigation";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Evals",
  description: "Manage evals in GLOW (Graduate Learning Orientation Workshop) at Purdue University.",
};

export default function EvalDetailsPage({}) {
  return redirect("/management/evals/new");
}
