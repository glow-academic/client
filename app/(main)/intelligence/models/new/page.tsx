/**
 * app/(main)/intelligence/models/new/page.tsx
 * New model page — full SSR rendering with FullPageLayout.
 * Page owns all data fetching, server actions, and layout rendering.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import { getSession } from "@/auth";
import { FullPageLayout } from "@/components/common/layout/FullPageLayout";
import { SaveToolbar } from "@/components/common/drafts/SaveToolbar";
import { DraftProviderClient } from "@/contexts/draft-context";
import Model from "@/components/artifacts/model/Model";

import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { createLoader, parseAsString } from "nuqs/server";

import { buildSnapshot } from "@/lib/auth";

/** ---- Strong types from OpenAPI ---- */
type GetModelIn = InputOf<"/model/get", "post">;
type GetModelOut = OutputOf<"/model/get", "post">;
type CreateModelIn = InputOf<"/model/create", "post">;
type CreateModelOut = OutputOf<"/model/create", "post">;
type PatchModelDraftIn = InputOf<"/model/draft", "patch">;
type PatchModelDraftOut = OutputOf<"/model/draft", "patch">;
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
type GroupModelIn = InputOf<"/model/group", "post">;
type GroupModelOut = OutputOf<"/model/group", "post">;
type GenerateModelIn = InputOf<"/model/generate", "post">;
type GenerateModelOut = OutputOf<"/model/generate", "post">;
type ProblemModelIn = InputOf<"/model/problem", "post">;
type ProblemModelOut = OutputOf<"/model/problem", "post">;
type ContextIn = InputOf<"/model/context", "post">;
type ContextOut = OutputOf<"/model/context", "post">;

/** ---- Direct fetch for default model data (provider mapping for picker) ---- */
const getModelDetailDefault = async (
  input: GetModelIn
): Promise<GetModelOut> => {
  return api.post("/model/get", input, {
    cache: "no-store",
    headers: { "X-Bypass-Cache": "1" },
  });
};

/** ---- Strongly-typed server actions ---- */
async function createModel(input: CreateModelIn): Promise<CreateModelOut> {
  "use server";
  return api.post("/model/create", input);
}

async function patchModelDraft(
  input: PatchModelDraftIn
): Promise<PatchModelDraftOut> {
  "use server";
  return api.patch("/model/draft", input);
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
  return api.post("/model/generate", input);
}

async function getModelGroupHistory(groupId: string): Promise<GroupModelOut> {
  "use server";
  return api.post("/model/group", { body: { group_id: groupId } } as GroupModelIn);
}

type GenerationsIn = InputOf<"/model/generations", "post">;
type GenerationsOut = OutputOf<"/model/generations", "post">;

async function searchModelGroups(query: string): Promise<GenerationsOut> {
  "use server";
  return api.post("/model/generations", { body: { search: query || null } } as GenerationsIn);
}

async function createModelProblem(input: ProblemModelIn): Promise<ProblemModelOut> {
  "use server";
  return api.post("/model/problem", input);
}

/** ---- Page metadata ---- */
export async function generateMetadata(): Promise<Metadata> {
  const context = await api.post("/model/context", { body: {} } as ContextIn) as ContextOut;
  return {
    title: context.page_metadata?.new.title,
    description: context.page_metadata?.new.description,
  };
}

/** ---- Cookies ---- */
const SIDEBAR_COOKIE = "glow_sidebar";
const PANEL_COOKIE = "glow_panel";

/** ---- Server renders client with typed data and actions ---- */
export default async function NewModelPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await getSession();

  // Read UI preferences from cookies for SSR
  const cookieStore = await cookies();
  const sidebarCookie = cookieStore.get(SIDEBAR_COOKIE);
  const initialSidebarOpen = sidebarCookie ? sidebarCookie.value === "true" : undefined;
  const panelCookie = cookieStore.get(PANEL_COOKIE);
  const initialPanelOpen = panelCookie ? panelCookie.value === "true" : false;

  // Profile data for providers
  const context = await api.post("/model/context", { body: {} } as ContextIn) as ContextOut;
  const snapshot = buildSnapshot(session, context.profile);

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
  const [modelDetailDefault, draftsResult, groupResult] = await Promise.all([
    getModelDetailDefault(input),
    api.post("/model/drafts", {}),
    api.post("/model/group", { body: {} } as GroupModelIn),
  ]);

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
          { title: "New Model" },
        ]}
        toolbar={<SaveToolbar />}
        panelProps={{
          artifactType: "model",
          groupId: (groupResult as GroupModelOut & { group_id?: string })?.group_id ?? null,
          generateAction: generateModel,
          operations: ["draft", "get", "group"],
          getGroupHistory: getModelGroupHistory,
          searchGroups: searchModelGroups,
          prompts: context.prompts?.prompts,
        }}
      >
        <div className="space-y-6 px-4" data-page="model-new" aria-label="Create new model page">
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
      </FullPageLayout>
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
