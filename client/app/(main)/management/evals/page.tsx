/**
 * app/(main)/management/evals/page.tsx
 * Evals page. Redirects to evals page.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */
"use client";

import { redirect } from "next/navigation";

export default function EvalsPage() {
  return redirect("/management/evals/new");
}