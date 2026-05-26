/**
 * app/(main)/training/scenarios/new/page.tsx
 * New scenario page — full SSR rendering with FullPageLayout.
 * Page owns all data fetching, server actions, and layout rendering.
 * @AshokSaravanan222 & @siladiea
 * 06/09/2025
 */

import { getSession } from "@/auth";
import { UnifiedAccessDenied } from "@/components/common/layout/UnifiedAccessDenied";
import { FullPageLayout, type PanelProps } from "@/components/common/layout/FullPageLayout";
import { ArtifactToolbarActions } from "@/components/common/layout/ArtifactToolbarActions";
import { SaveToolbar } from "@/components/common/drafts/SaveToolbar";
import { DraftProviderClient } from "@/contexts/draft-context";
import Scenario from "@/components/artifacts/scenario/Scenario";

import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import {
  csvToArray,
  extractFieldShowSelectedByParam,
  loadScenarioSearchParams,
} from "@/lib/search-params/scenarios";

import { buildSnapshot } from "@/lib/auth";

import { cache } from "react";
import { readGenerationPanelPrefs } from "@/lib/generation/panel-prefs";
/** ---- Strong types from OpenAPI ---- */
type GetScenarioIn = InputOf<"/scenario/get", "post">;
type GetScenarioOut = OutputOf<"/scenario/get", "post">;
type CreateScenarioIn = InputOf<"/scenario/create", "post">;
type CreateScenarioOut = OutputOf<"/scenario/create", "post">;
type PatchScenarioDraftIn = InputOf<"/scenario/draft", "post">;
type PatchScenarioDraftOut = OutputOf<"/scenario/draft", "post">;
type GroupScenarioIn = InputOf<"/scenario/group", "post">;
type GroupScenarioOut = OutputOf<"/scenario/group", "post">;
type ProblemScenarioIn = InputOf<"/scenario/problem", "post">;
type ProblemScenarioOut = OutputOf<"/scenario/problem", "post">;
type ContextIn = InputOf<"/scenario/context", "post">;
type ContextOut = OutputOf<"/scenario/context", "post">;

async function getScenario(input: GetScenarioIn): Promise<GetScenarioOut> {
  "use server";
  return api.post("/scenario/get", input);
}

async function createScenario(input: CreateScenarioIn): Promise<CreateScenarioOut> {
  "use server";
  return api.post("/scenario/create", input);
}

async function patchScenarioDraft(
  input: PatchScenarioDraftIn
): Promise<PatchScenarioDraftOut> {
  "use server";
  return api.post("/scenario/draft", input);
}

async function getScenarioGroupHistory(groupId: string): Promise<GroupScenarioOut> {
  "use server";
  return api.post("/scenario/group", { body: { group_id: groupId } } as GroupScenarioIn);
}

type GenerationsIn = InputOf<"/scenario/generations", "post">;
type GenerationsOut = OutputOf<"/scenario/generations", "post">;

async function searchScenarioGroups(query: string): Promise<GenerationsOut> {
  "use server";
  return api.post("/scenario/generations", { body: { search: query || null } } as GenerationsIn);
}

/** ---- GenerationPanel server actions ---- */
async function getScenarioGroup(input: GroupScenarioIn): Promise<GroupScenarioOut> {
  "use server";
  return api.post("/scenario/group", input);
}

async function searchScenarioGenerations(input: GenerationsIn): Promise<GenerationsOut> {
  "use server";
  return api.post("/scenario/generations", input);
}


async function createScenarioProblem(input: ProblemScenarioIn): Promise<ProblemScenarioOut> {
  "use server";
  return api.post("/scenario/problem", input);
}

/** Export-all — used by the /new page's Download button to fetch
 *  the current full dataset as a CSV template. No per-item id
 *  since the user hasn't created the new artifact yet. Cast through
 *  ``unknown`` while openapi.json catches up to the file-modality
 *  response shape. */
async function exportScenarios(): Promise<{
  file_id: string;
  file_name?: string;
}> {
  "use server";
  const result = (await api.post("/scenario/export", {
    body: {},
  } as unknown as InputOf<"/scenario/export", "post">)) as unknown as {
    file_id: string;
    file_name?: string;
  };
  return {
    file_id: result.file_id,
    ...(result.file_name !== undefined && { file_name: result.file_name }),
  };
}

async function refreshScenarios(): Promise<unknown> {
  "use server";
  return api.post("/scenario/refresh", {
    body: {},
  } as unknown as InputOf<"/scenario/refresh", "post">);
}

/** ---- Request-scoped context fetch ----
 * Wrapped in React's ``cache()`` so ``generateMetadata`` and the page
 * component share one network call per request. Server-only; not a
 * cross-request cache. */
const getScenarioContext = cache(
  async (): Promise<ContextOut> =>
    api.post("/scenario/context", { body: {} } as ContextIn) as Promise<ContextOut>,
);

/** ---- Page metadata ---- */
export async function generateMetadata(): Promise<Metadata> {
  try {
    const context = await getScenarioContext();
    return {
      title: context.page_metadata?.new.title,
      description: context.page_metadata?.new.description,
    };
  } catch {
    return { title: "Scenarios" };
  }
}

