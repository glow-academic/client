/**
 * app/(main)/create/scenarios/s/page.tsx
 * Scenario page for the scenarios section. Redirects to scenarios page.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */
import { redirect } from "next/navigation";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Scenarios",
  description: `Scenarios in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
};

export default function ScenariosPage() {
  return redirect("/create/scenarios");
}
