/**
 * app/(main)/engine/models/new/page.tsx
 * New model page
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import { getSession } from "@/auth";

import Model from "@/components/models/Model";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";

/** ---- Strong types from OpenAPI ---- */
type ModelDetailDefaultIn = InputOf<"/api/v3/models/detail-default", "post">;
type ModelDetailDefaultOut = OutputOf<"/api/v3/models/detail-default", "post">;
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
  profileId: string
): Promise<ModelDetailDefaultOut> => {
  return api.post(
    "/models/detail-default",
    { body: { profileId } },
    {
      cache: "no-store",
      headers: {
        "X-Bypass-Cache": "1",
      },
    }
  );
};

/** ---- Metadata ---- */
export async function generateMetadata(): Promise<Metadata> {
  const session = await getSession();
  const profileId = session?.effectiveProfileId || "guest-profile-id";

  let organizationName = "";
  let organizationDescription = "";
  try {
    const activeSettings = await api.post("/settings/active", {
      body: { profileId },
    });
    organizationName = activeSettings.organization_name || "";
    organizationDescription = activeSettings.organization_description || "";
  } catch {
    // If settings unavailable, organizationName and organizationDescription will be empty
  }

  const orgPart = organizationName
    ? ` at ${organizationName}${organizationDescription ? ` - ${organizationDescription}` : ""}`
    : "";

  return {
    title: "Create Model",
    description: `Create a new AI model in GLOW${orgPart}.`,
  };
}

/** ---- Strongly-typed server actions (single source of truth) ---- */
async function createModel(
  input: CreateModelIn,
): Promise<CreateModelOut> {
  "use server";
  const session = await getSession();
  const profileId = session?.effectiveProfileId || "guest-profile-id";
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/models/create", {
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
export default async function NewModelPage() {
  const session = await getSession();
  const profileId = session?.effectiveProfileId || "";

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
  ModelDetailDefaultIn,
  ModelDetailDefaultOut,
  CreateKeyIn,
  CreateKeyOut,
  DecryptKeyIn,
  DecryptKeyOut,
  UpdateKeyIn,
  UpdateKeyOut,
};

