/**
 * app/(main)/engine/models/[modelId]/page.tsx
 * Model edit page
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import { getSession } from "@/auth";

import Model from "@/components/models/Model";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata, ResolvingMetadata } from "next";

/** ---- Strong types from OpenAPI ---- */
type ModelDetailIn = InputOf<"/api/v3/models/detail", "post">;
type ModelDetailOut = OutputOf<"/api/v3/models/detail", "post">;

type UpdateModelIn = InputOf<"/api/v3/models/update", "post">;
type UpdateModelOut = OutputOf<"/api/v3/models/update", "post">;
type CreateKeyIn = InputOf<"/api/v3/keys/create", "post">;
type CreateKeyOut = OutputOf<"/api/v3/keys/create", "post">;
type DecryptKeyIn = InputOf<"/api/v3/keys/decrypt-key", "post">;
type DecryptKeyOut = OutputOf<"/api/v3/keys/decrypt-key", "post">;
type UpdateKeyIn = InputOf<"/api/v3/keys/update", "post">;
type UpdateKeyOut = OutputOf<"/api/v3/keys/update", "post">;

/** ---- Direct fetch (no caching - source of truth) ----
 * Always bypass cache to ensure fresh data for detail/edit pages.
 */
const getModel = async (
  modelId: string,
  profileId: string,
): Promise<ModelDetailOut> => {
  return api.post(
    "/models/detail",
    { body: { modelId, profileId } },
    {
      cache: "no-store",
      headers: {
        "X-Bypass-Cache": "1",
      },
    },
  );
};

/** ---- Metadata uses the same cached fetch ---- */
export async function generateMetadata(
  { params }: { params: Promise<{ modelId: string }> },
  _parent: ResolvingMetadata,
): Promise<Metadata> {
  const { modelId } = await params;
  const session = await getSession();
  const profileId = session?.effectiveProfileId || "";

  try {
    const model = await getModel(modelId, profileId);
    return {
      title: `${model?.name || "Model"}`,
      description:
        model?.description ||
        `${model?.name ? `${model.name} - ` : ""}AI language model configuration for teaching assistant training simulations. Customize model settings to power realistic student personas and enhance simulation-based learning experiences.`,
    };
  } catch {
    return {
      title: "Model",
      description:
        "AI language model configuration for teaching assistant training simulations. Customize model settings to power realistic student personas and enhance simulation-based learning experiences.",
    };
  }
}

/** ---- Strongly-typed server actions (single source of truth) ---- */
async function updateModel(input: UpdateModelIn): Promise<UpdateModelOut> {
  "use server";
  const session = await getSession();
  const profileId = session?.effectiveProfileId || "guest-profile-id";
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/models/update", {
    ...input,
    body: { ...input.body, profileId },
  });
}

export async function createKey(input: CreateKeyIn): Promise<CreateKeyOut> {
  "use server";
  const session = await getSession();
  const profileId = session?.effectiveProfileId || "guest-profile-id";
  return api.post("/keys/create", {
    ...input,
    body: { ...input.body, profileId },
  });
}

export async function decryptKey(input: DecryptKeyIn): Promise<DecryptKeyOut> {
  "use server";
  return api.post("/keys/decrypt-key", input);
}

export async function updateKey(input: UpdateKeyIn): Promise<UpdateKeyOut> {
  "use server";
  const session = await getSession();
  const profileId = session?.effectiveProfileId || "guest-profile-id";
  return api.post("/keys/update", {
    ...input,
    body: { ...input.body, profileId },
  });
}

/** ---- Server renders client with typed data and actions ---- */
export default async function ModelEditPage({
  params,
}: {
  params: Promise<{ modelId: string }>;
}) {
  const { modelId } = await params;
  const session = await getSession();
  const profileId = session?.effectiveProfileId || "";

  // Fetch model data (always fresh - source of truth, includes provider_mapping)
  const model = await getModel(modelId, profileId);

  return (
    <div className="space-y-6" data-page="model-edit" data-model-id={modelId}>
      <Model
        modelId={modelId}
        modelDetail={model}
        updateModelAction={updateModel}
        createKeyAction={createKey}
        decryptKeyAction={decryptKey}
        updateKeyAction={updateKey}
      />
    </div>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  CreateKeyIn,
  CreateKeyOut,
  DecryptKeyIn,
  DecryptKeyOut,
  ModelDetailIn,
  ModelDetailOut,
  UpdateKeyIn,
  UpdateKeyOut,
  UpdateModelIn,
  UpdateModelOut,
};
