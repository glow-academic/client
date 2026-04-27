/**
 * app/(main)/training/simulations/[simulationId]/page.tsx
 * Simulation edit page — full SSR rendering with FullPageLayout.
 * Page owns all data fetching, server actions, and layout rendering.
 * @AshokSaravanan222 & @siladiea
 * 06/09/2025
 */

import { getSession } from "@/auth";
import { UnifiedAccessDenied } from "@/components/common/layout/UnifiedAccessDenied";
import { FullPageLayout, type PanelProps } from "@/components/common/layout/FullPageLayout";
import { SaveToolbar } from "@/components/common/drafts/SaveToolbar";
import Simulation from "@/components/artifacts/simulation/Simulation";
import { DraftProviderClient } from "@/contexts/draft-context";

import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { createLoader, parseAsBoolean, parseAsString } from "nuqs/server";

import { buildSnapshot } from "@/lib/auth";

/** ---- Strong types from OpenAPI ---- */
type GetSimulationIn = InputOf<"/simulation/get", "post">;
type GetSimulationOut = OutputOf<"/simulation/get", "post">;
type UpdateSimulationIn = InputOf<"/simulation/update", "post">;
type UpdateSimulationOut = OutputOf<"/simulation/update", "post">;
type PatchSimulationDraftIn = InputOf<"/simulation/draft", "patch">;
type PatchSimulationDraftOut = OutputOf<"/simulation/draft", "patch">;
type GroupSimulationIn = InputOf<"/simulation/group", "post">;
type GroupSimulationOut = OutputOf<"/simulation/group", "post">;
type GenerateSimulationIn = InputOf<"/simulation/generate", "post">;
type GenerateSimulationOut = OutputOf<"/simulation/generate", "post">;
type ProblemSimulationIn = InputOf<"/simulation/problem", "post">;
type ProblemSimulationOut = OutputOf<"/simulation/problem", "post">;
type ContextIn = InputOf<"/simulation/context", "post">;
type ContextOut = OutputOf<"/simulation/context", "post">;

// Export types for client component (type-only imports)
export type {
  PatchSimulationDraftIn,
  PatchSimulationDraftOut,
  UpdateSimulationIn,
  UpdateSimulationOut,
  GetSimulationOut as SimulationDataOut,
};

/** ---- Direct fetch (no caching - source of truth) ---- */
const getSimulation = async (
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
async function updateSimulation(
  input: UpdateSimulationIn
): Promise<UpdateSimulationOut> {
  "use server";
  return api.post("/simulation/update", input);
}

async function patchSimulationDraft(
  input: PatchSimulationDraftIn
): Promise<PatchSimulationDraftOut> {
  "use server";
  return api.patch("/simulation/draft", input);
}

async function generateSimulation(
  input: GenerateSimulationIn
): Promise<GenerateSimulationOut> {
  "use server";
  return api.post("/simulation/generate", input);
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

async function runSimulationGenerate(input: GenerateSimulationIn): Promise<GenerateSimulationOut> {
  "use server";
  return api.post("/simulation/generate", input);
}

async function createSimulationProblem(input: ProblemSimulationIn): Promise<ProblemSimulationOut> {
  "use server";
  return api.post("/simulation/problem", input);
}

/** ---- Page metadata ---- */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ simulationId: string }>;
}): Promise<Metadata> {
  try {
    const { simulationId } = await params;
    const context = await api.post("/simulation/context", { body: { entity_id: simulationId } } as ContextIn) as ContextOut;
    return {
      title: context.page_metadata?.detail.title,
      description: context.page_metadata?.detail.description,
    };
  } catch {
    return { title: "Simulations" };
  }
}

/** ---- Cookies ---- */
const SIDEBAR_COOKIE = "glow_sidebar";
const PANEL_COOKIE = "glow_panel";

/** ---- Server renders client with typed data and actions ---- */
export default async function EditSimulationPage({
  params,
  searchParams,
}: {
  params: Promise<{ simulationId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { simulationId } = await params;
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

  const simulationSearchParams = {
    draftId: parseAsString,
    scenarioSearch: parseAsString,
    scenarioShowSelected: parseAsBoolean,
    groupId: parseAsString,
    groupSearch: parseAsString,
  };
  const loadSimulationSearchParams = createLoader(simulationSearchParams);
  const q = loadSimulationSearchParams(searchParamsObj);

  try {
    const input = {
      body: {
        id: simulationId,
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

    const [simulationData, context, draftsResult, groupResult] = await Promise.all([
      getSimulation(input),
      api.post("/simulation/context", { body: { entity_id: simulationId } } as ContextIn) as Promise<ContextOut>,
      api.post("/simulation/drafts", {} as never),
      api.post(
        "/simulation/group",
        { body: q.groupId ? { group_id: q.groupId } : {} } as GroupSimulationIn,
      ),
    ]);

    const entityName = context.page_metadata?.detail.title;
    const snapshot = buildSnapshot(session, context.profile);

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
            { title: entityName ?? "Simulation" },
          ]}
          toolbar={<SaveToolbar />}
          panelProps={{
            artifactType: "simulation",
            groupId: (groupResult as GroupSimulationOut & { group_id?: string })?.group_id ?? null,
            groupName:
              (groupResult as GroupSimulationOut & { name?: string | null })?.name ?? null,
            // Forward the full SSR-fetched group payload — the panel
            // seeds historicalMessages from this synchronously and
            // skips the duplicate client-side /<art>/group refetch
            // on first paint, eliminating the hydration flicker.
            initialGroupHistory: groupResult as Record<string, unknown>,
            generateAction: generateSimulation,
            operations: ["draft", "get", "group"],
            getGroupHistory: getSimulationGroupHistory,
            searchGroups: searchSimulationGroups,
            prompts: context.prompts?.prompts,
            getGroupAction: getSimulationGroup as PanelProps["getGroupAction"],
            searchGenerationsAction:
              searchSimulationGenerations as PanelProps["searchGenerationsAction"],
            runGenerateAction: runSimulationGenerate as PanelProps["runGenerateAction"],
          } as never}
        >
          <div
            className="space-y-6 px-4"
            data-page="simulation-edit"
            data-simulation-id={simulationId}
          >
            <Simulation
              simulationId={simulationId}
              simulationData={simulationData}
              updateSimulationAction={updateSimulation}
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
      "status" in error &&
      (error.status === 401 || error.status === 403)
    ) {
      return (
        <UnifiedAccessDenied
          reason="department"
          resourceType="simulation"
          redirectPath="/training/simulations"
        />
      );
    }
    throw error;
  }
}
