/**
 * app/(main)/system/providers/p/[providerId]/new/page.tsx
 * New model page for the providers section.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import { auth } from "@/auth";
import NewModel from "@/components/system/providers/NewModel";
import { providersDetailKeys } from "@/lib/api/v2/keys";
import { fetchProviderDetail } from "@/lib/api/v2/server/providers";
import { getQueryClient } from "@/utils/queryClient";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import type { Metadata, ResolvingMetadata } from "next";

export async function generateMetadata(
  { params }: { params: Promise<{ providerId: string }> },
  _parent: ResolvingMetadata
): Promise<Metadata> {
  // read route params
  const { providerId } = await params;
  const session = await auth();
  const profileId = session?.effectiveProfileId || "";

  try {
    const provider = await fetchProviderDetail(providerId, profileId);
    return {
      title: `${provider?.name || "Provider"} Models`,
      description:
        provider?.description ||
        `Manage individual AI models for ${provider?.name} in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
    };
  } catch {
    return {
      title: "Provider Models",
      description: `Manage individual AI models in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
    };
  }
}

export default async function NewModelPage({
  params,
}: {
  params: Promise<{ providerId: string }>;
}) {
  const { providerId } = await params;
  const session = await auth();
  const profileId = session?.effectiveProfileId || "";

  const queryClient = getQueryClient();

  // Prefetch provider detail for context
  await queryClient.prefetchQuery({
    queryKey: providersDetailKeys.detail(providerId, profileId),
    queryFn: () => fetchProviderDetail(providerId, profileId),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="space-y-6">
        <NewModel providerId={providerId} />
      </div>
    </HydrationBoundary>
  );
}
