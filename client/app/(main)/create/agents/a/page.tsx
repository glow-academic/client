/**
 * app/(main)/management/agents/a/page.tsx
 * Agent page for the agents section.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import { redirect } from "next/navigation";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Agents",
  description: "Agents in GLOW (Graduate Learning Orientation Workshop) at Purdue University.",
};

export default function AgentPage() {
  return redirect("/create/agents/new");
}
