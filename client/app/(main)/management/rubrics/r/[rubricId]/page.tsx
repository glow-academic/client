/**
 * app/management/rubrics/r/[rubricId]/page.tsx
 * Rubric editing page
 * @AshokSaravanan222 & @siladiea
 * 06/09/2025
 */

import RubricEdit from "@/components/management/rubrics/RubricEdit";

import { auth } from "@/auth";
import { rubricsDetailKeys } from "@/lib/api/v2/keys";
import { fetchRubricDetail } from "@/lib/api/v2/server/rubrics";
import { getQueryClient } from "@/utils/queryClient";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import type { Metadata, ResolvingMetadata } from "next";

export async function generateMetadata(
  { params }: { params: Promise<{ rubricId: string }> },
  _parent: ResolvingMetadata
): Promise<Metadata> {
  const { rubricId } = await params;
  const session = await auth();
  const profileId = session?.effectiveProfileId || "";

  try {
    const rubric = await fetchRubricDetail(rubricId, profileId);
    return {
      title: `${rubric?.name || "Rubric"}`,
      description: `${rubric?.name + " " + rubric?.description || "Rubric"} in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
    };
  } catch {
    return {
      title: "Rubric",
      description: `Rubric in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
    };
  }
}

export default async function EditRubricPage({
  params,
}: {
  params: Promise<{ rubricId: string }>;
}) {
  const { rubricId } = await params;
  const session = await auth();
  const profileId = session?.effectiveProfileId || "";

  const queryClient = getQueryClient();

  // Prefetch rubric detail for instant hydration
  await queryClient.prefetchQuery({
    queryKey: rubricsDetailKeys.detail(rubricId, profileId),
    queryFn: () => fetchRubricDetail(rubricId, profileId),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="space-y-6">
        <RubricEdit rubricId={rubricId} />
      </div>
    </HydrationBoundary>
  );
}
