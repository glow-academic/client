/**
 * app/(main)/management/models/m/[modelId]/page.tsx
 * Model edit page for the model.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import ModelEdit from "@/components/management/models/ModelEdit";
import type { Metadata } from "next";
import type { ResolvingMetadata } from "next";
import { getModel } from "@/utils/queries/models/get-model";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { createQueryClient } from "@/utils/react-query/queryClient";
import { getAllProviders } from "@/utils/queries/providers/get-all-providers";

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
      "Manage individual AI models in GLOW (Graduate Learning Orientation Workshop) at Purdue University.",
  };
}

export default async function ModelEditPage({
  params,
}: {
  params: Promise<{ modelId: string }>;
}) {
  const { modelId } = await params;
  const queryClient = createQueryClient();

  await queryClient.prefetchQuery({
    queryKey: ['model', modelId],
    queryFn: () => getModel(modelId)
  });

  await queryClient.prefetchQuery({
    queryKey: ["providers"],
    queryFn: () => getAllProviders(),
  });

  return (
    <div className="space-y-6">
      <HydrationBoundary state={dehydrate(queryClient)}>
        <ModelEdit modelId={modelId} />
      </HydrationBoundary>
    </div>
  );
}
