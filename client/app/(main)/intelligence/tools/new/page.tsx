/**
 * app/(main)/engine/tools/new/page.tsx
 * New tool page (skeleton)
 */

import Tool from "@/components/artifacts/tool/Tool";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";
import { createLoader, parseAsString } from "nuqs/server";

/** ---- Strong types from OpenAPI ---- */
type GetToolIn = InputOf<"/api/v4/artifacts/tools/get", "post">;
type GetToolOut = OutputOf<"/api/v4/artifacts/tools/get", "post">;
type SaveToolIn = InputOf<"/api/v4/artifacts/tools/save", "post">;
type SaveToolOut = OutputOf<"/api/v4/artifacts/tools/save", "post">;
type PatchToolDraftIn = InputOf<"/api/v4/artifacts/tools/draft", "patch">;
type PatchToolDraftOut = OutputOf<"/api/v4/artifacts/tools/draft", "patch">;
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
type CreateDraftArgPositionsIn = InputOf<
  "/api/v4/resources/arg_positions",
  "post"
>;
type CreateDraftArgPositionsOut = OutputOf<
  "/api/v4/resources/arg_positions",
  "post"
>;

/** ---- Direct fetch (no caching - source of truth) ----
 * Always bypass cache to ensure fresh data for new pages.
 */
const getToolDefault = async (input: GetToolIn): Promise<GetToolOut> => {
  return api.post("/artifacts/tools/get", input, {
    cache: "no-store",
    headers: {
      "X-Bypass-Cache": "1",
    },
  });
};

/** ---- Metadata ---- */
/** ---- Docs types for page metadata ---- */
type DocsIn = InputOf<"/api/v4/artifacts/tools/docs", "post">;
type DocsOut = OutputOf<"/api/v4/artifacts/tools/docs", "post">;

const getDocs = async (input: DocsIn): Promise<DocsOut> => {
  return api.post("/artifacts/tools/docs", input);
};

export async function generateMetadata(): Promise<Metadata> {
  const docs = await getDocs({ body: {} });
  return { title: docs.new.title, description: docs.new.description };
}

/** ---- Strongly-typed server actions ---- */
async function saveTool(input: SaveToolIn): Promise<SaveToolOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  return api.post("/artifacts/tools/save", input);
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
export default async function NewToolPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // Access control handled server-side in layout
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
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
    },
  };
  const toolDetailDefault = await getToolDefault(input);

  return (
    <div
      className="space-y-6"
      data-page="tool-new"
      aria-label="Create new tool page"
    >
      <Tool
        toolData={toolDetailDefault}
        saveToolAction={saveTool}
        patchToolDraftAction={patchToolDraft}
        createArgsAction={createDraftArgs}
        createArgPositionsAction={createDraftArgPositions}
        createArgsOutputsAction={createDraftArgsOutputs}
      />
    </div>
  );
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
