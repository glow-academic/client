/**
 * app/(main)/engine/tools/t/[toolId]/page.tsx
 * Tool detail/edit page (skeleton)
 */

import { UnifiedAccessDenied } from "@/components/common/layout/UnifiedAccessDenied";
import Tool from "@/components/tools/Tool";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata, ResolvingMetadata } from "next";
import { createLoader, parseAsString } from "nuqs/server";

/** ---- Strong types from OpenAPI ---- */
type GetToolIn = InputOf<"/api/v4/tools/get", "post">;
type GetToolOut = OutputOf<"/api/v4/tools/get", "post">;
type SaveToolIn = InputOf<"/api/v4/tools/save", "post">;
type SaveToolOut = OutputOf<"/api/v4/tools/save", "post">;
type PatchToolDraftIn = InputOf<"/api/v4/tools/draft", "patch">;
type PatchToolDraftOut = OutputOf<"/api/v4/tools/draft", "patch">;
type CreateDraftArgsIn = InputOf<"/api/v4/resources/args", "post">;
type CreateDraftArgsOut = OutputOf<"/api/v4/resources/args", "post">;
type CreateDraftArgsOutputsIn = InputOf<
  "/api/v4/resources/args_outputs",
  "post"
>;
type CreateDraftArgsOutputsOut = OutputOf<
  "/api/v4/resources/args_outputs",
  "post"
>;

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

/** ---- Metadata ---- */
export async function generateMetadata(
  { params }: { params: Promise<{ toolId: string }> },
  parent: ResolvingMetadata
): Promise<Metadata> {
  const { toolId } = await params;
  const parentMetadata = await parent;
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  try {
    const input: GetToolIn = {
      body: {
        tool_id: toolId,
      } as GetToolIn["body"],
    };
    const tool = await getTool(input);
    return {
      title: `${tool?.name || "Tool"} - ${parentMetadata.title?.absolute || "Tools"}`,
      description:
        tool?.description ||
        "View and edit tool details for teaching assistant training platform.",
    };
  } catch {
    // Fall through to default metadata
  }

  return {
    title: `Tool Details - ${parentMetadata.title?.absolute || "Tools"}`,
    description:
      "View and edit tool details for teaching assistant training platform.",
  };
}

/** ---- Strongly-typed server actions ---- */
async function saveTool(input: SaveToolIn): Promise<SaveToolOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  return api.post("/tools/save", input);
}

async function patchToolDraft(
  input: PatchToolDraftIn
): Promise<PatchToolDraftOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  return api.patch("/tools/draft", input);
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

  // Fetch tool detail with draft_id
  try {
    const input: GetToolIn = {
      body: {
        tool_id: toolId,
        draft_id: q.draftId ?? null,
      } as GetToolIn["body"],
    };
    const toolDetail = await getTool(input);

    // Check access
    if (!toolDetail.tool_exists) {
      return <UnifiedAccessDenied />;
    }

    return (
      <div
        className="space-y-6"
        data-page="tool-edit"
        data-tool-id={toolId}
        aria-label="Edit tool page"
      >
        <Tool
          toolId={toolId}
          toolData={toolDetail}
          saveToolAction={saveTool}
          patchToolDraftAction={patchToolDraft}
          createArgsAction={createDraftArgs}
          createArgsOutputsAction={createDraftArgsOutputs}
        />
      </div>
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
          reason="not_found"
          resourceType="tool"
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
  SaveToolIn,
  SaveToolOut,
};
