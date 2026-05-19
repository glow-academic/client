/**
 * app/(main)/training/simulations/new/page.tsx
 * New simulation page — full SSR rendering with FullPageLayout.
 * Page owns all data fetching, server actions, and layout rendering.
 * @AshokSaravanan222 & @siladiea
 * 01/12/2026
 */

import { getSession } from "@/auth";
import { UnifiedAccessDenied } from "@/components/common/layout/UnifiedAccessDenied";
import { FullPageLayout, type PanelProps } from "@/components/common/layout/FullPageLayout";
import { ArtifactToolbarActions } from "@/components/common/layout/ArtifactToolbarActions";
import { SaveToolbar } from "@/components/common/drafts/SaveToolbar";
import Simulation from "@/components/artifacts/simulation/Simulation";
import { DraftProviderClient } from "@/contexts/draft-context";

import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { createLoader, parseAsBoolean, parseAsString } from "nuqs/server";

import { buildSnapshot } from "@/lib/auth";

import { cache } from "react";
import { readGenerationPanelPrefs } from "@/lib/generation/panel-prefs";
/** ---- Strong types from OpenAPI ---- */
type GetSimulationIn = InputOf<"/simulation/get", "post">;
type GetSimulationOut = OutputOf<"/simulation/get", "post">;
type CreateSimulationIn = InputOf<"/simulation/create", "post">;
type CreateSimulationOut = OutputOf<"/simulation/create", "post">;
type PatchSimulationDraftIn = InputOf<"/simulation/draft", "post">;
type PatchSimulationDraftOut = OutputOf<"/simulation/draft", "post">;
type GroupSimulationIn = InputOf<"/simulation/group", "post">;
type GroupSimulationOut = OutputOf<"/simulation/group", "post">;
type ProblemSimulationIn = InputOf<"/simulation/problem", "post">;
type ProblemSimulationOut = OutputOf<"/simulation/problem", "post">;
type ContextIn = InputOf<"/simulation/context", "post">;
type ContextOut = OutputOf<"/simulation/context", "post">;

/** ---- Direct fetch (no caching - source of truth) ---- */
const getSimulationDefault = async (
  input: GetSimulationIn
): Promise<GetSimulationOut> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const result = await api.post("/simulation/get", input, {
      cache: "no-store",
      headers: {
        "X-Bypass-Cache": "1",
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return result;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Request timeout: Server took too long to respond");
    }
    throw error;
  }
};

/** ---- Strongly-typed server actions ---- */
async function createSimulation(
  input: CreateSimulationIn
): Promise<CreateSimulationOut> {
  "use server";
  return api.post("/simulation/create", input);
}

async function patchSimulationDraft(
  input: PatchSimulationDraftIn
): Promise<PatchSimulationDraftOut> {
  "use server";
  return api.post("/simulation/draft", input);
}

/** Export-all — used by the /new page's Download button to fetch
 *  the current full dataset as a CSV template. No per-item id
 *  since the user hasn't created the new artifact yet. Cast through
 *  ``unknown`` while openapi.json catches up to the file-modality
 *  response shape. */
async function exportSimulations(): Promise<{
  file_id: string;
  file_name?: string;
}> {
  "use server";
  const result = (await api.post("/simulation/export", {
    body: {},
  } as unknown as InputOf<"/simulation/export", "post">)) as unknown as {
    file_id: string;
    file_name?: string;
  };
  return {
    file_id: result.file_id,
    ...(result.file_name !== undefined && { file_name: result.file_name }),
  };
}

async function refreshSimulations(): Promise<unknown> {
  "use server";
  return api.post("/simulation/refresh", {
    body: {},
  } as unknown as InputOf<"/simulation/refresh", "post">);
}


async function getSimulationGroupHistory(groupId: string): Promise<GroupSimulationOut> {
  "use server";
  return api.post("/simulation/group", { body: { group_id: groupId } } as GroupSimulationIn);
}

type GenerationsIn = InputOf<"/simulation/generations", "post">;
type GenerationsOut = OutputOf<"/simulation/generations", "post">;

async function searchSimulationGroups(query: string): Promise<GenerationsOut> {
  "use server";
  return api.post("/simulation/generations", { body: { search: query || null } } as GenerationsIn);
}

/** ---- GenerationPanel server actions ---- */
async function getSimulationGroup(input: GroupSimulationIn): Promise<GroupSimulationOut> {
  "use server";
  return api.post("/simulation/group", input);
}

async function searchSimulationGenerations(input: GenerationsIn): Promise<GenerationsOut> {
  "use server";
  return api.post("/simulation/generations", input);
}


