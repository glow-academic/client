/**
 * app/(main)/system/agents/a/page.tsx
 * Agent page for the agents section.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import { getSession } from "@/auth";
import { redirect } from "next/navigation";

import { api } from "@/lib/api/client";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "System Agents",
    description:
      "Manage AI agents for teaching assistant training simulations. Configure intelligent agents to power student personas, enhance simulation-based learning experiences, and support pedagogical development through advanced AI capabilities.",
  };
}

export default function AgentPage() {
  return redirect("/system/agents/new");
}
