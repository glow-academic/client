/**
 * app/(main)/create/personas/new/page.tsx
 * New persona page for the personas section.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import NewPersona from "@/components/create/personas/NewPersona";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "New Persona",
  description: `New persona creation page for the personas section in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
};

export default function NewPersonaPage() {
  return (
    <div className="space-y-6">
      <NewPersona />
    </div>
  );
}
