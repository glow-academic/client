/**
 * app/(main)/providers/p/[providerId]/m/[modelId]/page.tsx
 * Model edit page for the model.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import { auth } from "@/auth";
import Model from "@/components/providers/Model";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata, ResolvingMetadata } from "next";
import { revalidateTag } from "next/cache";
import { cache } from "react";

/** ---- Strong types from OpenAPI ---- */
type ModelDetailIn = InputOf<"/api/v3/providers/models/detail", "post">;
type ModelDetailOut = OutputOf<"/api/v3/providers/models/detail", "post">;

type ProviderDetailIn = InputOf<"/api/v3/providers/detail", "post">;
type ProviderDetailOut = OutputOf<"/api/v3/providers/detail", "post">;

type UpdateModelIn = InputOf<"/api/v3/providers/models/update", "post">;
type UpdateModelOut = OutputOf<"/api/v3/providers/models/update", "post">;

type CreateModelIn = InputOf<"/api/v3/providers/models/create", "post">;
type CreateModelOut = OutputOf<"/api/v3/providers/models/create", "post">;

/** ---- Cached fetch used by both page + metadata (prevents double hit) ---- */
const getModel = cache(
  async (input: ModelDetailIn): Promise<ModelDetailOut> => {
    return api.post("/providers/models/detail", input);
  }
);

const getProvider = cache(
  async (input: ProviderDetailIn): Promise<ProviderDetailOut> => {
    return api.post("/providers/detail", input);
  }
);

/** ---- Metadata uses the same cached fetch ---- */
export async function generateMetadata(
  { params }: { params: Promise<{ modelId: string; providerId: string }> },
  _parent: ResolvingMetadata
): Promise<Metadata> {
  const { modelId, providerId } = await params;
  const session = await auth();
  const profileId = session?.effectiveProfileId || "";

  try {
    const model = await getModel({ body: { modelId, providerId, profileId } });
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

/** ---- Strongly-typed server actions (single source of truth) ---- */
export async function createModel(
  input: CreateModelIn
): Promise<CreateModelOut> {
  "use server";
  const out = await api.post("/providers/models/create", input);
  revalidateTag("providers");
  return out;
}

export async function updateModel(
  input: UpdateModelIn
): Promise<UpdateModelOut> {
  "use server";
  const out = await api.post("/providers/models/update", input);
  revalidateTag("providers");
  return out;
}

/** ---- Server renders client with typed data and actions ---- */
export default async function ModelEditPage({
  params,
}: {
  params: Promise<{ providerId: string; modelId: string }>;
}) {
  const { providerId, modelId } = await params;
  const session = await auth();
  const profileId = session?.effectiveProfileId || "";

  // Fetch both model and provider data (cached, won't duplicate)
  const [model, provider] = await Promise.all([
    getModel({ body: { modelId, providerId, profileId } }),
    getProvider({ body: { providerId, profileId } }),
  ]);

  return (
    <div className="space-y-6">
      <Model
        modelId={modelId}
        providerId={providerId}
        modelDetail={model}
        providerDetail={provider}
        createModelAction={createModel}
        updateModelAction={updateModel}
      />
    </div>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  CreateModelIn,
  CreateModelOut,
  ModelDetailIn,
  ModelDetailOut,
  ProviderDetailIn,
  ProviderDetailOut,
  UpdateModelIn,
  UpdateModelOut,
};
