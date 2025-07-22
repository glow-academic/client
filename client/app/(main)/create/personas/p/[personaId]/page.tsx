/**
 * app/(main)/create/personas/p/[personaId]/page.tsx
 * Persona edit page for the persona page.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import PersonaEdit from "@/components/create/personas/PersonaEdit";
import { use } from "react";

import { getPersona } from "@/utils/queries/personas/get-persona";
import type { Metadata, ResolvingMetadata } from "next";

export async function generateMetadata(
  { params }: { params: Promise<{ personaId: string }> },
  _parent: ResolvingMetadata
): Promise<Metadata> {
  const { personaId } = await params;
  const persona = await getPersona(personaId);
  return {
    title: `${persona?.name || "Persona"} Persona`,
    description: `${persona?.name + " " + persona?.description || "Persona"} in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
  };
}

export default function PersonaEditPage({
  params,
}: {
  params: Promise<{ personaId: string }>;
}) {
  const { personaId } = use(params);
  return (
    <div className="space-y-6">
      <PersonaEdit personaId={personaId} />
    </div>
  );
}
