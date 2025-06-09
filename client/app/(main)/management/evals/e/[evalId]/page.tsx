/**
 * app/(main)/management/evals/e/[evalId]/page.tsx
 * Page for the eval page.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */
"use client";

import EvalEdit from "@/components/management/evals/EvalEdit";
import { use } from "react";

export default function EvalEditPage({ params }: { params: Promise<{ evalId: string }> }) {
  const { evalId } = use(params);
  return <div className="space-y-6"><EvalEdit evalId={evalId} /></div>;
}