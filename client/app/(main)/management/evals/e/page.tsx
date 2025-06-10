/**
 * app/(main)/management/evals/e/page.tsx
 * Eval page for the evals section.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

"use client";

import { redirect } from "next/navigation";

export default function EvalPage() {
  return redirect("/management/evals/new");
}
