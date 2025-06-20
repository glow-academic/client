/**
 * app/(main)/management/models/m/[modelId]/page.tsx
 * Model edit page for the model.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import ModelEdit from "@/components/management/models/ModelEdit";
import { use } from "react";
import type { Metadata } from "next";
import type { ResolvingMetadata } from "next";
import { getModel } from "@/utils/queries/models/get-model";

export async function generateMetadata(
  { params }: { params: Promise<{ modelId: string }> },
  _parent: ResolvingMetadata
): Promise<Metadata> {
  // read route params
  const { modelId } = await params

  const model = await getModel(modelId);

  return {
    title: `${model?.name || "Model"}`,
    description: model?.description || "Manage individual AI models in GLOW (Graduate Learning Orientation Workshop) at Purdue University.",
  };
}

export default function ModelEditPage({
  params,
}: {
  params: Promise<{ modelId: string }>;
}) {
  const { modelId } = use(params);
  return (
    <div className="space-y-6">
      <ModelEdit modelId={modelId} />
    </div>
  );
}
