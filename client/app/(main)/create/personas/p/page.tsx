/**
 * app/(main)/create/personas/p/page.tsx
 * Persona page for the personas section.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import { redirect } from "next/navigation";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Personas",
  description: `Personas in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
};

export default function PersonaPage() {
  return redirect("/create/personas/new");
}
