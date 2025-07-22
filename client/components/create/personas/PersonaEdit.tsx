/**
 * PersonaEdit.tsx
 * Used to edit personas using the unified persona component.
 * @AshokSaravanan222 & @siladiea
 * 06/07/2025
 */
"use client";
import Persona from "@/components/common/agent/Persona";

export interface PersonaEditProps {
  personaId: string;
}

export default function PersonaEdit({ personaId }: PersonaEditProps) {
  return <Persona personaId={personaId} mode="edit" />;
}
