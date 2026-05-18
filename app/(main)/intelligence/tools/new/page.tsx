/**
 * app/(main)/intelligence/tools/new/page.tsx
 * New tool page — full SSR rendering with FullPageLayout.
 * Page owns all data fetching, server actions, and layout rendering.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import { getSession } from "@/auth";
import { FullPageLayout, type PanelProps } from "@/components/common/layout/FullPageLayout";
import { ArtifactToolbarActions } from "@/components/common/layout/ArtifactToolbarActions";
import { SaveToolbar } from "@/components/common/drafts/SaveToolbar";
import { DraftProviderClient } from "@/contexts/draft-context";
import Tool from "@/components/artifacts/tool/Tool";

import { UnifiedAccessDenied } from "@/components/common/layout/UnifiedAccessDenied";

import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { createLoader, parseAsBoolean, parseAsString } from "nuqs/server";

import { buildSnapshot } from "@/lib/auth";

import { cache } from "react";
import { readGenerationPanelPrefs } from "@/lib/generation/panel-prefs";
/** ---- Strong types from OpenAPI ---- */
type GetToolIn = InputOf<"/tool/get", "post">;
type GetToolOut = OutputOf<"/tool/get", "post">;
type CreateToolIn = InputOf<"/tool/create", "post">;
type CreateToolOut = OutputOf<"/tool/create", "post">;
type PatchToolDraftIn = InputOf<"/tool/draft", "post">;
type PatchToolDraftOut = OutputOf<"/tool/draft", "post">;

type GroupToolIn = InputOf<"/tool/group", "post">;
type GroupToolOut = OutputOf<"/tool/group", "post">;
type ProblemToolIn = InputOf<"/tool/problem", "post">;
type ProblemToolOut = OutputOf<"/tool/problem", "post">;
type ContextIn = InputOf<"/tool/context", "post">;
type ContextOut = OutputOf<"/tool/context", "post">;

/** ---- Direct fetch (no caching - source of truth) ----
 * Always bypass cache to ensure fresh data for new pages.
 */
const getToolDefault = async (input: GetToolIn): Promise<GetToolOut> => {
  return api.post("/tool/get", input, {
    cache: "no-store",
    headers: {
      "X-Bypass-Cache": "1",
    },
  });
};

/** ---- Strongly-typed server actions ---- */
async function createTool(input: CreateToolIn): Promise<CreateToolOut> {
  "use server";
  return api.post("/tool/create", input);
}

async function patchToolDraft(
  input: PatchToolDraftIn
): Promise<PatchToolDraftOut> {
  "use server";
  return api.post("/tool/draft", input);
}



async function getToolGroupHistory(groupId: string): Promise<GroupToolOut> {
  "use server";
  return api.post("/tool/group", { body: { group_id: groupId } } as GroupToolIn);
}

type GenerationsIn = InputOf<"/tool/generations", "post">;
type GenerationsOut = OutputOf<"/tool/generations", "post">;

async function searchToolGroups(query: string): Promise<GenerationsOut> {
  "use server";
  return api.post("/tool/generations", { body: { search: query || null } } as GenerationsIn);
}

async function createToolProblem(input: ProblemToolIn): Promise<ProblemToolOut> {
  "use server";
  return api.post("/tool/problem", input);
}

/** Export-all — used by the /new page's Download button to fetch
 *  the current full dataset as a CSV template. No per-item id
 *  since the user hasn't created the new artifact yet. Cast through
 *  ``unknown`` while openapi.json catches up to the file-modality
 *  response shape. */
async function exportTools(): Promise<{
  file_id: string;
  file_name?: string;
}> {
  "use server";
  const result = (await api.post("/tool/export", {
    body: {},
  } as unknown as InputOf<"/tool/export", "post">)) as unknown as {
    file_id: string;
    file_name?: string;
  };
  return {
    file_id: result.file_id,
    ...(result.file_name !== undefined && { file_name: result.file_name }),
  };
}

async function refreshTools(): Promise<unknown> {
  "use server";
  return api.post("/tool/refresh", {
    body: {},
  } as unknown as InputOf<"/tool/refresh", "post">);
}

/** ---- GenerationPanel server actions ---- */
async function getToolGroup(input: GroupToolIn): Promise<GroupToolOut> {
  "use server";
  return api.post("/tool/group", input);
}

async function searchToolGenerations(input: GenerationsIn): Promise<GenerationsOut> {
  "use server";
  return api.post("/tool/generations", input);
}


/** ---- Request-scoped context fetch ----
 * Wrapped in React's ``cache()`` so ``generateMetadata`` and the page
 * component share one network call per request. Server-only; not a
 * cross-request cache. */
const getToolContext = cache(
  async (): Promise<ContextOut> =>
    api.post("/tool/context", { body: {} } as ContextIn) as Promise<ContextOut>,
);

