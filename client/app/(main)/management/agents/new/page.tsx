/**
 * app/(main)/management/agents/new/page.tsx
 * New agent page for the agents section.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import NewAgent from "@/components/management/agents/NewAgent";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "New Agent",
  description: `New agent creation page for the agents section in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
};

export default function NewAgentPage() {
  return (
    <div className="space-y-6">
      <NewAgent />
    </div>
  );
}
