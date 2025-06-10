/**
 * app/(main)/management/agents/a/[agentId]/page.tsx
 * Agent edit page for the agent page.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */
"use client";

import AgentEdit from "@/components/management/agents/AgentEdit";
import { use } from "react";

export default function AgentEditPage({ params }: { params: Promise<{ agentId: string }> }) {
  const { agentId } = use(params);
  return <div className="space-y-6"><AgentEdit agentId={agentId} /></div>;
}