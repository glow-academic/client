/**
 * app/(main)/engine/models/[modelId]/page.tsx
 * Model edit page
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import Model from "@/components/artifacts/model/Model";
import { PageHeader } from "@/components/common/layout/PageHeader";
import { SaveToolbar } from "@/components/common/drafts/SaveToolbar";
import { DraftProviderClient } from "@/contexts/draft-context";

import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";
import { createLoader, parseAsString } from "nuqs/server";

/** ---- Strong types from OpenAPI ---- */
type GetModelIn = InputOf<"/models/get", "post">;
type GetModelOut = OutputOf<"/models/get", "post">;

type CreateModelIn = InputOf<"/models/create", "post">;
type CreateModelOut = OutputOf<"/models/create", "post">;
type UpdateModelIn = InputOf<"/models/update", "post">;
type UpdateModelOut = OutputOf<"/models/update", "post">;
type PatchModelDraftIn = InputOf<"/models/draft", "patch">;
type PatchModelDraftOut = OutputOf<"/models/draft", "patch">;
type CreateDraftNamesIn = InputOf<"/api/v5/resources/names", "post">;
type CreateDraftNamesOut = OutputOf<"/api/v5/resources/names", "post">;
type CreateDraftDescriptionsIn = InputOf<
  "/api/v5/resources/descriptions",
  "post"
>;
type CreateDraftDescriptionsOut = OutputOf<
  "/api/v5/resources/descriptions",
  "post"
>;
type CreateDraftValuesIn = InputOf<"/api/v5/resources/values", "post">;
type CreateDraftValuesOut = OutputOf<"/api/v5/resources/values", "post">;
type CreateDraftPricingIn = InputOf<"/api/v5/resources/pricing", "post">;
type CreateDraftPricingOut = OutputOf<"/api/v5/resources/pricing", "post">;
type CreateDraftVoicesIn = InputOf<"/api/v5/resources/voices", "post">;
type CreateDraftVoicesOut = OutputOf<"/api/v5/resources/voices", "post">;

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

/** ---- Docs types for page metadata ---- */
type DocsIn = InputOf<"/models/docs", "post">;
type DocsOut = OutputOf<"/models/docs", "post">;

const getDocs = async (input: DocsIn): Promise<DocsOut> => {
  return api.post("/models/docs", input);
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ modelId: string }>;
}): Promise<Metadata> {
  const { modelId } = await params;
  const docs = await getDocs({ body: { entity_id: modelId } });
  return { title: docs.page_metadata?.detail.title, description: docs.page_metadata?.detail.description };
}

/** ---- Strongly-typed server actions (single source of truth) ---- */
async function createModel(input: CreateModelIn): Promise<CreateModelOut> {
  "use server";
  return api.post("/models/create", input);
}

async function updateModel(input: UpdateModelIn): Promise<UpdateModelOut> {
  "use server";
  return api.post("/models/update", input);
}

async function patchModelDraft(
  input: PatchModelDraftIn
): Promise<PatchModelDraftOut> {
  "use server";
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
export default async function ModelEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ modelId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { modelId } = await params;
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

  const modelSearchParams = {
    draftId: parseAsString,
  };
  const loadModelSearchParams = createLoader(modelSearchParams);
  const q = loadModelSearchParams(searchParamsObj);

  const input: GetModelIn = {
    body: {
      model_id: modelId,
      draft_id: q.draftId ?? null,
    },
  };
  const [model, docs, draftsResult] = await Promise.all([
    getModel(input),
    getDocs({ body: { entity_id: modelId } }),
    api.post("/models/drafts", {})
  ]);

  const entityName = docs.page_metadata?.detail.title;

  return (
    <DraftProviderClient drafts={draftsResult.entries ?? []}>
      <PageHeader
        breadcrumbs={[
          { title: "Intelligence", section: "intelligence", url: "/intelligence" },
          { title: "Models", section: "models", url: "/intelligence/models" },
          { title: entityName },
        ]}
        toolbar={<SaveToolbar />}
      />
      <div className="space-y-6 px-4" data-page="model-edit" data-model-id={modelId}>
        <Model
          modelId={modelId}
          modelDetail={model}
          createModelAction={createModel}
          updateModelAction={updateModel}
          patchModelDraftAction={patchModelDraft}
          createNamesAction={createDraftNames}
          createDescriptionsAction={createDraftDescriptions}
          createValuesAction={createDraftValues}
          createPricingAction={createDraftPricing}
          createVoicesAction={createDraftVoices}
        />
      </div>
    </DraftProviderClient>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  GetModelIn,
  GetModelOut,
  PatchModelDraftIn,
  PatchModelDraftOut,
  CreateModelIn,
  CreateModelOut,
  UpdateModelIn,
  UpdateModelOut,
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
