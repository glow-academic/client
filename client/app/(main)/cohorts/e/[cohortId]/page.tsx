/**
 * app/(main)/cohorts/e/[cohortId]/page.tsx
 * Cohort edit page for the cohort.
 * @AshokSaravanan222 & @siladiea
 * 07/20/2025
 */

import CohortEdit from "@/components/cohorts/CohortEdit";

import { auth } from "@/auth";
import { cohortsDetailKeys } from "@/lib/api/v2/keys";
import { fetchCohortDetail } from "@/lib/api/v2/server/cohorts";
import { cohortRepo } from "@/lib/repos/cohortRepo";
import { getQueryClient } from "@/utils/react-query/queryClient";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import type { Metadata, ResolvingMetadata } from "next";

export async function generateMetadata(
  { params }: { params: Promise<{ cohortId: string }> },
  _parent: ResolvingMetadata
): Promise<Metadata> {
  // read route params
  const { cohortId } = await params;

  const cohort = await cohortRepo.find(cohortId);

  return {
    title: `${cohort?.title || "Cohort"} Edit`,
    description: `${cohort ? `${cohort.title} ${cohort.description}` : "Cohort"} in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
  };
}

export default async function CohortEditPage({
  params,
}: {
  params: Promise<{ cohortId: string }>;
}) {
  const { cohortId } = await params;
  const session = await auth();
  const profileId = session?.effectiveProfileId || "";

  const queryClient = getQueryClient();

  // Prefetch cohort detail for instant hydration
  await queryClient.prefetchQuery({
    queryKey: cohortsDetailKeys.detail(cohortId, profileId),
    queryFn: () => fetchCohortDetail(cohortId, profileId),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="space-y-6">
        <CohortEdit cohortId={cohortId} />
      </div>
    </HydrationBoundary>
  );
}