async function createSimulationProblem(input: ProblemSimulationIn): Promise<ProblemSimulationOut> {
  "use server";
  return api.post("/simulation/problem", input);
}

/** ---- Request-scoped context fetch ----
 * Wrapped in React's ``cache()`` so ``generateMetadata`` and the page
 * component share one network call per request. Server-only; not a
 * cross-request cache. */
const getSimulationContext = cache(
  async (): Promise<ContextOut> =>
    api.post("/simulation/context", { body: {} } as ContextIn) as Promise<ContextOut>,
);

/** ---- Page metadata ---- */
export async function generateMetadata(): Promise<Metadata> {
  try {
    const context = await getSimulationContext();
    return {
      title: context.page_metadata?.new.title,
      description: context.page_metadata?.new.description,
    };
  } catch {
    return { title: "Simulations" };
  }
}

/** ---- Cookies ---- */
const SIDEBAR_COOKIE = "glow_sidebar";
const PANEL_COOKIE = "glow_panel";

export default async function NewSimulationPage({
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

  const simulationSearchParams = {
    draftId: parseAsString,
    scenarioSearch: parseAsString,
    scenarioShowSelected: parseAsBoolean,
    groupId: parseAsString,
    groupSearch: parseAsString,
  };
  const loadSimulationSearchParams = createLoader(simulationSearchParams);
  const q = loadSimulationSearchParams(searchParamsObj);

  // Fetch default simulation detail server-side with filter params and draft_id
  const input = {
    body: {
      id: null,
      draft_id: q.draftId ?? null,
      scenarios:
        q.scenarioSearch || q.scenarioShowSelected
          ? {
              search: q.scenarioSearch ?? undefined,
              selected: q.scenarioShowSelected ?? undefined,
            }
          : undefined,
    } as GetSimulationIn["body"],
  } as GetSimulationIn;

  try {
    // Profile data for providers
    const context = await getSimulationContext();
    const snapshot = buildSnapshot(session, context.profile);

    const draftsResult = await api.post("/simulation/drafts", { body: {} } as never);
    const simulationDataDefault = await getSimulationDefault(input);

    const groupResult = await api.post(
      "/simulation/group",
      { body: q.groupId ? { group_id: q.groupId } : {} } as GroupSimulationIn,
    );

    return (
      <DraftProviderClient drafts={(draftsResult.entries ?? []) as never}>
        <FullPageLayout
          profileData={context.profile}
          sessionSnapshot={snapshot}
          {...(initialSidebarOpen !== undefined ? { initialSidebarOpen } : {})}
          initialPanelOpen={initialPanelOpen}
          sidebarProps={{
            activeSection: "simulation",
            createFeedback: createSimulationProblem,
          } as never}
          breadcrumbs={[
            { title: "Training", section: "training", url: "/training" },
            { title: "Simulations", section: "simulations", url: "/training/simulations" },
            { title: "New Simulation" },
          ]}
          toolbar={
            <ArtifactToolbarActions
              leftSlot={<SaveToolbar />}
              exportAction={exportSimulations}
              refreshAction={refreshSimulations}
              bffDownloadPrefix="/api/simulation/download"
            />
          }
          panelProps={{
            artifactType: "simulation",
          initialPanelPrefs: await readGenerationPanelPrefs(),
            groupId: (groupResult as GroupSimulationOut & { group_id?: string })?.group_id ?? null,
            groupName:
              (groupResult as GroupSimulationOut & { name?: string | null })?.name ?? null,
            // Forward the full SSR-fetched group payload — the panel
            // seeds historicalMessages from this synchronously and
            // skips the duplicate client-side /<art>/group refetch
            // on first paint, eliminating the hydration flicker.
            initialGroupHistory: groupResult as Record<string, unknown>,
            operations: ["draft", "get", "title"],
            getGroupHistory: getSimulationGroupHistory,
            searchGroups: searchSimulationGroups,
            prompts: context.prompts?.prompts,
            getGroupAction: getSimulationGroup as PanelProps["getGroupAction"],
            searchGenerationsAction:
              searchSimulationGenerations as PanelProps["searchGenerationsAction"],
          } as never}
        >
          <div
            className="space-y-6 px-4"
            data-page="simulation-new"
            aria-label="Create new simulation page"
          >
            <Simulation
              simulationData={simulationDataDefault}
              createSimulationAction={createSimulation}
              patchSimulationDraftAction={patchSimulationDraft}
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
            pathname="/training/simulations/new"
          />
        );
      }
      if (error.status === 403) {
        return (
          <UnifiedAccessDenied
            reason="department"
            resourceType="simulation"
            redirectPath="/training/simulations"
          />
        );
      }
    }
    throw error;
  }
}
