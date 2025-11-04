/**
 * app/(main)/analytics/reports/p/[profileId]/page.tsx
 * Reports page for the user.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import Report from "@/components/reports/Report";
import { api } from "@/lib/api/client";
import { keys } from "@/lib/query/keys";
import { getQueryClient } from "@/utils/queryClient";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import type { Metadata, ResolvingMetadata } from "next";

export async function generateMetadata(
  { params }: { params: Promise<{ profileId: string }> },
  _parent: ResolvingMetadata
): Promise<Metadata> {
  const { profileId } = await params;

  try {
    const profileData = await api.post("/profile/detail", {
      body: { profileId },
    });
    return {
      title: `${profileData.profile.firstName} ${profileData.profile.lastName}`,
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

  const queryClient = getQueryClient();

  // Prefetch profile detail for instant hydration
  await queryClient.prefetchQuery({
    queryKey: keys.profile.with({ profileId }),
    queryFn: () =>
      api.post("/profile/detail", {
        body: { profileId },
      }),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="space-y-6">
        <Report profileId={profileId} />
      </div>
    </HydrationBoundary>
  );
}