/** ---- Cookies ---- */
const SIDEBAR_COOKIE = "glow_sidebar";
const PANEL_COOKIE = "glow_panel";

export default async function NewScenarioPage({
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
    // Profile data for providers (until /scenarios/context returns full profile)
    const context = await getScenarioContext();
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

    // Load typed search params using nuqs
    const q = loadScenarioSearchParams(searchParamsObj);

    // Extract dynamic params (not handled by nuqs parsers)
    const fieldShowSelectedByParam =
      extractFieldShowSelectedByParam(searchParamsObj);

    // Fetch default scenario detail server-side with filter params
    const parameterIds = csvToArray(q.parameterIds);

    const [scenarioDetailDefault, draftsResult, groupResult] = await Promise.all([
      getScenario({
      body: {
        id: null,
        draft_id: q.draftId ?? null,
        mcp: false,
        descriptions: q.descriptionSearch ? {
          search: q.descriptionSearch,
        } : undefined,
        personas: q.personaSearch || q.personaShowSelected ? {
          search: q.personaSearch ?? undefined,
          selected: q.personaShowSelected ?? undefined,
        } : undefined,
        documents: q.documentSearch || q.documentShowSelected ? {
          search: q.documentSearch ?? undefined,
          selected: q.documentShowSelected ?? undefined,
        } : undefined,
        parameters: q.parameterSearch || q.parameterShowSelected ? {
          search: q.parameterSearch ?? undefined,
          selected: q.parameterShowSelected ?? undefined,
        } : undefined,
        problem_statements: q.problemStatementSearch ? {
          search: q.problemStatementSearch,
        } : undefined,
        images: q.imageSearch ? {
          search: q.imageSearch,
        } : undefined,
        videos: q.videoSearch ? {
          search: q.videoSearch,
        } : undefined,
        parameter_fields: fieldShowSelectedByParam || parameterIds ? {
          selected: fieldShowSelectedByParam ? Object.entries(fieldShowSelectedByParam).map(
            ([parameter_id, show_selected]) => ({ parameter_id, show_selected })
          ) : undefined,
          parameter_ids: parameterIds ?? undefined,
        } : undefined,
      } as GetScenarioIn["body"],
    }),
      api.post("/scenario/drafts", { body: { page_limit: 50, page_offset: 0 } }),
      api.post(
        "/scenario/group",
        { body: q.groupId ? { group_id: q.groupId } : {} } as GroupScenarioIn,
      ),
    ]);

    return (
      <DraftProviderClient drafts={draftsResult.entries ?? []}>
        <FullPageLayout
          profileData={context.profile}
          sessionSnapshot={snapshot}
          initialSidebarOpen={initialSidebarOpen}
          initialPanelOpen={initialPanelOpen}
          sidebarProps={{
            activeSection: "scenario",
            createFeedback: createScenarioProblem,
          }}
          breadcrumbs={[
            { title: "Training", section: "training", url: "/training" },
            { title: "Scenarios", section: "scenarios", url: "/training/scenarios" },
            { title: "New Scenario" },
          ]}
          toolbar={
            <ArtifactToolbarActions
              leftSlot={<SaveToolbar />}
              exportAction={exportScenarios}
              refreshAction={refreshScenarios}
              bffDownloadPrefix="/api/scenario/download"
            />
          }
          panelProps={{
            artifactType: "scenario",
          initialPanelPrefs: await readGenerationPanelPrefs(),
            groupId: (groupResult as GroupScenarioOut & { group_id?: string })?.group_id ?? null,
            groupName:
              (groupResult as GroupScenarioOut & { name?: string | null })?.name ?? null,
            // Forward the full SSR-fetched group payload — the panel
            // seeds historicalMessages from this synchronously and
            // skips the duplicate client-side /<art>/group refetch
            // on first paint, eliminating the hydration flicker.
            initialGroupHistory: groupResult as Record<string, unknown>,
            operations: ["draft", "get", "title", "generate"],
            getGroupHistory: getScenarioGroupHistory,
            searchGroups: searchScenarioGroups,
            prompts: context.prompts?.prompts,
            getGroupAction: getScenarioGroup as PanelProps["getGroupAction"],
            searchGenerationsAction:
              searchScenarioGenerations as PanelProps["searchGenerationsAction"],
          }}
        >
          <div
            className="space-y-6 px-4"
            data-page="scenario-new"
            aria-label="Create new scenario page"
          >
            <Scenario
              scenarioDetailDefault={scenarioDetailDefault}
              groupId={
                (groupResult as GroupScenarioOut & { group_id?: string })
                  ?.group_id ?? null
              }
              createScenarioAction={createScenario}
              patchScenarioDraftAction={patchScenarioDraft}
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
            pathname="/training/scenarios/new"
          />
        );
      }
      if (error.status === 403) {
        return (
          <UnifiedAccessDenied
            reason="department"
            resourceType="scenario"
            redirectPath="/training/scenarios"
          />
        );
      }
    }
    throw error;
  }
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  GetScenarioIn,
  GetScenarioOut,
  PatchScenarioDraftIn,
  PatchScenarioDraftOut,
  CreateScenarioIn,
  CreateScenarioOut,
};
