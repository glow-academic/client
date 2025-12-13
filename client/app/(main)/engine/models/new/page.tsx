/**
 * app/(main)/engine/models/new/page.tsx
 * New model page
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import Model from "@/components/models/Model";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { getSession } from "@/auth";
import type { Metadata } from "next";

/** ---- Strong types from OpenAPI ---- */
type ModelNewIn = InputOf<"/api/v3/models/new", "post">;
type ModelNewOut = OutputOf<"/api/v3/models/new", "post">;
type CreateModelIn = InputOf<"/api/v3/models/create", "post">;
type CreateModelOut = OutputOf<"/api/v3/models/create", "post">;
type CreateKeyIn = InputOf<"/api/v3/keys/create", "post">;
type CreateKeyOut = OutputOf<"/api/v3/keys/create", "post">;
type DecryptKeyIn = InputOf<"/api/v3/keys/decrypt-key", "post">;
type DecryptKeyOut = OutputOf<"/api/v3/keys/decrypt-key", "post">;
type UpdateKeyIn = InputOf<"/api/v3/keys/update", "post">;
type UpdateKeyOut = OutputOf<"/api/v3/keys/update", "post">;

/** ---- Direct fetch for default model data (provider mapping for picker) ---- */
const getModelDetailDefault = async (
  profileId: string,
): Promise<ModelNewOut> => {
  return api.post(
    "/models/new",
    { body: { profileId } },
    {
      cache: "no-store",
      headers: {
        "X-Bypass-Cache": "1",
      },
    },
  );
};

/** ---- Metadata ---- */
export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Create Model",
    description:
      "Create a new AI language model configuration for teaching assistant training simulations. Set up custom models to power realistic student personas and enhance simulation-based learning experiences for pedagogical development.",
  };
}

/** ---- Strongly-typed server actions (single source of truth) ---- */
async function createModel(input: CreateModelIn): Promise<CreateModelOut> {
  "use server";
  const authResult = await requireAuthenticated();
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/models/create", {
    ...input,
    body: { ...input.body, profileId: authResult.effectiveProfileId },
  });
}

async function createKey(input: CreateKeyIn): Promise<CreateKeyOut> {
  "use server";
  const authResult = await requireAuthenticated();
  return api.post("/keys/create", {
    ...input,
    body: { ...input.body, profileId: authResult.effectiveProfileId },
  });
}

async function decryptKey(input: DecryptKeyIn): Promise<DecryptKeyOut> {
  "use server";
  return api.post("/keys/decrypt-key", input);
}

async function updateKey(input: UpdateKeyIn): Promise<UpdateKeyOut> {
  "use server";
  const authResult = await requireAuthenticated();
  return api.post("/keys/update", {
    ...input,
    body: { ...input.body, profileId: authResult.effectiveProfileId },
  });
}

/** ---- Server renders client with typed data and actions ---- */
export default async function NewModelPage() {
  // Access control is handled server-side in layout
  // Get profileId from session
  const session = await getSession();
  const profileId = session?.effectiveProfileId;

  if (!profileId) {
    // This should not happen due to server-side access control, but handle gracefully
    return null;
  }

  // Fetch default model data (provider mapping for picker)
  const modelDetailDefault = await getModelDetailDefault(profileId);

  return (
    <div className="space-y-6">
      <Model
        modelDetailDefault={modelDetailDefault}
        createModelAction={createModel}
        createKeyAction={createKey}
        decryptKeyAction={decryptKey}
        updateKeyAction={updateKey}
      />
    </div>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  CreateModelIn,
  CreateModelOut,
  ModelNewIn,
  ModelNewOut,
  CreateKeyIn,
  CreateKeyOut,
  DecryptKeyIn,
  DecryptKeyOut,
  UpdateKeyIn,
  UpdateKeyOut,
};
