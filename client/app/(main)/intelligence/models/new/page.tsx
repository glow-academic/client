/**
 * app/(main)/engine/models/new/page.tsx
 * New model page
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import Model from "@/components/artifacts/model/Model";
import { PageHeader } from "@/components/common/layout/PageHeader";
import { SaveToolbar } from "@/components/common/drafts/SaveToolbar";
import { resolveGroupId } from "@/app/(main)/layout-server";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";
import { createLoader, parseAsString } from "nuqs/server";

/** ---- Strong types from OpenAPI ---- */
type GetModelIn = InputOf<"/api/v5/artifacts/models/get", "post">;
type GetModelOut = OutputOf<"/api/v5/artifacts/models/get", "post">;
type CreateModelIn = InputOf<"/api/v5/artifacts/models/create", "post">;
type CreateModelOut = OutputOf<"/api/v5/artifacts/models/create", "post">;
type PatchModelDraftIn = InputOf<"/api/v5/artifacts/models/draft", "patch">;
type PatchModelDraftOut = OutputOf<"/api/v5/artifacts/models/draft", "patch">;
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
/** ---- Docs types for page metadata ---- */
type DocsIn = InputOf<"/api/v5/artifacts/models/docs", "post">;
type DocsOut = OutputOf<"/api/v5/artifacts/models/docs", "post">;

const getDocs = async (input: DocsIn): Promise<DocsOut> => {
  return api.post("/artifacts/models/docs", input);
};

export async function generateMetadata(): Promise<Metadata> {
  const docs = await getDocs({ body: {} });
  return { title: docs.new.title, description: docs.new.description };
}

/** ---- Strongly-typed server actions (single source of truth) ---- */
async function createModel(input: CreateModelIn): Promise<CreateModelOut> {
  "use server";
  return api.post("/artifacts/models/create", input);
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

  // Resolve group_id from layout context (cached per request)
  const groupId = (await resolveGroupId({ draft_id: q.draftId ?? null, artifact_type: "model" })).group_id;

  // Fetch default model data with draft_id (model_id = null for new mode)
  const input: GetModelIn = {
    body: {
      model_id: null,
      draft_id: q.draftId ?? null,
      group_id: groupId,
    },
  };
  const modelDetailDefault = await getModelDetailDefault(input);

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { title: "Intelligence", section: "intelligence", url: "/intelligence" },
          { title: "Models", section: "models", url: "/intelligence/models" },
          { title: "New Model" },
        ]}
        toolbar={<SaveToolbar artifactType="model" />}
      />
      <div className="space-y-6 px-4">
        <Model
          modelDetailDefault={modelDetailDefault}
          createModelAction={createModel}
          patchModelDraftAction={patchModelDraft}
          createNamesAction={createDraftNames}
          createDescriptionsAction={createDraftDescriptions}
          createValuesAction={createDraftValues}
          createPricingAction={createDraftPricing}
          createVoicesAction={createDraftVoices}
        />
      </div>
    </>
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
