/**
 * app/(main)/management/parameters/p/[parameterId]/page.tsx
 * Parameter edit page for the parameter page.
 * @AshokSaravanan222 & @siladiea
 * 07/26/2025
 */

import EditSystemAgent from "@/components/system/agents/EditAgent";
import { getAgent } from "@/utils/queries/agents/get-agent";
import type { Metadata, ResolvingMetadata } from "next";
import { use } from "react";

export async function generateMetadata(
  { params }: { params: Promise<{ agentId: string }> },
  _parent: ResolvingMetadata
): Promise<Metadata> {
  const { agentId } = await params;
  const agent = await getAgent(agentId);
  return {
    title: `${agent?.name || "Agent"} Agent`,
    description: `${agent?.name + " " + agent?.description || "Agent"} in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
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
