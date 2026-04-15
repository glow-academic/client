/**
 * app/(main)/intelligence/tools/[toolId]/page.tsx
 * Tool edit page — full SSR rendering with FullPageLayout.
 * Page owns all data fetching, server actions, and layout rendering.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import { getSession } from "@/auth";
import { UnifiedAccessDenied } from "@/components/common/layout/UnifiedAccessDenied";
import { FullPageLayout } from "@/components/common/layout/FullPageLayout";
import { SaveToolbar } from "@/components/common/drafts/SaveToolbar";
import Tool from "@/components/artifacts/tool/Tool";
import { DraftProviderClient } from "@/contexts/draft-context";

import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { createLoader, parseAsString } from "nuqs/server";

import { getLayoutContextData } from "@/app/(main)/layout-server";

/** ---- Strong types from OpenAPI ---- */
type GetToolIn = InputOf<"/tools/get", "post">;
type GetToolOut = OutputOf<"/tools/get", "post">;
type CreateToolIn = InputOf<"/tools/create", "post">;
type CreateToolOut = OutputOf<"/tools/create", "post">;
type UpdateToolIn = InputOf<"/tools/update", "post">;
type UpdateToolOut = OutputOf<"/tools/update", "post">;
type PatchToolDraftIn = InputOf<"/tools/draft", "patch">;
type PatchToolDraftOut = OutputOf<"/tools/draft", "patch">;
type CreateDraftArgsIn = InputOf<"/api/v5/resources/args", "post">;
type CreateDraftArgsOut = OutputOf<"/api/v5/resources/args", "post">;
type CreateDraftArgsOutputsIn = InputOf<
  "/api/v5/resources/args_outputs",
  "post"
>;
type CreateDraftArgsOutputsOut = OutputOf<
  "/api/v5/resources/args_outputs",
  "post"
>;
type CreateDraftArgPositionsIn = InputOf<
  "/api/v5/resources/arg_positions",
  "post"
>;
type CreateDraftArgPositionsOut = OutputOf<
  "/api/v5/resources/arg_positions",
  "post"
>;
type GroupToolIn = InputOf<"/tools/group", "post">;
type GroupToolOut = OutputOf<"/tools/group", "post">;
type GenerateToolIn = InputOf<"/tools/generate", "post">;
type GenerateToolOut = OutputOf<"/tools/generate", "post">;
type ProblemToolIn = InputOf<"/tools/problem", "post">;
type ProblemToolOut = OutputOf<"/tools/problem", "post">;
type ContextIn = InputOf<"/tools/context", "post">;
type ContextOut = OutputOf<"/tools/context", "post">;

/** ---- Direct fetch (no caching - source of truth) ----
 * Always bypass cache to ensure fresh data for detail/edit pages.
 */
const getTool = async (input: GetToolIn): Promise<GetToolOut> => {
  return api.post("/tools/get", input, {
    cache: "no-store",
    headers: {
      "X-Bypass-Cache": "1",
    },
  });
};

/** ---- Strongly-typed server actions ---- */
async function createTool(input: CreateToolIn): Promise<CreateToolOut> {
  "use server";
  return api.post("/tools/create", input);
}

async function updateTool(input: UpdateToolIn): Promise<UpdateToolOut> {
  "use server";
  return api.post("/tools/update", input);
}

async function patchToolDraft(
  input: PatchToolDraftIn
): Promise<PatchToolDraftOut> {
  "use server";
  return api.patch("/tools/draft", input);
}

async function createDraftArgs(
  input: CreateDraftArgsIn
): Promise<CreateDraftArgsOut> {
  "use server";
  return api.post("/resources/args", input);
}

async function createDraftArgsOutputs(
  input: CreateDraftArgsOutputsIn
): Promise<CreateDraftArgsOutputsOut> {
  "use server";
  return api.post("/resources/args_outputs", input);
}

async function createDraftArgPositions(
  input: CreateDraftArgPositionsIn
): Promise<CreateDraftArgPositionsOut> {
  "use server";
  return api.post("/resources/arg_positions", input);
}

async function generateTool(
  input: GenerateToolIn
): Promise<GenerateToolOut> {
  "use server";
  return api.post("/tools/generate", input);
}

async function getToolGroupHistory(groupId: string): Promise<GroupToolOut> {
  "use server";
  return api.post("/tools/group", { body: { group_id: groupId } } as GroupToolIn);
}

type GenerationsIn = InputOf<"/tools/generations", "post">;
type GenerationsOut = OutputOf<"/tools/generations", "post">;

async function searchToolGroups(query: string): Promise<GenerationsOut> {
  "use server";
  return api.post("/tools/generations", { body: { search: query || null } } as GenerationsIn);
}

async function createToolProblem(input: ProblemToolIn): Promise<ProblemToolOut> {
  "use server";
  return api.post("/tools/problem", input);
}

/** ---- Page metadata ---- */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ toolId: string }>;
}): Promise<Metadata> {
  const { toolId } = await params;
  const context = await api.post("/tools/context", { body: { entity_id: toolId } } as ContextIn) as ContextOut;
  return {
    title: context.page_metadata?.detail.title,
    description: context.page_metadata?.detail.description,
  };
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

  // Inline server-side parsers for tool search params
  const toolSearchParams = {
    draftId: parseAsString,
  };
  const loadToolSearchParams = createLoader(toolSearchParams);
  const q = loadToolSearchParams(searchParamsObj);

  // Fetch tool detail with draft_id
  try {
    const input: GetToolIn = {
      body: {
        tool_id: toolId,
        draft_id: q.draftId ?? null,
      } as GetToolIn["body"],
    };
    const [toolDetail, context, draftsResult, groupResult] = await Promise.all([
      getTool(input),
      api.post("/tools/context", { body: { entity_id: toolId } } as ContextIn) as Promise<ContextOut>,
      api.post("/tools/drafts", {}),
      api.post("/tools/group", { body: {} } as GroupToolIn),
    ]);

    // Check access
    if (!toolDetail.tool_exists) {
      return <UnifiedAccessDenied reason="route-denied" />;
    }

    const entityName = context.page_metadata?.detail.title;

    return (
      <DraftProviderClient drafts={draftsResult.entries ?? []}>
        <FullPageLayout
          profileData={profileData}
          sessionSnapshot={snapshot}
          initialSidebarOpen={initialSidebarOpen}
          initialPanelOpen={initialPanelOpen}
          sidebarProps={{
            activeSection: "tool",
            createFeedback: createToolProblem,
          }}
          breadcrumbs={[
            { title: "Intelligence", section: "intelligence", url: "/intelligence" },
            { title: "Tools", section: "tools", url: "/intelligence/tools" },
            { title: entityName },
          ]}
          toolbar={<SaveToolbar />}
          panelProps={{
            artifactType: "tool",
            groupId: (groupResult as GroupToolOut & { group_id?: string })?.group_id ?? null,
            generateAction: generateTool,
            permissions: [
              { artifact: "tool", operation: "draft" },
              { artifact: "tool", operation: "get" },
              { artifact: "tool", operation: "docs" },
              { artifact: "tool", operation: "group" },
            ],
            getGroupHistory: getToolGroupHistory,
            searchGroups: searchToolGroups,
          }}
        >
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
              createArgsAction={createDraftArgs}
              createArgPositionsAction={createDraftArgPositions}
              createArgsOutputsAction={createDraftArgsOutputs}
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
      error.status === 404
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
