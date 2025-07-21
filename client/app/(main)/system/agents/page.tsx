/**
 * app/(main)/system/agents/page.tsx
 * System Agent list page - redirects to home with system agents section
 * @AshokSaravanan222 & @siladiea
 * 06/09/2025
 */

import SystemAgents from "@/components/system/agents/SystemAgents";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "System Agents",
  description: `System Agents in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
};

export default function AgentsPage() {
  return (
    <div className="space-y-6">
      <SystemAgents />
    </div>
  );
}
