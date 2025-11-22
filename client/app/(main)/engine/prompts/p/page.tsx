/**
 * app/(main)/engine/prompts/p/page.tsx
 * Prompt page for the prompts section. Redirects to prompts page.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import { redirect } from "next/navigation";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Prompts",
  description: `Prompts in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
};

export default function PromptPage() {
  return redirect("/engine/prompts");
}

