/**
 * app/(main)/intelligence/tools/new/page.tsx
 * New tool page — full SSR rendering with FullPageLayout.
 * Page owns all data fetching, server actions, and layout rendering.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import { getSession } from "@/auth";
import { FullPageLayout } from "@/components/common/layout/FullPageLayout";
import { SaveToolbar } from "@/components/common/drafts/SaveToolbar";
import { DraftProviderClient } from "@/contexts/draft-context";
import Tool from "@/components/artifacts/tool/Tool";

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
 * Always bypass cache to ensure fresh data for new pages.
 */
const getToolDefault = async (input: GetToolIn): Promise<GetToolOut> => {
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
export async function generateMetadata(): Promise<Metadata> {
  const context = await api.post("/tools/context", { body: {} } as ContextIn) as ContextOut;
  return {
    title: context.page_metadata?.new.title,
    description: context.page_metadata?.new.description,
  };
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

  // Profile data for providers
  const { profileData, snapshot } = await getLayoutContextData(session);

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
  };
  const loadToolSearchParams = createLoader(toolSearchParams);
  const q = loadToolSearchParams(searchParamsObj);

  // Fetch tool default data (for dropdowns and defaults) with draft_id
  const input: GetToolIn = {
    body: {
      tool_id: null,
      draft_id: q.draftId ?? null,
    } as GetToolIn["body"],
  };
  const [toolDetailDefault, draftsResult, groupResult] = await Promise.all([
    getToolDefault(input),
    api.post("/tools/drafts", {}),
    api.post("/tools/group", { body: {} } as GroupToolIn),
  ]);

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
          { title: "New Tool" },
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
          data-page="tool-new"
          aria-label="Create new tool page"
        >
          <Tool
            key={q.draftId || "no-draft"}
            toolData={toolDetailDefault}
            createToolAction={createTool}
            patchToolDraftAction={patchToolDraft}
            createArgsAction={createDraftArgs}
            createArgPositionsAction={createDraftArgPositions}
            createArgsOutputsAction={createDraftArgsOutputs}
          />
        </div>
      </FullPageLayout>
    </DraftProviderClient>
  );
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
