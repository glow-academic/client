/**
 * app/e/page.tsx
 * Evaluation page. Redirects to new evaluation page.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */
"use client";

import { redirect } from "next/navigation";

export default function EvaluationPage() {
  return redirect("/management/evals");
}