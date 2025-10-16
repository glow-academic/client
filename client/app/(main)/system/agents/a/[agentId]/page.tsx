/**
 * app/(main)/system/agents/a/[agentId]/page.tsx
 * System Agent edit page for the system agent page.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import EditSystemAgent from "@/components/system/agents/EditAgent";

import { auth } from "@/auth";
import { agentsDetailKeys } from "@/lib/api/v2/keys";
import { fetchAgentDetail } from "@/lib/api/v2/server/agents";
import { agentRepo } from "@/lib/repos/agentRepo";
import { getQueryClient } from "@/utils/queryClient";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import type { Metadata, ResolvingMetadata } from "next";

export async function generateMetadata(
  { params }: { params: Promise<{ agentId: string }> },
  _parent: ResolvingMetadata
): Promise<Metadata> {
  const { agentId } = await params;
  const agent = await agentRepo.find(agentId);
  return {
    title: `${agent?.name || "Agent"} Agent`,
    description: `${agent?.name + " " + agent?.description || "Agent"} in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
  };
}

export default async function AgentEditPage({
  params,
}: {
  params: Promise<{ agentId: string }>;
}) {
  const { agentId } = await params;
  const session = await auth();
  const profileId = session?.effectiveProfileId || "";

  const queryClient = getQueryClient();

  // Prefetch agent detail for instant hydration
  await queryClient.prefetchQuery({
    queryKey: agentsDetailKeys.detail(agentId, profileId),
    queryFn: () => fetchAgentDetail(agentId, profileId),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="space-y-6">
        <EditSystemAgent agentId={agentId} />
      </div>
    </HydrationBoundary>
  );
}
