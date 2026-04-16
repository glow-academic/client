/**
 * app/(main)/system/evals/[evalId]/page.tsx
 * Eval detail/edit page — full SSR rendering with FullPageLayout.
 * @AshokSaravanan222
 * 01/26/2025
 */

import { getSession } from "@/auth";
import { UnifiedAccessDenied } from "@/components/common/layout/UnifiedAccessDenied";
import { FullPageLayout } from "@/components/common/layout/FullPageLayout";
import { SaveToolbar } from "@/components/common/drafts/SaveToolbar";
import Eval from "@/components/artifacts/eval/Eval";
import { DraftProviderClient } from "@/contexts/draft-context";

import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { createLoader, parseAsBoolean, parseAsString } from "nuqs/server";

import { buildSnapshot } from "@/lib/auth";

/** ---- Strong types from OpenAPI ---- */
type GetEvalIn = InputOf<"/eval/get", "post">;
type GetEvalOut = OutputOf<"/eval/get", "post">;
type CreateEvalIn = InputOf<"/eval/create", "post">;
type CreateEvalOut = OutputOf<"/eval/create", "post">;
type UpdateEvalIn = InputOf<"/eval/update", "post">;
type UpdateEvalOut = OutputOf<"/eval/update", "post">;
type PatchEvalDraftIn = InputOf<"/eval/draft", "patch">;
type PatchEvalDraftOut = OutputOf<"/eval/draft", "patch">;
type GroupEvalIn = InputOf<"/eval/group", "post">;
type GroupEvalOut = OutputOf<"/eval/group", "post">;
type GenerateEvalIn = InputOf<"/eval/generate", "post">;
type GenerateEvalOut = OutputOf<"/eval/generate", "post">;
type GenerationsIn = InputOf<"/eval/generations", "post">;
type GenerationsOut = OutputOf<"/eval/generations", "post">;
type ProblemEvalIn = InputOf<"/eval/problem", "post">;
type ProblemEvalOut = OutputOf<"/eval/problem", "post">;
type ContextIn = InputOf<"/eval/context", "post">;
type ContextOut = OutputOf<"/eval/context", "post">;
// Note: Run/stop eval functionality moved to websocket events (evals_start, evals_stop)

/** ---- Direct fetch for eval detail ---- */
const getEvalDetail = async (input: GetEvalIn): Promise<GetEvalOut> => {
  return api.post("/eval/get", input, {
    cache: "no-store",
    headers: {
      "X-Bypass-Cache": "1",
    },
  });
};

/** ---- Strongly-typed server actions ---- */
async function createEval(input: CreateEvalIn): Promise<CreateEvalOut> {
  "use server";
  return api.post("/eval/create", input);
}

async function updateEval(input: UpdateEvalIn): Promise<UpdateEvalOut> {
  "use server";
  return api.post("/eval/update", input);
}

async function patchEvalDraft(
  input: PatchEvalDraftIn
): Promise<PatchEvalDraftOut> {
  "use server";
  return api.patch("/eval/draft", input);
}

async function generateEval(
  input: GenerateEvalIn
): Promise<GenerateEvalOut> {
  "use server";
  return api.post("/eval/generate", input);
}

async function getEvalGroupHistory(groupId: string): Promise<GroupEvalOut> {
  "use server";
  return api.post("/eval/group", { body: { group_id: groupId } } as GroupEvalIn);
}

async function searchEvalGroups(query: string): Promise<GenerationsOut> {
  "use server";
  return api.post("/eval/generations", { body: { search: query || null } } as GenerationsIn);
}

async function createEvalProblem(input: ProblemEvalIn): Promise<ProblemEvalOut> {
  "use server";
  return api.post("/eval/problem", input);
}

/** ---- Page metadata ---- */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ evalId: string }>;
}): Promise<Metadata> {
  try {
    const { evalId } = await params;
    const context = await api.post("/eval/context", { body: { entity_id: evalId } } as ContextIn) as ContextOut;
    return {
      title: context.page_metadata?.detail.title,
      description: context.page_metadata?.detail.description,
    };
  } catch {
    return { title: "Evals" };
  }
}

/** ---- Cookies ---- */
const SIDEBAR_COOKIE = "glow_sidebar";
const PANEL_COOKIE = "glow_panel";

/** ---- Server renders client with typed data and actions ---- */
export default async function EvalDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ evalId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { evalId } = await params;
  const session = await getSession();

  // Read UI preferences from cookies for SSR
  const cookieStore = await cookies();
  const sidebarCookie = cookieStore.get(SIDEBAR_COOKIE);
  const initialSidebarOpen = sidebarCookie ? sidebarCookie.value === "true" : undefined;
  const panelCookie = cookieStore.get(PANEL_COOKIE);
  const initialPanelOpen = panelCookie ? panelCookie.value === "true" : false;

  // Profile data for providers
  const context = await api.post("/eval/context", { body: {} } as ContextIn) as ContextOut;
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

  // Inline server-side parsers for eval search params
  const evalSearchParams = {
    draftId: parseAsString,
    agentSearch: parseAsString,
    agentShowSelected: parseAsBoolean,
    modelRunSearch: parseAsString,
    modelRunShowSelected: parseAsBoolean,
    groupSearch: parseAsString,
    groupShowSelected: parseAsBoolean,
  };
  const loadEvalSearchParams = createLoader(evalSearchParams);
  const q = loadEvalSearchParams(searchParamsObj);

  try {
    // Fetch eval detail with draft_id and search params
    const input: GetEvalIn = {
      body: {
        eval_id: evalId, // Provided for detail mode
        draft_id: q.draftId ?? null,
        agent_search: q.agentSearch ?? null,
        group_search: q.groupSearch ?? null,
        // Note: available_model_runs_search uses modelRunSearch from URL
        available_model_runs_search: q.modelRunSearch ?? null,
      } as GetEvalIn["body"],
    };
    const [evalDetail, context, draftsResult, groupResult] = await Promise.all([
      getEvalDetail(input),
      api.post("/eval/context", { body: { entity_id: evalId } } as ContextIn) as Promise<ContextOut>,
      api.post("/eval/drafts", {}),
      api.post("/eval/group", { body: {} } as GroupEvalIn),
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
            activeSection: "eval",
            createFeedback: createEvalProblem,
          }}
          breadcrumbs={[
            { title: "System", section: "system", url: "/system" },
            { title: "Evals", section: "evals", url: "/system/evals" },
            { title: entityName },
          ]}
          toolbar={<SaveToolbar />}
          panelProps={{
            artifactType: "eval",
            groupId: (groupResult as GroupEvalOut & { group_id?: string })?.group_id ?? null,
            generateAction: generateEval,
            operations: ["draft", "get", "group"],
            getGroupHistory: getEvalGroupHistory,
            searchGroups: searchEvalGroups,
            prompts: context.prompts?.prompts,
          }}
        >
          <div
            className="space-y-6 px-4"
            data-page="eval-edit"
            aria-label="Edit eval page"
          >
            <Eval
              evalId={evalId}
              evalDetail={evalDetail}
              createEvalAction={createEval}
              updateEvalAction={updateEval}
              patchEvalDraftAction={patchEvalDraft}
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
          resourceType="eval"
          redirectPath="/system/evals"
        />
      );
    }
    throw error;
  }
}

/** ---- Export types for client component ---- */
export type {
  GetEvalIn as EvalDetailIn,
  GetEvalOut as EvalDetailOut,
  PatchEvalDraftIn,
  PatchEvalDraftOut,
  CreateEvalIn,
  CreateEvalOut,
  UpdateEvalIn,
  UpdateEvalOut,
};
