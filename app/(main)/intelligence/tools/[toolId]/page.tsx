/**
 * app/(main)/intelligence/tools/[toolId]/page.tsx
 * Tool edit page — full SSR rendering with FullPageLayout.
 * Page owns all data fetching, server actions, and layout rendering.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import { getSession } from "@/auth";
import { UnifiedAccessDenied } from "@/components/common/layout/UnifiedAccessDenied";
import { ArtifactToolbarActions } from "@/components/common/layout/ArtifactToolbarActions";
import { FullPageLayout, type PanelProps } from "@/components/common/layout/FullPageLayout";
import { SaveToolbar } from "@/components/common/drafts/SaveToolbar";
import Tool from "@/components/artifacts/tool/Tool";
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
type GetToolIn = InputOf<"/tool/get", "post">;
type GetToolOut = OutputOf<"/tool/get", "post">;
type CreateToolIn = InputOf<"/tool/create", "post">;
type CreateToolOut = OutputOf<"/tool/create", "post">;
type UpdateToolIn = InputOf<"/tool/update", "post">;
type UpdateToolOut = OutputOf<"/tool/update", "post">;
type PatchToolDraftIn = InputOf<"/tool/draft", "post">;
type PatchToolDraftOut = OutputOf<"/tool/draft", "post">;

type GroupToolIn = InputOf<"/tool/group", "post">;
type GroupToolOut = OutputOf<"/tool/group", "post">;
type ProblemToolIn = InputOf<"/tool/problem", "post">;
type ProblemToolOut = OutputOf<"/tool/problem", "post">;
type ContextIn = InputOf<"/tool/context", "post">;
type ContextOut = OutputOf<"/tool/context", "post">;
type PreviewToolIn = InputOf<"/tool/preview", "post">;
type PreviewToolOut = OutputOf<"/tool/preview", "post">;

/** ---- Direct fetch (no caching - source of truth) ----
 * Always bypass cache to ensure fresh data for detail/edit pages.
 */
const getTool = async (input: GetToolIn): Promise<GetToolOut> => {
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

async function updateTool(input: UpdateToolIn): Promise<UpdateToolOut> {
  "use server";
  return api.post("/tool/update", input);
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

/** Per-item export — scopes to a single ``tool_id`` so the AI
 *  consumer downstream only sees the row the user is editing. */
async function exportToolById(toolId: string): Promise<{
  file_id: string;
  file_name?: string;
}> {
  "use server";
  const result = (await api.post("/tool/export", {
    body: { tool_id: toolId },
  } as unknown as InputOf<"/tool/export", "post">)) as unknown as {
    file_id: string;
    file_name?: string;
  };
  return {
    file_id: result.file_id,
    ...(result.file_name !== undefined && { file_name: result.file_name }),
  };
}

async function refreshTool(): Promise<unknown> {
  "use server";
  return api.post("/tool/refresh", {
    body: {},
  } as unknown as InputOf<"/tool/refresh", "post">);
}

async function previewTool(input: PreviewToolIn): Promise<PreviewToolOut> {
  "use server";
  return api.post("/tool/preview", input);
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
const getToolContextById = cache(
  async (id: string): Promise<ContextOut> =>
    api.post("/tool/context", { body: { entity_id: id } } as ContextIn) as Promise<ContextOut>,
);

/** ---- Page metadata ---- */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ toolId: string }>;
}): Promise<Metadata> {
  try {
    const { toolId } = await params;
    const context = await getToolContextById(toolId);
    return {
      title: context.page_metadata?.detail.title,
      description: context.page_metadata?.detail.description,
    };
  } catch {
    return { title: "Tools" };
  }
}

/** ---- Cookies ---- */
const SIDEBAR_COOKIE = "glow_sidebar";
const PANEL_COOKIE = "glow_panel";

/** ---- Server renders client with typed data and actions ---- */
export default async function ToolDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ toolId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { toolId } = await params;
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

  // Fetch tool detail with draft_id
  try {
    const input = {
      body: {
        id: toolId,
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
    const [toolDetail, context, draftsResult, groupResult] = await Promise.all([
      getTool(input),
      getToolContextById(toolId) as Promise<ContextOut>,
      api.post("/tool/drafts", { body: {} } as any),
      api.post(
        "/tool/group",
        { body: q.groupId ? { group_id: q.groupId } : {} } as GroupToolIn,
      ),
    ]);

    // Check access
    if (!toolDetail.tool_exists) {
      return <UnifiedAccessDenied reason="route-denied" />;
    }

    const snapshot = buildSnapshot(session, context.profile);
    const entityName = context.page_metadata?.detail.title;

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
        { title: entityName ?? "Tool" },
      ],
      toolbar: (
        <ArtifactToolbarActions
          leftSlot={<SaveToolbar />}
          exportAction={exportToolById.bind(null, toolId)}
          refreshAction={refreshTool}
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
            data-page="tool-edit"
            data-tool-id={toolId}
            aria-label="Edit tool page"
          >
            <Tool
              toolId={toolId}
              toolData={toolDetail}
              createToolAction={createTool}
              updateToolAction={updateTool}
              patchToolDraftAction={patchToolDraft}
              previewToolAction={previewTool}
            />
          </div>
        </FullPageLayout>
      </DraftProviderClient>
    );
  } catch (error: unknown) {
    // Check if it's a 404 error (tool not found)
    if (
      error &&
      typeof error === "object" &&
      "status" in error &&
      (error.status === 401 || error.status === 404)
    ) {
      return (
        <UnifiedAccessDenied
          reason="route-denied"
          redirectPath="/intelligence/tools"
        />
      );
    }
    // Re-throw other errors
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
  UpdateToolIn,
  UpdateToolOut,
};
