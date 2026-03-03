/**
 * app/(main)/engine/tools/page.tsx
 * Tools list page - server-side filtering with nuqs URL-backed state
 */
import Tools from "@/components/artifacts/tool/Tools";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import type { Metadata } from "next";

import { loadToolsSearchParams } from "@/lib/search-params/tools";

/** ---- Strong types from OpenAPI ---- */
type ToolsListIn = InputOf<"/api/v5/artifacts/tools/list", "post">;
type ToolsListOut = OutputOf<"/api/v5/artifacts/tools/list", "post">;
type DeleteToolIn = InputOf<"/api/v5/artifacts/tools/delete", "post">;
type DeleteToolOut = OutputOf<"/api/v5/artifacts/tools/delete", "post">;
type DuplicateToolIn = InputOf<"/api/v5/artifacts/tools/duplicate", "post">;
type DuplicateToolOut = OutputOf<"/api/v5/artifacts/tools/duplicate", "post">;

/** ---- Body type for tools list request ---- */
type ToolsListBody = {
  search?: string | null;
  filter_department_ids?: string[] | null;
  filter_agent_ids?: string[] | null;
  filter_creatable?: string[] | null;
  department_search?: string | null;
  agent_search?: string | null;
  page_size: number | null;
  page_offset: number | null;
};

/** ---- Direct fetch (no Next.js cache) ----
 * Using cache: 'no-store' to disable Next.js default fetch caching so hard refresh works.
 * Sending X-Bypass-Cache header only on hard refresh to bypass Redis cache.
 */
const getToolsList = async (body: ToolsListBody): Promise<ToolsListOut> => {
  const bypassCache = await isHardRefresh();
  return api.post(
    "/artifacts/tools/list",
    { body } as ToolsListIn,
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
type DocsIn = InputOf<"/api/v5/artifacts/tools/docs", "post">;
type DocsOut = OutputOf<"/api/v5/artifacts/tools/docs", "post">;

const getDocs = async (input: DocsIn): Promise<DocsOut> => {
  return api.post("/artifacts/tools/docs", input);
};

export async function generateMetadata(): Promise<Metadata> {
  const docs = await getDocs({ body: {} });
  return { title: docs.list.title, description: docs.list.description };
}

interface ToolsPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function ToolsPage({ searchParams }: ToolsPageProps) {
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

  const q = loadToolsSearchParams(searchParamsObj);

  // Compute pagination
  const pageIndex = q.page ?? 0;
  const pageSize = q.pageSize ?? 12;
  const offset = pageIndex * pageSize;

  // Build request body with filter values from URL
  const body: ToolsListBody = {
    search: q.search || null,
    filter_department_ids: q.departmentIds && q.departmentIds.length > 0 ? q.departmentIds : null,
    filter_agent_ids: q.agentIds && q.agentIds.length > 0 ? q.agentIds : null,
    filter_creatable: q.creatableIds && q.creatableIds.length > 0 ? q.creatableIds : null,
    department_search: q.departmentSearch || null,
    agent_search: q.agentSearch || null,
    page_size: pageSize,
    page_offset: offset,
  };

  // Fetch list data server-side with filters
  const listData = await getToolsList(body);

  return (
    <div className="space-y-6" data-page="tools-index">
      <Tools
        listData={listData}
        deleteToolAction={deleteTool}
        duplicateToolAction={duplicateTool}
        pageIndex={pageIndex}
        pageSize={pageSize}
        totalCount={listData.total_count ?? 0}
        departmentSearch={q.departmentSearch ?? ""}
        agentSearch={q.agentSearch ?? ""}
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
