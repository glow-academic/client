/**
 * app/(main)/providers/p/[providerId]/m/[modelId]/page.tsx
 * Model edit page for the model.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import { auth } from "@/auth";
import ModelEdit from "@/components/system/providers/ModelEdit";
import { modelsDetailKeys } from "@/lib/api/v2/keys";
import { fetchModelDetail } from "@/lib/api/v2/server/models";
import { modelRepo } from "@/lib/repos/modelRepo";
import { getQueryClient } from "@/utils/queryClient";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import type { Metadata, ResolvingMetadata } from "next";

export async function generateMetadata(
  { params }: { params: Promise<{ modelId: string }> },
  _parent: ResolvingMetadata
): Promise<Metadata> {
  // read route params
  const { modelId } = await params;

  const model = await modelRepo.find(modelId);

  return {
    title: `${model?.name || "Model"}`,
    description:
      model?.description ||
      `Manage individual AI models in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
  };
}

export default async function ModelEditPage({
  params,
}: {
  params: Promise<{ providerId: string; modelId: string }>;
}) {
  const { providerId, modelId } = await params;
  const session = await auth();
  const profileId = session?.effectiveProfileId || "";

  const queryClient = getQueryClient();

  // Prefetch model detail for instant hydration
  await queryClient.prefetchQuery({
    queryKey: modelsDetailKeys.detail(modelId, providerId, profileId),
    queryFn: () => fetchModelDetail(modelId, providerId, profileId),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="space-y-6">
        <ModelEdit modelId={modelId} providerId={providerId} />
      </div>
    </HydrationBoundary>
  );
}
