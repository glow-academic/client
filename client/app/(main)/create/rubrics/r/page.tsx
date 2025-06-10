/**
 * app/(main)/create/rubrics/r/page.tsx
 * Rubric page for the rubrics section. Redirects to rubrics page.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import { redirect } from "next/navigation";

export default function RubricsPage() {
  return redirect("/create/rubrics");
}
