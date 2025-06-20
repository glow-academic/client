/**
 * app/(main)/management/agents/a/[agentId]/page.tsx
 * Agent edit page for the agent page.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import AgentEdit from "@/components/create/agents/AgentEdit";
import { use } from "react";

import type { Metadata, ResolvingMetadata } from "next";
import { getAgent } from "@/utils/queries/agents/get-agent";


export async function generateMetadata(
  { params }: { params: Promise<{ agentId: string }> },
  _parent: ResolvingMetadata
): Promise<Metadata> {
  const { agentId } = await params;
  const agent = await getAgent(agentId);
  return {
    title: `${agent?.name || "Agent"}`,
    description: `${agent?.name + " " + agent?.description || "Agent"} in GLOW (Graduate Learning Orientation Workshop) at Purdue University.`,
  };
}



export default function AgentEditPage({
  params,
}: {
  params: Promise<{ agentId: string }>;
}) {
  const { agentId } = use(params);
  return (
    <div className="space-y-6">
      <AgentEdit agentId={agentId} />
    </div>
  );
}
