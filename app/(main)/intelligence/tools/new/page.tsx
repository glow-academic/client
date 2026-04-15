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

import { buildSnapshot } from "@/lib/auth";

/** ---- Strong types from OpenAPI ---- */
type GetToolIn = InputOf<"/tool/get", "post">;
type GetToolOut = OutputOf<"/tool/get", "post">;
type CreateToolIn = InputOf<"/tool/create", "post">;
type CreateToolOut = OutputOf<"/tool/create", "post">;
type PatchToolDraftIn = InputOf<"/tool/draft", "patch">;
type PatchToolDraftOut = OutputOf<"/tool/draft", "patch">;
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
type GroupToolIn = InputOf<"/tool/group", "post">;
type GroupToolOut = OutputOf<"/tool/group", "post">;
type GenerateToolIn = InputOf<"/tool/generate", "post">;
type GenerateToolOut = OutputOf<"/tool/generate", "post">;
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
  return api.patch("/tool/draft", input);
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
  return api.post("/tool/generate", input);
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

/** ---- Page metadata ---- */
export async function generateMetadata(): Promise<Metadata> {
  const context = await api.post("/tool/context", { body: {} } as ContextIn) as ContextOut;
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
  const context = await api.post("/tool/context", { body: {} } as ContextIn) as ContextOut;
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
    api.post("/tool/drafts", {}),
    api.post("/tool/group", { body: {} } as GroupToolIn),
  ]);

  return (
    <DraftProviderClient drafts={draftsResult.entries ?? []}>
      <FullPageLayout
        profileData={context.profile}
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
          operations: ["draft", "get", "group"],
          getGroupHistory: getToolGroupHistory,
          searchGroups: searchToolGroups,
          prompts: context.prompts?.prompts,
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
