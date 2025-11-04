/**
 * app/(main)/providers/p/[providerId]/m/[modelId]/page.tsx
 * Model edit page for the model.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import { auth } from "@/auth";
import Model from "@/components/providers/Model";
import { api } from "@/lib/api/client";
import { keys } from "@/lib/query/keys";
import { getQueryClient } from "@/utils/queryClient";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import type { Metadata, ResolvingMetadata } from "next";

export async function generateMetadata(
  { params }: { params: Promise<{ modelId: string; providerId: string }> },
  _parent: ResolvingMetadata
): Promise<Metadata> {
  // read route params
  const { modelId, providerId } = await params;
  const session = await auth();
  const profileId = session?.effectiveProfileId || "";

  try {
    const model = await api.post("/providers/models/detail", {
      body: { modelId, providerId, profileId },
    });
    return {
      title: `${model?.name || "Model"}`,
      description:
        model?.description ||
        `Manage individual AI models in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
    };
  } catch {
    return {
      title: "Model",
      description: `Manage individual AI models in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
    };
  }
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
    queryKey: keys.providers.with({ modelId, providerId, profileId }),
    queryFn: () =>
      api.post("/providers/models/detail", {
        body: { modelId, providerId, profileId },
      }),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="space-y-6">
        <Model modelId={modelId} providerId={providerId} />
      </div>
    </HydrationBoundary>
  );
}
