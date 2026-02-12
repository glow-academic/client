/**
 * app/(main)/engine/models/new/page.tsx
 * New model page
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import Model from "@/components/artifacts/model/Model";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";
import { createLoader, parseAsString } from "nuqs/server";

/** ---- Strong types from OpenAPI ---- */
type GetModelIn = InputOf<"/api/v4/artifacts/models/get", "post">;
type GetModelOut = OutputOf<"/api/v4/artifacts/models/get", "post">;
type SaveModelIn = InputOf<"/api/v4/artifacts/models/save", "post">;
type SaveModelOut = OutputOf<"/api/v4/artifacts/models/save", "post">;
type PatchModelDraftIn = InputOf<"/api/v4/artifacts/models/draft", "patch">;
type PatchModelDraftOut = OutputOf<"/api/v4/artifacts/models/draft", "patch">;
type CreateDraftNamesIn = InputOf<"/api/v4/resources/names", "post">;
type CreateDraftNamesOut = OutputOf<"/api/v4/resources/names", "post">;
type CreateDraftDescriptionsIn = InputOf<
  "/api/v4/resources/descriptions",
  "post"
>;
type CreateDraftDescriptionsOut = OutputOf<
  "/api/v4/resources/descriptions",
  "post"
>;
type CreateDraftValuesIn = InputOf<"/api/v4/resources/values", "post">;
type CreateDraftValuesOut = OutputOf<"/api/v4/resources/values", "post">;
type CreateDraftPricingIn = InputOf<"/api/v4/resources/pricing", "post">;
type CreateDraftPricingOut = OutputOf<"/api/v4/resources/pricing", "post">;
type CreateDraftVoicesIn = InputOf<"/api/v4/resources/voices", "post">;
type CreateDraftVoicesOut = OutputOf<"/api/v4/resources/voices", "post">;

/** ---- Direct fetch for default model data (provider mapping for picker) ---- */
const getModelDetailDefault = async (
  input: GetModelIn
): Promise<GetModelOut> => {
  return api.post("/artifacts/models/get", input, {
    cache: "no-store",
    headers: {
      "X-Bypass-Cache": "1",
    },
  });
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
async function saveModel(input: SaveModelIn): Promise<SaveModelOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/artifacts/models/save", input);
}

async function patchModelDraft(
  input: PatchModelDraftIn
): Promise<PatchModelDraftOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  // No revalidateTag needed - Redis cache handles invalidation
  return api.patch("/artifacts/models/draft", input);
}

async function createDraftNames(
  input: CreateDraftNamesIn
): Promise<CreateDraftNamesOut> {
  "use server";
  return api.post("/resources/names", input);
}

async function createDraftDescriptions(
  input: CreateDraftDescriptionsIn
): Promise<CreateDraftDescriptionsOut> {
  "use server";
  return api.post("/resources/descriptions", input);
}

async function createDraftValues(
  input: CreateDraftValuesIn
): Promise<CreateDraftValuesOut> {
  "use server";
  return api.post("/resources/values", input);
}

async function createDraftPricing(
  input: CreateDraftPricingIn
): Promise<CreateDraftPricingOut> {
  "use server";
  return api.post("/resources/pricing", input);
}

async function createDraftVoices(
  input: CreateDraftVoicesIn
): Promise<CreateDraftVoicesOut> {
  "use server";
  return api.post("/resources/voices", input);
}

/** ---- Server renders client with typed data and actions ---- */
export default async function NewModelPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // Access control handled server-side in layout
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  // Parse search params using nuqs
  const params = await searchParams;
  const searchParamsObj = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      if (Array.isArray(value)) {
        value.forEach((v) => searchParamsObj.append(key, v));
      } else {
        searchParamsObj.set(key, value);
      }
    }
  });

  // Inline server-side parsers for model search params (draftId only)
  const modelSearchParams = {
    draftId: parseAsString,
  };
  const loadModelSearchParams = createLoader(modelSearchParams);
  const q = loadModelSearchParams(searchParamsObj);

  // Fetch default model data with draft_id (model_id = null for new mode)
  const input: GetModelIn = {
    body: {
      model_id: null,
      draft_id: q.draftId ?? null,
    },
  };
  const modelDetailDefault = await getModelDetailDefault(input);

  return (
    <div className="space-y-6">
      <Model
        modelDetailDefault={modelDetailDefault}
        saveModelAction={saveModel}
        patchModelDraftAction={patchModelDraft}
        createNamesAction={createDraftNames}
        createDescriptionsAction={createDraftDescriptions}
        createValuesAction={createDraftValues}
        createPricingAction={createDraftPricing}
        createVoicesAction={createDraftVoices}
      />
    </div>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  GetModelIn,
  GetModelOut,
  PatchModelDraftIn,
  PatchModelDraftOut,
  SaveModelIn,
  SaveModelOut,
  CreateDraftNamesIn,
  CreateDraftNamesOut,
  CreateDraftDescriptionsIn,
  CreateDraftDescriptionsOut,
  CreateDraftValuesIn,
  CreateDraftValuesOut,
  CreateDraftPricingIn,
  CreateDraftPricingOut,
  CreateDraftVoicesIn,
  CreateDraftVoicesOut,
};
