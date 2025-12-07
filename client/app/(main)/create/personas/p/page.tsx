/**
 * app/(main)/create/personas/p/page.tsx
 * Persona page for the personas section.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import { getSession } from "@/auth";
import { redirect } from "next/navigation";

import { api } from "@/lib/api/client";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Personas",
    description:
      "Manage AI-powered student personas for teaching assistant training. Create and organize realistic student profiles with diverse personalities and learning styles to enhance simulation-based pedagogical practice and student interaction training.",
  };
}

export default function PersonaPage() {
  return redirect("/create/personas/new");
}
