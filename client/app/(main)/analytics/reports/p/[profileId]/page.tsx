/**
 * app/(main)/analytics/reports/p/[profileId]/page.tsx
 * Reports page for the user.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import { auth } from "@/auth";
import Report from "@/components/analytics/report/Report";
import { profileDetailKeys } from "@/lib/api/v2/keys";
import { fetchProfileDetail } from "@/lib/api/v2/server/profile";
import { getQueryClient } from "@/utils/queryClient";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import type { Metadata, ResolvingMetadata } from "next";

export async function generateMetadata(
  { params }: { params: Promise<{ profileId: string }> },
  _parent: ResolvingMetadata
): Promise<Metadata> {
  const { profileId } = await params;
  const session = await auth();
  const currentProfileId = session?.effectiveProfileId || "";

  try {
    const profileData = await fetchProfileDetail(profileId, currentProfileId);
    return {
      title: profileData.name,
      description: `Reports for individual staff in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
    };
  } catch {
    return {
      title: "Profile Report",
      description: `Reports for individual staff in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
    };
  }
}

export default async function ReportsPage({
  params,
}: {
  params: Promise<{ profileId: string }>;
}) {
  const { profileId } = await params;
  const session = await auth();
  const currentProfileId = session?.effectiveProfileId || "";

  const queryClient = getQueryClient();

  // Prefetch profile detail for instant hydration
  await queryClient.prefetchQuery({
    queryKey: profileDetailKeys.detail(profileId, currentProfileId),
    queryFn: () => fetchProfileDetail(profileId, currentProfileId),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="space-y-6">
        <Report profileId={profileId} />
      </div>
    </HydrationBoundary>
  );
}
