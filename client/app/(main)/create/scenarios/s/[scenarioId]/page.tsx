/**
 * app/create/scenarios/s/[scenarioId]/page.tsx
 * Scenario editing page with v2 API prefetching
 * @AshokSaravanan222 & @siladiea
 * 06/09/2025
 */

import { auth } from "@/auth";
import Scenario from "@/components/scenarios/Scenario";
import { api } from "@/lib/api/client";
import { keys } from "@/lib/query/keys";
import { getQueryClient } from "@/utils/queryClient";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import type { Metadata, ResolvingMetadata } from "next";

export async function generateMetadata(
  { params }: { params: Promise<{ scenarioId: string }> },
  _parent: ResolvingMetadata
): Promise<Metadata> {
  const { scenarioId } = await params;
  const session = await auth();
  const profileId = session?.effectiveProfileId || "";

  try {
    const scenario = await api.post("/scenarios/detail", {
      body: { scenarioId, profileId },
    });
    return {
      title: `${scenario?.name || "Scenario"}`,
      description: `${scenario ? `${scenario.name} ${scenario.problem_statement || ""}` : "Scenario"} in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
    };
  } catch {
    return {
      title: "Scenario",
      description: `Scenario in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
    };
  }
}

export default async function EditScenarioPage({
  params,
}: {
  params: Promise<{ scenarioId: string }>;
}) {
  const { scenarioId } = await params;
  const session = await auth();
  const profileId = session?.effectiveProfileId || "";

  const queryClient = getQueryClient();

  // Prefetch scenario detail for instant hydration
  await queryClient.prefetchQuery({
    queryKey: keys.scenarios.with({ scenarioId, profileId }),
    queryFn: () =>
      api.post("/scenarios/detail", {
        body: { scenarioId, profileId },
      }),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="space-y-6">
        <Scenario scenarioId={scenarioId} mode="edit" />
      </div>
    </HydrationBoundary>
  );
}
