/**
 * app/(main)/create/scenarios/s/page.tsx
 * Scenario page for the scenarios section. Redirects to scenarios page.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

"use client";

import { redirect } from "next/navigation";

export default function ScenariosPage() {
  return redirect("/create/scenarios");
}