/** ---- Page metadata ---- */
export async function generateMetadata(): Promise<Metadata> {
  try {
    const context = await getToolContext();
    return {
      title: context.page_metadata?.new.title,
      description: context.page_metadata?.new.description,
    };
  } catch {
    return { title: "Tools" };
  }
}

/** ---- Cookies ---- */
const SIDEBAR_COOKIE = "glow_sidebar";
const PANEL_COOKIE = "glow_panel";

/** ---- Server renders client with typed data and actions ---- */
export default async function NewToolPage({
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
    const context = await getToolContext();
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

    // Inline server-side parsers for tool search params
    const toolSearchParams = {
      draftId: parseAsString,
      argsSearch: parseAsString,
      argPositionsSearch: parseAsString,
      argsOutputsSearch: parseAsString,
      permissionsSearch: parseAsString,
      argsShowSelected: parseAsBoolean,
      argPositionsShowSelected: parseAsBoolean,
      argsOutputsShowSelected: parseAsBoolean,
      permissionsShowSelected: parseAsBoolean,
      groupId: parseAsString,
      groupSearch: parseAsString,
    };
    const loadToolSearchParams = createLoader(toolSearchParams);
    const q = loadToolSearchParams(searchParamsObj);

    // Fetch tool default data (for dropdowns and defaults) with draft_id
    const input = {
      body: {
        id: null,
        draft_id: q.draftId ?? null,
        args:
          q.argsSearch || q.argsShowSelected
            ? {
                search: q.argsSearch ?? undefined,
                selected: q.argsShowSelected ?? undefined,
              }
            : undefined,
        arg_positions:
          q.argPositionsSearch || q.argPositionsShowSelected
            ? {
                search: q.argPositionsSearch ?? undefined,
                selected: q.argPositionsShowSelected ?? undefined,
              }
            : undefined,
        args_outputs:
          q.argsOutputsSearch || q.argsOutputsShowSelected
            ? {
                search: q.argsOutputsSearch ?? undefined,
                selected: q.argsOutputsShowSelected ?? undefined,
              }
            : undefined,
        permissions:
          q.permissionsSearch || q.permissionsShowSelected
            ? {
                search: q.permissionsSearch ?? undefined,
                selected: q.permissionsShowSelected ?? undefined,
              }
            : undefined,
      },
    } as GetToolIn;
    const [toolDetailDefault, draftsResult, groupResult] = await Promise.all([
      getToolDefault(input),
      api.post("/tool/drafts", { body: {} } as any),
      api.post(
        "/tool/group",
        { body: q.groupId ? { group_id: q.groupId } : {} } as GroupToolIn,
      ),
    ]);

    const layoutProps = {
      profileData: context.profile,
      sessionSnapshot: snapshot,
      initialSidebarOpen,
      initialPanelOpen,
      sidebarProps: {
        activeSection: "tool",
        createFeedback: createToolProblem as any,
      },
      breadcrumbs: [
        { title: "Intelligence", section: "intelligence", url: "/intelligence" },
        { title: "Tools", section: "tools", url: "/intelligence/tools" },
        { title: "New Tool" },
      ],
      toolbar: (
        <ArtifactToolbarActions
          leftSlot={<SaveToolbar />}
          exportAction={exportTools}
          refreshAction={refreshTools}
          bffDownloadPrefix="/api/tool/download"
        />
      ),
      panelProps: {
        artifactType: "tool",
        initialPanelPrefs: await readGenerationPanelPrefs(),
        groupId: (groupResult as GroupToolOut & { group_id?: string })?.group_id ?? null,
        groupName:
          (groupResult as GroupToolOut & { name?: string | null })?.name ?? null,
        operations: ["draft", "get", "title"],
        getGroupHistory: getToolGroupHistory,
        searchGroups: searchToolGroups,
        prompts: context.prompts?.prompts,
        getGroupAction: getToolGroup as PanelProps["getGroupAction"],
        searchGenerationsAction:
          searchToolGenerations as PanelProps["searchGenerationsAction"],
      },
    } as any;

    return (
      <DraftProviderClient drafts={(draftsResult.entries ?? []) as any}>
        <FullPageLayout {...layoutProps}>
          <div
            className="space-y-6 px-4"
            data-page="tool-new"
            aria-label="Create new tool page"
          >
            <Tool
              toolData={toolDetailDefault}
              createToolAction={createTool}
              patchToolDraftAction={patchToolDraft}
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
            pathname="/intelligence/tools/new"
          />
        );
      }
      if (error.status === 403) {
        return (
          <UnifiedAccessDenied
            reason="department"
            resourceType="tool"
            redirectPath="/intelligence/tools"
          />
        );
      }
    }
    throw error;
  }
}

/** ---- Export types for client component ---- */
export type {
  GetToolIn,
  GetToolOut,
  PatchToolDraftIn,
  PatchToolDraftOut,
  CreateToolIn,
  CreateToolOut,
};
