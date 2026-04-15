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

import { getLayoutContextData } from "@/app/(main)/layout-server";

/** ---- Strong types from OpenAPI ---- */
type GetEvalIn = InputOf<"/evals/get", "post">;
type GetEvalOut = OutputOf<"/evals/get", "post">;
type CreateEvalIn = InputOf<"/evals/create", "post">;
type CreateEvalOut = OutputOf<"/evals/create", "post">;
type UpdateEvalIn = InputOf<"/evals/update", "post">;
type UpdateEvalOut = OutputOf<"/evals/update", "post">;
type PatchEvalDraftIn = InputOf<"/evals/draft", "patch">;
type PatchEvalDraftOut = OutputOf<"/evals/draft", "patch">;
type GroupEvalIn = InputOf<"/evals/group", "post">;
type GroupEvalOut = OutputOf<"/evals/group", "post">;
type GenerateEvalIn = InputOf<"/evals/generate", "post">;
type GenerateEvalOut = OutputOf<"/evals/generate", "post">;
type GenerationsIn = InputOf<"/evals/generations", "post">;
type GenerationsOut = OutputOf<"/evals/generations", "post">;
type ProblemEvalIn = InputOf<"/evals/problem", "post">;
type ProblemEvalOut = OutputOf<"/evals/problem", "post">;
type ContextIn = InputOf<"/evals/context", "post">;
type ContextOut = OutputOf<"/evals/context", "post">;
// Note: Run/stop eval functionality moved to websocket events (evals_start, evals_stop)

/** ---- Direct fetch for eval detail ---- */
const getEvalDetail = async (input: GetEvalIn): Promise<GetEvalOut> => {
  return api.post("/evals/get", input, {
    cache: "no-store",
    headers: {
      "X-Bypass-Cache": "1",
    },
  });
};

/** ---- Strongly-typed server actions ---- */
async function createEval(input: CreateEvalIn): Promise<CreateEvalOut> {
  "use server";
  return api.post("/evals/create", input);
}

async function updateEval(input: UpdateEvalIn): Promise<UpdateEvalOut> {
  "use server";
  return api.post("/evals/update", input);
}

async function patchEvalDraft(
  input: PatchEvalDraftIn
): Promise<PatchEvalDraftOut> {
  "use server";
  return api.patch("/evals/draft", input);
}

async function generateEval(
  input: GenerateEvalIn
): Promise<GenerateEvalOut> {
  "use server";
  return api.post("/evals/generate", input);
}

async function getEvalGroupHistory(groupId: string): Promise<GroupEvalOut> {
  "use server";
  return api.post("/evals/group", { body: { group_id: groupId } } as GroupEvalIn);
}

async function searchEvalGroups(query: string): Promise<GenerationsOut> {
  "use server";
  return api.post("/evals/generations", { body: { search: query || null } } as GenerationsIn);
}

async function createEvalProblem(input: ProblemEvalIn): Promise<ProblemEvalOut> {
  "use server";
  return api.post("/evals/problem", input);
}

/** ---- Page metadata ---- */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ evalId: string }>;
}): Promise<Metadata> {
  const { evalId } = await params;
  const context = await api.post("/evals/context", { body: { entity_id: evalId } } as ContextIn) as ContextOut;
  return {
    title: context.page_metadata?.detail.title,
    description: context.page_metadata?.detail.description,
  };
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
  const { profileData, snapshot } = await getLayoutContextData(session);

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
      api.post("/evals/context", { body: { entity_id: evalId } } as ContextIn) as Promise<ContextOut>,
      api.post("/evals/drafts", {}),
      api.post("/evals/group", { body: {} } as GroupEvalIn),
    ]);

    const entityName = context.page_metadata?.detail.title;

    return (
      <DraftProviderClient drafts={draftsResult.entries ?? []}>
        <FullPageLayout
          profileData={profileData}
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
            permissions: [
              { artifact: "eval", operation: "draft" },
              { artifact: "eval", operation: "get" },
              { artifact: "eval", operation: "docs" },
              { artifact: "eval", operation: "group" },
            ],
            getGroupHistory: getEvalGroupHistory,
            searchGroups: searchEvalGroups,
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
      error.status === 403
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
