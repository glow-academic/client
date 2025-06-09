/**
 * app/(main)/management/agents/a/[agentId]/page.tsx
 * Agent details page for the agent page.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */
"use client";

import AgentDetails from "@/components/management/agents/AgentDetails";
import { use } from "react";

export default function AgentDetailsPage({ params }: { params: Promise<{ agentId: string }> }) {
  const { agentId } = use(params);
  return <div className="space-y-6"><AgentDetails agentId={agentId} /></div>;
}