/**
 * app/(main)/system/agents/new/page.tsx
 * New provider page for the providers section.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */


import SystemAgent from "@/components/common/agent/SystemAgent";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Agents",
  description: `Create new AI agents in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
};

export default function NewAgentPage() {
  return (
    <div className="space-y-6">
      <SystemAgent />
    </div>
  );
}
