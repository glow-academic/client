/**
 * app/(main)/system/providers/p/[providerId]/page.tsx
 * Provider edit page for the provider.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import { auth } from "@/auth";
import ProviderEdit from "@/components/system/providers/ProviderEdit";
import { providersDetailKeys } from "@/lib/api/v2/keys";
import { fetchProviderDetail } from "@/lib/api/v2/server/providers";
import { providerRepo } from "@/lib/repos/providerRepo";
import { getQueryClient } from "@/utils/react-query/queryClient";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import type { Metadata, ResolvingMetadata } from "next";

export async function generateMetadata(
  { params }: { params: Promise<{ providerId: string }> },
  _parent: ResolvingMetadata
): Promise<Metadata> {
  // read route params
  const { providerId } = await params;

  const provider = await providerRepo.find(providerId);

  return {
    title: `${provider?.name || "Provider"}`,
    description:
      provider?.description ||
      `Manage individual AI providers in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
  };
}

export default async function ProviderEditPage({
  params,
}: {
  params: Promise<{ providerId: string }>;
}) {
  const { providerId } = await params;
  const session = await auth();
  const profileId = session?.effectiveProfileId || "";

  const queryClient = getQueryClient();

  // Prefetch provider detail for instant hydration
  await queryClient.prefetchQuery({
    queryKey: providersDetailKeys.detail(providerId, profileId),
    queryFn: () => fetchProviderDetail(providerId, profileId),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="space-y-6">
        <ProviderEdit providerId={providerId} />
      </div>
    </HydrationBoundary>
  );
}
