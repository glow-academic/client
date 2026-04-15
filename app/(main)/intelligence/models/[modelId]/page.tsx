/**
 * app/(main)/intelligence/models/[modelId]/page.tsx
 * Model edit page — full SSR rendering with FullPageLayout.
 * Page owns all data fetching, server actions, and layout rendering.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import { getSession } from "@/auth";
import { UnifiedAccessDenied } from "@/components/common/layout/UnifiedAccessDenied";
import { FullPageLayout } from "@/components/common/layout/FullPageLayout";
import { SaveToolbar } from "@/components/common/drafts/SaveToolbar";
import Model from "@/components/artifacts/model/Model";
import { DraftProviderClient } from "@/contexts/draft-context";

import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { createLoader, parseAsString } from "nuqs/server";

import { buildSnapshot } from "@/lib/auth";

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
type GroupModelIn = InputOf<"/models/group", "post">;
type GroupModelOut = OutputOf<"/models/group", "post">;
type GenerateModelIn = InputOf<"/models/generate", "post">;
type GenerateModelOut = OutputOf<"/models/generate", "post">;
type ProblemModelIn = InputOf<"/models/problem", "post">;
type ProblemModelOut = OutputOf<"/models/problem", "post">;
type ContextIn = InputOf<"/models/context", "post">;
type ContextOut = OutputOf<"/models/context", "post">;

/** ---- Direct fetch (no caching - source of truth) ---- */
const getModel = async (input: GetModelIn): Promise<GetModelOut> => {
  return api.post("/models/get", input, {
    cache: "no-store",
    headers: { "X-Bypass-Cache": "1" },
  });
};

/** ---- Strongly-typed server actions ---- */
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

async function generateModel(
  input: GenerateModelIn
): Promise<GenerateModelOut> {
  "use server";
  return api.post("/models/generate", input);
}

async function getModelGroupHistory(groupId: string): Promise<GroupModelOut> {
  "use server";
  return api.post("/models/group", { body: { group_id: groupId } } as GroupModelIn);
}

type GenerationsIn = InputOf<"/models/generations", "post">;
type GenerationsOut = OutputOf<"/models/generations", "post">;

async function searchModelGroups(query: string): Promise<GenerationsOut> {
  "use server";
  return api.post("/models/generations", { body: { search: query || null } } as GenerationsIn);
}

async function createModelProblem(input: ProblemModelIn): Promise<ProblemModelOut> {
  "use server";
  return api.post("/models/problem", input);
}

/** ---- Page metadata ---- */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ modelId: string }>;
}): Promise<Metadata> {
  const { modelId } = await params;
  const context = await api.post("/models/context", { body: { entity_id: modelId } } as ContextIn) as ContextOut;
  return {
    title: context.page_metadata?.detail.title,
    description: context.page_metadata?.detail.description,
  };
}

/** ---- Cookies ---- */
const SIDEBAR_COOKIE = "glow_sidebar";
const PANEL_COOKIE = "glow_panel";

/** ---- Server renders client with typed data and actions ---- */
export default async function ModelEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ modelId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { modelId } = await params;
  const session = await getSession();

  // Read UI preferences from cookies for SSR
  const cookieStore = await cookies();
  const sidebarCookie = cookieStore.get(SIDEBAR_COOKIE);
  const initialSidebarOpen = sidebarCookie ? sidebarCookie.value === "true" : undefined;
  const panelCookie = cookieStore.get(PANEL_COOKIE);
  const initialPanelOpen = panelCookie ? panelCookie.value === "true" : false;

  // Profile data for providers
  const context = await api.post("/models/context", { body: {} } as ContextIn) as ContextOut;
  const snapshot = buildSnapshot(session, context.profile);

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

  const modelSearchParams = {
    draftId: parseAsString,
  };
  const loadModelSearchParams = createLoader(modelSearchParams);
  const q = loadModelSearchParams(searchParamsObj);

  try {
    const input: GetModelIn = {
      body: {
        model_id: modelId,
        draft_id: q.draftId ?? null,
      },
    };

    const [model, context, draftsResult, groupResult] = await Promise.all([
      getModel(input),
      api.post("/models/context", { body: { entity_id: modelId } } as ContextIn) as Promise<ContextOut>,
      api.post("/models/drafts", {}),
      api.post("/models/group", { body: {} } as GroupModelIn),
    ]);

    const entityName = context.page_metadata?.detail.title;

    return (
      <DraftProviderClient drafts={draftsResult.entries ?? []}>
        <FullPageLayout
          profileData={context.profile}
          sessionSnapshot={snapshot}
          initialSidebarOpen={initialSidebarOpen}
          initialPanelOpen={initialPanelOpen}
          sidebarProps={{
            activeSection: "model",
            createFeedback: createModelProblem,
          }}
          breadcrumbs={[
            { title: "Intelligence", section: "intelligence", url: "/intelligence" },
            { title: "Models", section: "models", url: "/intelligence/models" },
            { title: entityName },
          ]}
          toolbar={<SaveToolbar />}
          panelProps={{
            artifactType: "model",
            groupId: (groupResult as GroupModelOut & { group_id?: string })?.group_id ?? null,
            generateAction: generateModel,
            permissions: [
              { artifact: "model", operation: "draft" },
              { artifact: "model", operation: "get" },
              { artifact: "model", operation: "docs" },
              { artifact: "model", operation: "group" },
            ],
            getGroupHistory: getModelGroupHistory,
            searchGroups: searchModelGroups,
          }}
        >
          <div
            className="space-y-6 px-4"
            data-page="model-edit"
            data-model-id={modelId}
          >
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
        </FullPageLayout>
      </DraftProviderClient>
    );
  } catch (error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "status" in error &&
      error.status === 403
    ) {
      return (
        <UnifiedAccessDenied
          reason="department"
          resourceType="model"
          redirectPath="/intelligence/models"
        />
      );
    }
    throw error;
  }
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
