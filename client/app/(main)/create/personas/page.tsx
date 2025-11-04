/**
 * app/(main)/create/personas/page.tsx
 * Persona list page - redirects to home with personas section
 * @AshokSaravanan222 & @siladiea
 * 06/09/2025
 */
import Personas from "@/components/personas/Personas";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Personas",
  description: `Personas in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
};

export default function PersonasPage() {
  return (
    <div className="space-y-6">
      <Personas />
    </div>
  );
}
