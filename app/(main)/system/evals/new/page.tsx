/**
 * app/(main)/system/evals/new/page.tsx
 * New eval page — full SSR rendering with FullPageLayout.
 * @AshokSaravanan222
 * 01/26/2025
 */
import { getSession } from "@/auth";
import { UnifiedAccessDenied } from "@/components/common/layout/UnifiedAccessDenied";
import { FullPageLayout, type PanelProps } from "@/components/common/layout/FullPageLayout";
import { ArtifactToolbarActions } from "@/components/common/layout/ArtifactToolbarActions";
import { SaveToolbar } from "@/components/common/drafts/SaveToolbar";
import { DraftProviderClient } from "@/contexts/draft-context";
import Eval from "@/components/artifacts/eval/Eval";

import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import {
  createLoader,
  parseAsBoolean,
  parseAsString,
} from "nuqs/server";

import { buildSnapshot } from "@/lib/auth";

import { cache } from "react";
import { readGenerationPanelPrefs } from "@/lib/generation/panel-prefs";
/** ---- Strong types from OpenAPI ---- */
type GetEvalIn = InputOf<"/eval/get", "post">;
type GetEvalOut = OutputOf<"/eval/get", "post">;
type CreateEvalIn = InputOf<"/eval/create", "post">;
type CreateEvalOut = OutputOf<"/eval/create", "post">;
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

/** ---- Direct fetch (no caching - source of truth) ---- */
const getEvalDefault = async (input: GetEvalIn): Promise<GetEvalOut> => {
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

/** Export-all — used by the /new page's Download button to fetch
 *  the current full dataset as a CSV template. No per-item id
 *  since the user hasn't created the new artifact yet. Cast through
 *  ``unknown`` while openapi.json catches up to the file-modality
 *  response shape. */
async function exportEvals(): Promise<{
  file_id: string;
  file_name?: string;
}> {
  "use server";
  const result = (await api.post("/eval/export", {
    body: {},
  } as unknown as InputOf<"/eval/export", "post">)) as unknown as {
    file_id: string;
    file_name?: string;
  };
  return {
    file_id: result.file_id,
    ...(result.file_name !== undefined && { file_name: result.file_name }),
  };
}

async function refreshEvals(): Promise<unknown> {
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
const getEvalContext = cache(
  async (): Promise<ContextOut> =>
    api.post("/eval/context", { body: {} } as ContextIn) as Promise<ContextOut>,
);

/** ---- Page metadata ---- */
export async function generateMetadata(): Promise<Metadata> {
  try {
    const context = await getEvalContext();
    return {
      title: context.page_metadata?.new.title,
      description: context.page_metadata?.new.description,
    };
  } catch {
    return { title: "Evals" };
  }
}

/** ---- Cookies ---- */
const SIDEBAR_COOKIE = "glow_sidebar";
const PANEL_COOKIE = "glow_panel";

/** ---- Server renders client with typed data and actions ---- */
export default async function NewEvalPage({
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
    const context = await getEvalContext();
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

    // Fetch eval default data (for dropdowns and defaults) with draft_id and search params
    const input = {
      body: {
        id: null,
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
    const [evalDetailDefault, draftsResult, groupResult] = await Promise.all([
      getEvalDefault(input),
      api.post("/eval/drafts", {} as never),
      api.post(
        "/eval/group",
        { body: q.groupId ? { group_id: q.groupId } : {} } as GroupEvalIn,
      ),
    ]);

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
            { title: "New Eval" },
          ]}
          toolbar={
            <ArtifactToolbarActions
              leftSlot={<SaveToolbar />}
              exportAction={exportEvals}
              refreshAction={refreshEvals}
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
            data-page="eval-new"
            aria-label="Create new eval page"
          >
            <Eval
              evalDetailDefault={evalDetailDefault}
              createEvalAction={createEval}
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
            pathname="/system/evals/new"
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
  GetEvalIn as EvalNewIn,
  GetEvalOut as EvalNewOut,
  CreateEvalIn,
  CreateEvalOut,
  PatchEvalDraftIn,
  PatchEvalDraftOut,
};
