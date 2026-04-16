/**
 * app/(main)/training/scenarios/new/page.tsx
 * New scenario page — full SSR rendering with FullPageLayout.
 * Page owns all data fetching, server actions, and layout rendering.
 * @AshokSaravanan222 & @siladiea
 * 06/09/2025
 */

import { getSession } from "@/auth";
import { UnifiedAccessDenied } from "@/components/common/layout/UnifiedAccessDenied";
import { FullPageLayout } from "@/components/common/layout/FullPageLayout";
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

/** ---- Strong types from OpenAPI ---- */
type GetScenarioIn = InputOf<"/scenario/get", "post">;
type GetScenarioOut = OutputOf<"/scenario/get", "post">;
type CreateScenarioIn = InputOf<"/scenario/create", "post">;
type CreateScenarioOut = OutputOf<"/scenario/create", "post">;
type PatchScenarioDraftIn = InputOf<"/scenario/draft", "patch">;
type PatchScenarioDraftOut = OutputOf<"/scenario/draft", "patch">;
type GroupScenarioIn = InputOf<"/scenario/group", "post">;
type GroupScenarioOut = OutputOf<"/scenario/group", "post">;
type GenerateScenarioIn = InputOf<"/scenario/generate", "post">;
type GenerateScenarioOut = OutputOf<"/scenario/generate", "post">;
type ProblemScenarioIn = InputOf<"/scenario/problem", "post">;
type ProblemScenarioOut = OutputOf<"/scenario/problem", "post">;
type ContextIn = InputOf<"/scenario/context", "post">;
type ContextOut = OutputOf<"/scenario/context", "post">;

/** Upload action result — matches the interface expected by resource components */
type UploadResult = { success: boolean; upload_id?: string; message?: string };

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
  return api.patch("/scenario/draft", input);
}

async function uploadFile(formData: FormData): Promise<UploadResult> {
  "use server";
  try {
    const file = formData.get("file") as File | null;
    if (!file) return { success: false, message: "No file provided" };

    const { getAuthHeaders } = await import("@/lib/api/auth-headers");
    const { INTERNAL_HTTP_BASE } = await import("@/lib/api/config");
    const authHeaders = await getAuthHeaders();

    const response = await fetch(`${INTERNAL_HTTP_BASE}/v5/scenarios/upload`, {
      method: "POST",
      headers: {
        ...authHeaders,
        "Content-Type": file.type || "application/octet-stream",
        "X-Filename": file.name,
      },
      body: Buffer.from(await file.arrayBuffer()),
    });

    if (!response.ok) {
      const text = await response.text();
      return { success: false, message: text || "Upload failed" };
    }

    const result = await response.json();
    return { success: true, upload_id: result.upload_id };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed";
    return { success: false, message };
  }
}

async function generateScenario(
  input: GenerateScenarioIn
): Promise<GenerateScenarioOut> {
  "use server";
  return api.post("/scenario/generate", input);
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

async function createScenarioProblem(input: ProblemScenarioIn): Promise<ProblemScenarioOut> {
  "use server";
  return api.post("/scenario/problem", input);
}

/** ---- Page metadata ---- */
export async function generateMetadata(): Promise<Metadata> {
  try {
    const context = await api.post("/scenario/context", { body: {} } as ContextIn) as ContextOut;
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
    const context = await api.post("/scenario/context", { body: {} } as ContextIn) as ContextOut;
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
        videos: q.videoSearch || q.videoEnabled === false ? {
          search: q.videoSearch ?? undefined,
          include: q.videoEnabled ?? undefined,
        } : undefined,
        objectives: q.objectivesEnabled === false ? {
          include: false,
        } : undefined,
        questions: q.questionsEnabled === false ? {
          include: false,
        } : undefined,
        parameter_fields: fieldShowSelectedByParam || parameterIds ? {
          selected: fieldShowSelectedByParam ? Object.entries(fieldShowSelectedByParam).map(
            ([parameter_id, show_selected]) => ({ parameter_id, show_selected })
          ) : undefined,
          parameter_ids: parameterIds ?? undefined,
        } : undefined,
      } as GetScenarioIn["body"],
    }),
      api.post("/scenario/drafts", {}),
      api.post("/scenario/group", { body: {} } as GroupScenarioIn),
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
          toolbar={<SaveToolbar />}
          panelProps={{
            artifactType: "scenario",
            groupId: (groupResult as GroupScenarioOut & { group_id?: string })?.group_id ?? null,
            generateAction: generateScenario,
            operations: ["draft", "get", "group"],
            getGroupHistory: getScenarioGroupHistory,
            searchGroups: searchScenarioGroups,
            prompts: context.prompts?.prompts,
          }}
        >
          <div
            className="space-y-6 px-4"
            data-page="scenario-new"
            aria-label="Create new scenario page"
          >
            <Scenario
              scenarioDetailDefault={scenarioDetailDefault}
              createScenarioAction={createScenario}
              patchScenarioDraftAction={patchScenarioDraft}
              uploadBasePath="/scenario"
              uploadFileAction={uploadFile}
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
          reason="not-logged-in"
          pathname="/training/scenarios/new"
        />
      );
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
