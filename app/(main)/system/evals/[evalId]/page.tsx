/**
 * app/(main)/system/evals/[evalId]/page.tsx
 * Eval detail/edit page — full SSR rendering with FullPageLayout.
 * @AshokSaravanan222
 * 01/26/2025
 */

import { getSession } from "@/auth";
import { UnifiedAccessDenied } from "@/components/common/layout/UnifiedAccessDenied";
import { ArtifactToolbarActions } from "@/components/common/layout/ArtifactToolbarActions";
import { FullPageLayout, type PanelProps } from "@/components/common/layout/FullPageLayout";
import { SaveToolbar } from "@/components/common/drafts/SaveToolbar";
import Eval from "@/components/artifacts/eval/Eval";
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
type GetEvalIn = InputOf<"/eval/get", "post">;
type GetEvalOut = OutputOf<"/eval/get", "post">;
type CreateEvalIn = InputOf<"/eval/create", "post">;
type CreateEvalOut = OutputOf<"/eval/create", "post">;
type UpdateEvalIn = InputOf<"/eval/update", "post">;
type UpdateEvalOut = OutputOf<"/eval/update", "post">;
type PatchEvalDraftIn = InputOf<"/eval/draft", "post">;
type PatchEvalDraftOut = OutputOf<"/eval/draft", "post">;
type GroupEvalIn = InputOf<"/eval/group", "post">;
type GroupEvalOut = OutputOf<"/eval/group", "post">;
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
  return api.post("/eval/draft", input);
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

/** Per-item export — scopes to a single ``eval_id`` so the AI
 *  consumer downstream only sees the row the user is editing. */
async function exportEvalById(evalId: string): Promise<{
  file_id: string;
  file_name?: string;
}> {
  "use server";
  const result = (await api.post("/eval/export", {
    body: { eval_id: evalId },
  } as unknown as InputOf<"/eval/export", "post">)) as unknown as {
    file_id: string;
    file_name?: string;
  };
  return {
    file_id: result.file_id,
    ...(result.file_name !== undefined && { file_name: result.file_name }),
  };
}

async function refreshEval(): Promise<unknown> {
  "use server";
  return api.post("/eval/refresh", {
    body: {},
  } as unknown as InputOf<"/eval/refresh", "post">);
}

/** ---- GenerationPanel server actions ---- */
async function getEvalGroup(input: GroupEvalIn): Promise<GroupEvalOut> {
  "use server";
  return api.post("/eval/group", input);
}

async function searchEvalGenerations(input: GenerationsIn): Promise<GenerationsOut> {
  "use server";
  return api.post("/eval/generations", input);
}


/** ---- Request-scoped context fetch ----
 * Wrapped in React's ``cache()`` so ``generateMetadata`` and the page
 * component share one network call per request. Server-only; not a
 * cross-request cache. */
const getEvalContextById = cache(
  async (id: string): Promise<ContextOut> =>
    api.post("/eval/context", { body: { entity_id: id } } as ContextIn) as Promise<ContextOut>,
);

/** ---- Page metadata ---- */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ evalId: string }>;
}): Promise<Metadata> {
  try {
    const { evalId } = await params;
    const context = await getEvalContextById(evalId);
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
    modelSearch: parseAsString,
    modelShowSelected: parseAsBoolean,
    groupId: parseAsString,
    groupSearch: parseAsString,
  };
  const loadEvalSearchParams = createLoader(evalSearchParams);
  const q = loadEvalSearchParams(searchParamsObj);

  try {
    // Fetch eval detail with draft_id and search params
    const input = {
      body: {
        id: evalId,
        draft_id: q.draftId ?? null,
        models:
          q.modelSearch || q.modelShowSelected
            ? {
                search: q.modelSearch ?? undefined,
                selected: q.modelShowSelected ?? undefined,
              }
            : undefined,
      },
    } as unknown as GetEvalIn;
    const [evalDetail, context, draftsResult, groupResult] = await Promise.all([
      getEvalDetail(input),
      getEvalContextById(evalId) as Promise<ContextOut>,
      api.post("/eval/drafts", {} as never),
      api.post(
        "/eval/group",
        { body: q.groupId ? { group_id: q.groupId } : {} } as GroupEvalIn,
      ),
    ]);
    const snapshot = buildSnapshot(session, context.profile);

    const entityName = context.page_metadata?.detail.title;

    return (
      <DraftProviderClient drafts={(draftsResult.entries ?? []) as never}>
        <FullPageLayout
          profileData={context.profile}
          sessionSnapshot={snapshot}
          initialSidebarOpen={initialSidebarOpen ?? false}
          initialPanelOpen={initialPanelOpen}
          sidebarProps={{
            activeSection: "eval",
            createFeedback: createEvalProblem as never,
          }}
          breadcrumbs={[
            { title: "System", section: "system", url: "/system" },
            { title: "Evals", section: "evals", url: "/system/evals" },
            { title: entityName ?? "Eval" },
          ]}
          toolbar={
            <ArtifactToolbarActions
              leftSlot={<SaveToolbar />}
              exportAction={exportEvalById.bind(null, evalId)}
              refreshAction={refreshEval}
              bffDownloadPrefix="/api/eval/download"
            />
          }
          panelProps={{
            artifactType: "eval",
          initialPanelPrefs: await readGenerationPanelPrefs(),
            groupId:
              (groupResult as GroupEvalOut & { group_id?: string })?.group_id ??
              "",
            groupName:
              (groupResult as GroupEvalOut & { name?: string | null })?.name ?? null,
            // Forward the full SSR-fetched group payload — the panel
            // seeds historicalMessages from this synchronously and
            // skips the duplicate client-side /<art>/group refetch
            // on first paint, eliminating the hydration flicker.
            initialGroupHistory: groupResult as Record<string, unknown>,
            operations: ["draft", "get", "title"],
            getGroupHistory: getEvalGroupHistory,
            searchGroups: searchEvalGroups,
            ...(context.prompts?.prompts
              ? { prompts: context.prompts.prompts }
              : {}),
            getGroupAction: getEvalGroup as PanelProps["getGroupAction"],
            searchGenerationsAction:
              searchEvalGenerations as PanelProps["searchGenerationsAction"],
          } as never}
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
      "status" in error
    ) {
      // 401 → not logged in. 403 → resource belongs to a department the
      // user isn't in. Don't conflate.
      if (error.status === 401) {
        return (
          <UnifiedAccessDenied
            reason="not-logged-in"
            pathname={`/system/evals/${evalId}`}
          />
        );
      }
      if (error.status === 403) {
        return (
          <UnifiedAccessDenied
            reason="department"
            resourceType="eval"
            redirectPath="/system/evals"
          />
        );
      }
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
