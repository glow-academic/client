/**
 * app/(main)/providers/p/[providerId]/m/[modelId]/page.tsx
 * Model edit page for the model.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import ModelEdit from "@/components/system/providers/ModelEdit";
import { getModel } from "@/utils/queries/models/get-model";
import { getAllProviders } from "@/utils/queries/providers/get-all-providers";
import { getQueryClient } from "@/utils/react-query/queryClient";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import type { Metadata, ResolvingMetadata } from "next";

export async function generateMetadata(
  { params }: { params: Promise<{ modelId: string }> },
  _parent: ResolvingMetadata
): Promise<Metadata> {
  // read route params
  const { modelId } = await params;

  const model = await getModel(modelId);

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
  const queryClient = getQueryClient();

  await queryClient.prefetchQuery({
    queryKey: ["model", modelId],
    queryFn: () => getModel(modelId),
  });

  await queryClient.prefetchQuery({
    queryKey: ["providers"],
    queryFn: () => getAllProviders(),
  });

  return (
    <div className="space-y-6">
      <HydrationBoundary state={dehydrate(queryClient)}>
        <ModelEdit modelId={modelId} providerId={providerId} />
      </HydrationBoundary>
    </div>
  );
}
