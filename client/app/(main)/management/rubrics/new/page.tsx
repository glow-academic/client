/**
 * app/management/rubrics/new/page.tsx
 * New rubric creation page using the unified rubric component
 * @AshokSaravanan222 & @siladiea
 * 06/09/2025
 */

import NewRubric from "@/components/management/rubrics/NewRubric";

import { auth } from "@/auth";
import { rubricsDetailDefaultKeys } from "@/lib/api/v2/keys";
import { fetchRubricDetailDefault } from "@/lib/api/v2/server/rubrics";
import { getQueryClient } from "@/utils/queryClient";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "New Rubric",
  description: `New rubric creation page using the unified rubric component in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
};

export default async function NewRubricPage() {
  const session = await auth();
  const profileId = session?.effectiveProfileId || "";

  const queryClient = getQueryClient();

  // Prefetch default rubric detail for instant hydration
  await queryClient.prefetchQuery({
    queryKey: rubricsDetailDefaultKeys.detail(profileId),
    queryFn: () => fetchRubricDetailDefault(profileId),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="space-y-6">
        <NewRubric />
      </div>
    </HydrationBoundary>
  );
}
