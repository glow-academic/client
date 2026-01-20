/**
 * app/(main)/engine/models/[modelId]/page.tsx
 * Model edit page
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import Model from "@/components/models/Model";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata, ResolvingMetadata } from "next";
import { createLoader, parseAsString } from "nuqs/server";

/** ---- Strong types from OpenAPI ---- */
type GetModelIn = InputOf<"/api/v4/models/get", "post">;
type GetModelOut = OutputOf<"/api/v4/models/get", "post">;

type SaveModelIn = InputOf<"/api/v4/models/save", "post">;
type SaveModelOut = OutputOf<"/api/v4/models/save", "post">;
type PatchModelDraftIn = InputOf<"/api/v4/models/draft", "patch">;
type PatchModelDraftOut = OutputOf<"/api/v4/models/draft", "patch">;
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
type CreateDraftEndpointsIn = InputOf<"/api/v4/resources/endpoints", "post">;
type CreateDraftEndpointsOut = OutputOf<"/api/v4/resources/endpoints", "post">;
type CreateDraftFlagsIn = InputOf<"/api/v4/resources/flags", "post">;
type CreateDraftFlagsOut = OutputOf<"/api/v4/resources/flags", "post">;
type CreateDraftModalitiesIn = InputOf<"/api/v4/resources/modalities", "post">;
type CreateDraftModalitiesOut = OutputOf<"/api/v4/resources/modalities", "post">;
type CreateDraftTemperatureLevelsIn = InputOf<
  "/api/v4/resources/temperature_levels",
  "post"
>;
type CreateDraftTemperatureLevelsOut = OutputOf<
  "/api/v4/resources/temperature_levels",
  "post"
>;
type CreateDraftReasoningLevelsIn = InputOf<
  "/api/v4/resources/reasoning_levels",
  "post"
>;
type CreateDraftReasoningLevelsOut = OutputOf<
  "/api/v4/resources/reasoning_levels",
  "post"
>;
type CreateDraftPricingIn = InputOf<"/api/v4/resources/pricing", "post">;
type CreateDraftPricingOut = OutputOf<"/api/v4/resources/pricing", "post">;
type CreateDraftVoicesIn = InputOf<"/api/v4/resources/voices", "post">;
type CreateDraftVoicesOut = OutputOf<"/api/v4/resources/voices", "post">;
type CreateDraftQualitiesIn = InputOf<"/api/v4/resources/qualities", "post">;
type CreateDraftQualitiesOut = OutputOf<"/api/v4/resources/qualities", "post">;

/** ---- Direct fetch (no caching - source of truth) ----
 * Always bypass cache to ensure fresh data for detail/edit pages.
 */
const getModel = async (input: GetModelIn): Promise<GetModelOut> => {
  return api.post("/models/get", input, {
    cache: "no-store",
    headers: {
      "X-Bypass-Cache": "1",
    },
  });
};

/** ---- Metadata uses the same cached fetch ---- */
export async function generateMetadata(
  { params }: { params: Promise<{ modelId: string }> },
  _parent: ResolvingMetadata
): Promise<Metadata> {
  const { modelId } = await params;
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  try {
    const input: GetModelIn = {
      body: {
        model_id: modelId,
        draft_id: null,
      },
    };
    const model = await getModel(input);
    return {
      title: `${model?.name || "Model"}`,
      description:
        model?.description ||
        `${model?.name ? `${model.name} - ` : ""}AI language model configuration for teaching assistant training simulations. Customize model settings to power realistic student personas and enhance simulation-based learning experiences.`,
    };
  } catch {
    // Fall through to default metadata
  }

  return {
    title: "Model",
    description:
      "AI language model configuration for teaching assistant training simulations. Customize model settings to power realistic student personas and enhance simulation-based learning experiences.",
  };
}

/** ---- Strongly-typed server actions (single source of truth) ---- */
async function saveModel(input: SaveModelIn): Promise<SaveModelOut> {
  "use server";
  // Input body already has snake_case from API schema (input_model_id, not modelId)
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/models/save", input);
}

async function patchModelDraft(
  input: PatchModelDraftIn
): Promise<PatchModelDraftOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  // No revalidateTag needed - Redis cache handles invalidation
  return api.patch("/models/draft", input);
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

async function createDraftEndpoints(
  input: CreateDraftEndpointsIn
): Promise<CreateDraftEndpointsOut> {
  "use server";
  return api.post("/resources/endpoints", input);
}

async function createDraftFlags(
  input: CreateDraftFlagsIn
): Promise<CreateDraftFlagsOut> {
  "use server";
  return api.post("/resources/flags", input);
}

async function createDraftModalities(
  input: CreateDraftModalitiesIn
): Promise<CreateDraftModalitiesOut> {
  "use server";
  return api.post("/resources/modalities", input);
}

async function createDraftTemperatureLevels(
  input: CreateDraftTemperatureLevelsIn
): Promise<CreateDraftTemperatureLevelsOut> {
  "use server";
  return api.post("/resources/temperature_levels", input);
}

async function createDraftReasoningLevels(
  input: CreateDraftReasoningLevelsIn
): Promise<CreateDraftReasoningLevelsOut> {
  "use server";
  return api.post("/resources/reasoning_levels", input);
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

async function createDraftQualities(
  input: CreateDraftQualitiesIn
): Promise<CreateDraftQualitiesOut> {
  "use server";
  return api.post("/resources/qualities", input);
}

/** ---- Server renders client with typed data and actions ---- */
export default async function ModelEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ modelId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { modelId } = await params;
  // Access control handled server-side in layout
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  // Parse search params using nuqs
  const paramsObj = await searchParams;
  const searchParamsObj = new URLSearchParams();
  Object.entries(paramsObj).forEach(([key, value]) => {
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

  // Fetch model data with draft_id (model_id provided for detail mode)
  const input: GetModelIn = {
    body: {
      model_id: modelId,
      draft_id: q.draftId ?? null,
    },
  };
  const model = await getModel(input);

  return (
    <div className="space-y-6" data-page="model-edit" data-model-id={modelId}>
      <Model
        modelId={modelId}
        modelDetail={model}
        saveModelAction={saveModel}
        patchModelDraftAction={patchModelDraft}
        createNamesAction={createDraftNames}
        createDescriptionsAction={createDraftDescriptions}
        createValuesAction={createDraftValues}
        createEndpointsAction={createDraftEndpoints}
        createFlagsAction={createDraftFlags}
        createModalitiesAction={createDraftModalities}
        createTemperatureLevelsAction={createDraftTemperatureLevels}
        createReasoningLevelsAction={createDraftReasoningLevels}
        createPricingAction={createDraftPricing}
        createVoicesAction={createDraftVoices}
        createQualitiesAction={createDraftQualities}
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
  CreateDraftEndpointsIn,
  CreateDraftEndpointsOut,
  CreateDraftFlagsIn,
  CreateDraftFlagsOut,
  CreateDraftModalitiesIn,
  CreateDraftModalitiesOut,
  CreateDraftTemperatureLevelsIn,
  CreateDraftTemperatureLevelsOut,
  CreateDraftReasoningLevelsIn,
  CreateDraftReasoningLevelsOut,
  CreateDraftPricingIn,
  CreateDraftPricingOut,
  CreateDraftVoicesIn,
  CreateDraftVoicesOut,
  CreateDraftQualitiesIn,
  CreateDraftQualitiesOut,
};
