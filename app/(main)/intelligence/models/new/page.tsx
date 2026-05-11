/**
 * app/(main)/intelligence/models/new/page.tsx
 * New model page — full SSR rendering with FullPageLayout.
 * Page owns all data fetching, server actions, and layout rendering.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import { getSession } from "@/auth";
import { FullPageLayout } from "@/components/common/layout/FullPageLayout";
import { ArtifactToolbarActions } from "@/components/common/layout/ArtifactToolbarActions";
import { SaveToolbar } from "@/components/common/drafts/SaveToolbar";
import { DraftProviderClient } from "@/contexts/draft-context";
import Model from "@/components/artifacts/model/Model";

import { UnifiedAccessDenied } from "@/components/common/layout/UnifiedAccessDenied";

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
type PatchModelDraftIn = InputOf<"/model/draft", "post">;
type PatchModelDraftOut = OutputOf<"/model/draft", "post">;
type GroupModelIn = InputOf<"/model/group", "post">;
type GroupModelOut = OutputOf<"/model/group", "post">;
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
  return api.post("/model/draft", input);
}

async function createModelProblem(input: ProblemModelIn): Promise<ProblemModelOut> {
  "use server";
  return api.post("/model/problem", input);
}

/** Export-all — used by the /new page's Download button to fetch
 *  the current full dataset as a CSV template. No per-item id
 *  since the user hasn't created the new artifact yet. Cast through
 *  ``unknown`` while openapi.json catches up to the file-modality
 *  response shape. */
async function exportModels(): Promise<{
  file_id: string;
  file_name?: string;
}> {
  "use server";
  const result = (await api.post("/model/export", {
    body: {},
  } as unknown as InputOf<"/model/export", "post">)) as unknown as {
    file_id: string;
    file_name?: string;
  };
  return {
    file_id: result.file_id,
    ...(result.file_name !== undefined && { file_name: result.file_name }),
  };
}

async function refreshModels(): Promise<unknown> {
  "use server";
  return api.post("/model/refresh", {
    body: {},
  } as unknown as InputOf<"/model/refresh", "post">);
}

/** ---- Request-scoped context fetch ----
 * Wrapped in React's ``cache()`` so ``generateMetadata`` and the page
 * component share one network call per request. Server-only; not a
 * cross-request cache. */
const getModelContext = cache(
  async (): Promise<ContextOut> =>
    api.post("/model/context", { body: {} } as ContextIn) as Promise<ContextOut>,
);

/** ---- Page metadata ---- */
export async function generateMetadata(): Promise<Metadata> {
  try {
    const context = await getModelContext();
    return {
      title: context.page_metadata?.new.title,
      description: context.page_metadata?.new.description,
    };
  } catch {
    return { title: "Models" };
  }
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

  try {
    // Profile data for providers
    const context = await getModelContext();
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

    // Fetch default model data with draft_id (model_id = null for new mode)
    const input = {
      body: {
        id: null,
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
    const [modelDetailDefault, draftsResult, groupResult] = await Promise.all([
      getModelDetailDefault(input),
      api.post("/model/drafts", {} as any),
      api.post("/model/group", { body: {} } as GroupModelIn),
    ]);

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
            { title: "New Model" },
          ]}
          toolbar={
            <ArtifactToolbarActions
              leftSlot={<SaveToolbar />}
              exportAction={exportModels}
              refreshAction={refreshModels}
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
          <div className="space-y-6 px-4" data-page="model-new" aria-label="Create new model page">
            <Model
              modelDetailDefault={modelDetailDefault}
              createModelAction={createModel}
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
            pathname="/intelligence/models/new"
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
};
