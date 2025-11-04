/**
 * app/(main)/system/agents/a/[agentId]/page.tsx
 * System Agent edit page for the system agent page.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import SystemAgent from "@/components/common/agent/SystemAgent";
import { auth } from "@/auth";
import { api } from "@/lib/api/client";
import { keys } from "@/lib/query/keys";
import { getQueryClient } from "@/utils/queryClient";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import type { Metadata, ResolvingMetadata } from "next";

export async function generateMetadata(
  { params }: { params: Promise<{ agentId: string }> },
  _parent: ResolvingMetadata
): Promise<Metadata> {
  const { agentId } = await params;
  const session = await auth();
  const profileId = session?.effectiveProfileId || "";

  try {
    const agent = await api.post("/agents/detail", {
      body: { agentId, profileId },
    });
    return {
      title: `${agent?.name || "Agent"} Agent`,
      description: `${agent ? `${agent.name} ${agent.description}` : "Agent"} in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
    };
  } catch {
    return {
      title: "Agent",
      description: `Agent in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
    };
  }
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
    queryKey: keys.agents.with({ agentId, profileId }),
    queryFn: () =>
      api.post("/agents/detail", {
        body: { agentId, profileId },
      }),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="space-y-6">
        <SystemAgent agentId={agentId} />
      </div>
    </HydrationBoundary>
  );
}
