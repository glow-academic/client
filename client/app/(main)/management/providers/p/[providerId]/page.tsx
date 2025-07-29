/**
 * app/(main)/management/providers/p/[providerId]/page.tsx
 * Model edit page for the model.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import ProviderEdit from "@/components/management/providers/ProviderEdit";
import { getProvider } from "@/utils/queries/providers/get-provider";
import { getQueryClient } from "@/utils/react-query/queryClient";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import type { Metadata, ResolvingMetadata } from "next";

export async function generateMetadata(
  { params }: { params: Promise<{ providerId: string }> },
  _parent: ResolvingMetadata,
): Promise<Metadata> {
  // read route params
  const { providerId } = await params;

  const provider = await getProvider(providerId);

  return {
    title: `${provider?.name || "Provider"}`,
    description:
      provider?.description ||
      `Manage individual AI models in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
  };
}

export default async function ProviderEditPage({
  params,
}: {
  params: Promise<{ providerId: string }>;
}) {
  const { providerId } = await params;
  const queryClient = getQueryClient();

  await queryClient.prefetchQuery({
    queryKey: ["provider", providerId],
    queryFn: () => getProvider(providerId),
  });

  return (
    <div className="space-y-6">
      <HydrationBoundary state={dehydrate(queryClient)}>
        <ProviderEdit providerId={providerId} />
      </HydrationBoundary>
    </div>
  );
}
