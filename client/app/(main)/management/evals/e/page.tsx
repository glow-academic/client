/**
 * app/(main)/management/evals/e/[evalId]/page.tsx
 * Eval details page for the evals section.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import { redirect } from "next/navigation";

export default function EvalDetailsPage({}) {
  return redirect("/management/evals/new");
}
