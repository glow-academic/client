/**
 * app/(main)/system/agents/a/[agentId]/page.tsx
 * System Agent edit page for the system agent page.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import { use } from "react";
import type { Metadata, ResolvingMetadata } from "next";
import EditSystemAgent from "@/components/system/agents/EditSystemAgent";
import { getSystemAgent } from "@/utils/queries/system_agents/get-system-agent";

export async function generateMetadata(
  { params }: { params: Promise<{ agentId: string }> },
  _parent: ResolvingMetadata
): Promise<Metadata> {
  const { agentId } = await params;
  const agent = await getSystemAgent(agentId);
  return {
    title: `${agent?.name || "System Agent"} System Agent`,
    description: `${agent?.name + " " + agent?.description || "System Agent"} in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
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
      <EditSystemAgent agentId={agentId} />
    </div>
  );
}
