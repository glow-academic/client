/**
 * app/(main)/engine/tools/page.tsx
 * Tools list page (skeleton)
 */
import Tools from "@/components/artifacts/tool/Tools";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import type { Metadata } from "next";

/** ---- Strong types from OpenAPI ---- */
type ToolsListIn = InputOf<"/api/v4/artifacts/tools/list", "post">;
type ToolsListOut = OutputOf<"/api/v4/artifacts/tools/list", "post">;
type DeleteToolIn = InputOf<"/api/v4/artifacts/tools/delete", "post">;
type DeleteToolOut = OutputOf<"/api/v4/artifacts/tools/delete", "post">;
type DuplicateToolIn = InputOf<"/api/v4/artifacts/tools/duplicate", "post">;
type DuplicateToolOut = OutputOf<"/api/v4/artifacts/tools/duplicate", "post">;

/** ---- Direct fetch (no Next.js cache) ----
 * Using cache: 'no-store' to disable Next.js default fetch caching so hard refresh works.
 * Sending X-Bypass-Cache header only on hard refresh to bypass Redis cache.
 */
const getToolsList = async (): Promise<ToolsListOut> => {
  const bypassCache = await isHardRefresh();
  return api.post(
    "/artifacts/tools/list",
    {} as ToolsListIn,
    {
      cache: "no-store",
      ...(bypassCache && {
        headers: {
          "X-Bypass-Cache": "1",
        },
      }),
    }
  );
};

/** ---- Strongly-typed server actions (single source of truth) ---- */
async function deleteTool(input: DeleteToolIn): Promise<DeleteToolOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/artifacts/tools/delete", input);
}

async function duplicateTool(
  input: DuplicateToolIn
): Promise<DuplicateToolOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  return api.post("/artifacts/tools/duplicate", input);
}

/** ---- Docs types for page metadata ---- */
type DocsIn = InputOf<"/api/v4/artifacts/tools/docs", "post">;
type DocsOut = OutputOf<"/api/v4/artifacts/tools/docs", "post">;

const getDocs = async (input: DocsIn): Promise<DocsOut> => {
  return api.post("/artifacts/tools/docs", input);
};

export async function generateMetadata(): Promise<Metadata> {
  const docs = await getDocs({ body: {} });
  return { title: docs.list.title, description: docs.list.description };
}

export default async function ToolsPage() {
  // Access control handled server-side in layout
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  // Fetch list data server-side
  const listData = await getToolsList();

  return (
    <div className="space-y-6" data-page="tools-index">
      <Tools
        listData={listData}
        deleteToolAction={deleteTool}
        duplicateToolAction={duplicateTool}
      />
    </div>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  DeleteToolIn,
  DeleteToolOut,
  DuplicateToolIn,
  DuplicateToolOut,
  ToolsListOut,
};
