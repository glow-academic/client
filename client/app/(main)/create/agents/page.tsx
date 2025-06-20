/**
 * app/(main)/management/agents/page.tsx
 * Agent list page - redirects to home with agents section
 * @AshokSaravanan222 & @siladiea
 * 06/09/2025
 */
import Agents from "@/components/create/agents/Agents";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Agents",
  description: "Agents in GLOW (Graduate Learning Orientation Workshop) at Purdue University.",
};

export default function AgentsPage() {
  return (
    <div className="space-y-6">
      <Agents />
    </div>
  );
}
