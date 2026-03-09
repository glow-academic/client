/**
 * app/(main)/intelligence/tools/[toolId]/page.tsx
 * Tool detail/edit page (skeleton)
 */

import { UnifiedAccessDenied } from "@/components/common/layout/UnifiedAccessDenied";
import { PageHeader } from "@/components/common/layout/PageHeader";
import { SaveToolbar } from "@/components/common/drafts/SaveToolbar";
import Tool from "@/components/artifacts/tool/Tool";
import { DraftProviderClient } from "@/contexts/draft-context";
import { getDrafts, resolveGroupId } from "@/app/(main)/layout-server";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";
import { createLoader, parseAsString } from "nuqs/server";

/** ---- Strong types from OpenAPI ---- */
type GetToolIn = InputOf<"/api/v5/artifacts/tools/get", "post">;
type GetToolOut = OutputOf<"/api/v5/artifacts/tools/get", "post">;
type CreateToolIn = InputOf<"/api/v5/artifacts/tools/create", "post">;
type CreateToolOut = OutputOf<"/api/v5/artifacts/tools/create", "post">;
type UpdateToolIn = InputOf<"/api/v5/artifacts/tools/update", "post">;
type UpdateToolOut = OutputOf<"/api/v5/artifacts/tools/update", "post">;
type PatchToolDraftIn = InputOf<"/api/v5/artifacts/tools/draft", "patch">;
type PatchToolDraftOut = OutputOf<"/api/v5/artifacts/tools/draft", "patch">;
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

/** ---- Direct fetch (no caching - source of truth) ----
 * Always bypass cache to ensure fresh data for detail/edit pages.
 */
const getTool = async (input: GetToolIn): Promise<GetToolOut> => {
  return api.post("/artifacts/tools/get", input, {
    cache: "no-store",
    headers: {
      "X-Bypass-Cache": "1",
    },
  });
};

/** ---- Docs types for page metadata ---- */
type DocsIn = InputOf<"/api/v5/artifacts/tools/docs", "post">;
type DocsOut = OutputOf<"/api/v5/artifacts/tools/docs", "post">;

const getDocs = async (input: DocsIn): Promise<DocsOut> => {
  return api.post("/artifacts/tools/docs", input);
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ toolId: string }>;
}): Promise<Metadata> {
  const { toolId } = await params;
  const docs = await getDocs({ body: { entity_id: toolId } });
  return { title: docs.detail.title, description: docs.detail.description };
}

/** ---- Strongly-typed server actions ---- */
async function createTool(input: CreateToolIn): Promise<CreateToolOut> {
  "use server";
  return api.post("/artifacts/tools/create", input);
}

async function updateTool(input: UpdateToolIn): Promise<UpdateToolOut> {
  "use server";
  return api.post("/artifacts/tools/update", input);
}

async function patchToolDraft(
  input: PatchToolDraftIn
): Promise<PatchToolDraftOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  return api.patch("/artifacts/tools/draft", input);
}

async function createDraftArgs(
  input: CreateDraftArgsIn
): Promise<CreateDraftArgsOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  return api.post("/resources/args", input);
}

async function createDraftArgsOutputs(
  input: CreateDraftArgsOutputsIn
): Promise<CreateDraftArgsOutputsOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  return api.post("/resources/args_outputs", input);
}

async function createDraftArgPositions(
  input: CreateDraftArgPositionsIn
): Promise<CreateDraftArgPositionsOut> {
  "use server";
  return api.post("/resources/arg_positions", input);
}

/** ---- Server renders client with typed data and actions ---- */
export default async function ToolDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ toolId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { toolId } = await params;
  // Access control handled server-side in layout
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
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

  // Resolve group_id from layout context (cached per request)
  const groupId = (await resolveGroupId({ draft_id: q.draftId ?? null, artifact_type: "tool" })).group_id;

  // Fetch tool detail with draft_id
  try {
    const input: GetToolIn = {
      body: {
        tool_id: toolId,
        draft_id: q.draftId ?? null,
        group_id: groupId,
      } as GetToolIn["body"],
    };
    const [toolDetail, docs, draftsResult] = await Promise.all([
      getTool(input),
      getDocs({ body: { entity_id: toolId } }),
      getDrafts(), // TODO: fetch only tool drafts (e.g. getDrafts({ artifact_type: "tool" }))
    ]);

    // Check access
    if (!toolDetail.tool_exists) {
      return <UnifiedAccessDenied reason="route-denied" />;
    }

    const entityName = docs.detail.title;

    return (
      <DraftProviderClient drafts={draftsResult.drafts ?? []}>
        <PageHeader
          breadcrumbs={[
            { title: "Intelligence", section: "intelligence", url: "/intelligence" },
            { title: "Tools", section: "tools", url: "/intelligence/tools" },
            { title: entityName },
          ]}
          toolbar={<SaveToolbar artifactType="tool" />}
        />
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
