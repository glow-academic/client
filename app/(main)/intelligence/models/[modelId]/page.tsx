/**
 * app/(main)/intelligence/models/[modelId]/page.tsx
 * Model edit page — full SSR rendering with FullPageLayout.
 * Page owns all data fetching, server actions, and layout rendering.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import { getSession } from "@/auth";
import { UnifiedAccessDenied } from "@/components/common/layout/UnifiedAccessDenied";
import { ArtifactToolbarActions } from "@/components/common/layout/ArtifactToolbarActions";
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

import { cache } from "react";
import { readGenerationPanelPrefs } from "@/lib/generation/panel-prefs";
/** ---- Strong types from OpenAPI ---- */
type GetModelIn = InputOf<"/model/get", "post">;
type GetModelOut = OutputOf<"/model/get", "post">;
type CreateModelIn = InputOf<"/model/create", "post">;
type CreateModelOut = OutputOf<"/model/create", "post">;
type UpdateModelIn = InputOf<"/model/update", "post">;
type UpdateModelOut = OutputOf<"/model/update", "post">;
type PatchModelDraftIn = InputOf<"/model/draft", "post">;
type PatchModelDraftOut = OutputOf<"/model/draft", "post">;
type GroupModelIn = InputOf<"/model/group", "post">;
type GroupModelOut = OutputOf<"/model/group", "post">;
type ProblemModelIn = InputOf<"/model/problem", "post">;
type ProblemModelOut = OutputOf<"/model/problem", "post">;
type ContextIn = InputOf<"/model/context", "post">;
type ContextOut = OutputOf<"/model/context", "post">;

/** ---- Direct fetch (no caching - source of truth) ---- */
const getModel = async (input: GetModelIn): Promise<GetModelOut> => {
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

async function updateModel(input: UpdateModelIn): Promise<UpdateModelOut> {
  "use server";
  return api.post("/model/update", input);
}

async function patchModelDraft(
  input: PatchModelDraftIn
): Promise<PatchModelDraftOut> {
  "use server";
  return api.post("/model/draft", input);
}

async function createModelProblem(input: ProblemModelIn): Promise<ProblemModelOut> {
  "use server";
  return api.post("/model/problem", input);
}

/** Per-item export — scopes to a single ``model_id`` so the AI
 *  consumer downstream only sees the row the user is editing. */
async function exportModelById(modelId: string): Promise<{
  file_id: string;
  file_name?: string;
}> {
  "use server";
  const result = (await api.post("/model/export", {
    body: { model_id: modelId },
  } as unknown as InputOf<"/model/export", "post">)) as unknown as {
    file_id: string;
    file_name?: string;
  };
  return {
    file_id: result.file_id,
    ...(result.file_name !== undefined && { file_name: result.file_name }),
  };
}

async function refreshModel(): Promise<unknown> {
  "use server";
  return api.post("/model/refresh", {
    body: {},
  } as unknown as InputOf<"/model/refresh", "post">);
}

/** ---- Request-scoped context fetch ----
 * Wrapped in React's ``cache()`` so ``generateMetadata`` and the page
 * component share one network call per request. Server-only; not a
 * cross-request cache. */
const getModelContextById = cache(
  async (id: string): Promise<ContextOut> =>
    api.post("/model/context", { body: { entity_id: id } } as ContextIn) as Promise<ContextOut>,
);

/** ---- Page metadata ---- */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ modelId: string }>;
}): Promise<Metadata> {
  try {
    const { modelId } = await params;
    const context = await getModelContextById(modelId);
    return {
      title: context.page_metadata?.detail.title,
      description: context.page_metadata?.detail.description,
    };
  } catch {
    return { title: "Models" };
  }
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
    descriptionSearch: parseAsString,
    valueSearch: parseAsString,
    departmentSearch: parseAsString,
    modalitySearch: parseAsString,
    temperatureSearch: parseAsString,
    pricingSearch: parseAsString,
    reasoningSearch: parseAsString,
    voiceSearch: parseAsString,
    qualitySearch: parseAsString,
  };
  const loadModelSearchParams = createLoader(modelSearchParams);
  const q = loadModelSearchParams(searchParamsObj);

  try {
    const input = {
      body: {
        id: modelId,
        draft_id: q.draftId ?? null,
        descriptions: q.descriptionSearch ? { search: q.descriptionSearch } : undefined,
        values: q.valueSearch ? { search: q.valueSearch } : undefined,
        departments: q.departmentSearch ? { search: q.departmentSearch } : undefined,
        modalities: q.modalitySearch ? { search: q.modalitySearch } : undefined,
        temperature_levels: q.temperatureSearch ? { search: q.temperatureSearch } : undefined,
        pricing: q.pricingSearch ? { search: q.pricingSearch } : undefined,
        reasoning_levels: q.reasoningSearch ? { search: q.reasoningSearch } : undefined,
        voices: q.voiceSearch ? { search: q.voiceSearch } : undefined,
        qualities: q.qualitySearch ? { search: q.qualitySearch } : undefined,
      },
    } as unknown as GetModelIn;

    const [model, context, draftsResult, groupResult] = await Promise.all([
      getModel(input),
      getModelContextById(modelId) as Promise<ContextOut>,
      api.post("/model/drafts", { body: { page_limit: 50, page_offset: 0 } }),
      api.post("/model/group", { body: {} } as GroupModelIn),
    ]);

    const snapshot = buildSnapshot(session, context.profile);
    const entityName = context.page_metadata?.detail.title ?? "Model";

    return (
      <DraftProviderClient drafts={(draftsResult.entries ?? []) as any}>
        <FullPageLayout
          profileData={context.profile}
          sessionSnapshot={snapshot}
          {...(initialSidebarOpen !== undefined
            ? { initialSidebarOpen }
            : {})}
          {...(initialPanelOpen !== undefined ? { initialPanelOpen } : {})}
          sidebarProps={{
            activeSection: "model",
            createFeedback: createModelProblem as any,
          }}
          breadcrumbs={[
            { title: "Intelligence", section: "intelligence", url: "/intelligence" },
            { title: "Models", section: "models", url: "/intelligence/models" },
            { title: entityName },
          ]}
          toolbar={
            <ArtifactToolbarActions
              leftSlot={<SaveToolbar />}
              exportAction={exportModelById.bind(null, modelId)}
              refreshAction={refreshModel}
              bffDownloadPrefix="/api/model/download"
            />
          }
          panelProps={
            {
              artifactType: "model",
              initialPanelPrefs: await readGenerationPanelPrefs(),
              groupId:
                ((groupResult as GroupModelOut & { group_id?: string | null })?.group_id ??
                  null) as any,
              operations: ["draft", "get", "title"],
              ...(context.prompts?.prompts
                ? { prompts: context.prompts.prompts }
                : {}),
            } as any
          }
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
            />
          </div>
        </FullPageLayout>
      </DraftProviderClient>
    );
  } catch (error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "status" in error
    ) {
      // 401 → not logged in. 403 → resource belongs to a department the
      // user isn't in. Don't conflate.
      if (error.status === 401) {
        return (
          <UnifiedAccessDenied
            reason="not-logged-in"
            pathname={`/intelligence/models/${modelId}`}
          />
        );
      }
      if (error.status === 403) {
        return (
          <UnifiedAccessDenied
            reason="department"
            resourceType="model"
            redirectPath="/intelligence/models"
          />
        );
      }
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
};
