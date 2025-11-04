/**
 * app/create/scenarios/new/page.tsx
 * New scenario creation page with v2 API prefetching
 * @AshokSaravanan222 & @siladiea
 * 06/09/2025
 */

import Scenario from "@/components/scenarios/Scenario";
import { auth } from "@/auth";
import { api } from "@/lib/api/client";
import { keys } from "@/lib/query/keys";
import { getQueryClient } from "@/utils/queryClient";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "New Scenario",
  description: `New scenario creation in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
};

export default async function NewScenarioPage() {
  const session = await auth();
  const profileId = session?.effectiveProfileId || "";

  const queryClient = getQueryClient();

  // Prefetch default scenario detail for instant hydration
  await queryClient.prefetchQuery({
    queryKey: keys.scenarios.with({ profileId }),
    queryFn: () =>
      api.post("/scenarios/detail-default", {
        body: { profileId },
      }),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="space-y-6">
        <Scenario mode="create" />
      </div>
    </HydrationBoundary>
  );
}
