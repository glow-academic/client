/**
 * app/(main)/management/evals/e/[evalId]/page.tsx
 * Eval details page for the eval page.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */
"use client";

import EvalDetails from "@/components/management/evals/EvalDetails";
import { use } from "react";

export default function EvalDetailsPage({ params }: { params: Promise<{ evalId: string }> }) {
  const { evalId } = use(params);
  return <div className="space-y-6"><EvalDetails evalId={evalId} /></div>;
}