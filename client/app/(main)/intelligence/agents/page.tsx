/**
 * app/(main)/system/agents/page.tsx
 * System Agent list page - server-side filtering with nuqs URL-backed state
 * @AshokSaravanan222 & @siladiea
 * 06/09/2025
 */
import Agents from "@/components/artifacts/agent/Agents";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import type { Metadata } from "next";

import { loadAgentsSearchParams } from "@/lib/search-params/agents";

/** ---- Strong types from OpenAPI ---- */
type AgentsListOut = OutputOf<"/api/v4/artifacts/agents/list", "post">;
type DuplicateAgentIn = InputOf<"/api/v4/artifacts/agents/duplicate", "post">;
type DuplicateAgentOut = OutputOf<"/api/v4/artifacts/agents/duplicate", "post">;
type DeleteAgentIn = InputOf<"/api/v4/artifacts/agents/delete", "post">;
type DeleteAgentOut = OutputOf<"/api/v4/artifacts/agents/delete", "post">;

/** ---- Body type for agents list request ---- */
type AgentsListBody = {
  search?: string | null;
  filter_department_ids?: string[] | null;
  filter_model_ids?: string[] | null;
  filter_tool_ids?: string[] | null;
  department_search?: string | null;
  model_search?: string | null;
  tool_search?: string | null;
  page_size: number | null;
  page_offset: number | null;
};

/** ---- Direct fetch (no Next.js cache) ----
 * Using cache: 'no-store' to disable Next.js default fetch caching so hard refresh works.
 * Sending X-Bypass-Cache header only on hard refresh to bypass Redis cache.
 */
const getAgentsList = async (body: AgentsListBody): Promise<AgentsListOut> => {
  const bypassCache = await isHardRefresh();
  return api.post(
    "/artifacts/agents/list",
    { body },
    {
      cache: "no-store",
      ...(bypassCache && {
        headers: {
          "X-Bypass-Cache": "1",
        },
      }),
    },
  );
};

/** ---- Strongly-typed server actions (single source of truth) ---- */
async function duplicateAgent(
  input: DuplicateAgentIn,
): Promise<DuplicateAgentOut> {
  "use server";
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/artifacts/agents/duplicate", input);
}

async function deleteAgent(input: DeleteAgentIn): Promise<DeleteAgentOut> {
  "use server";
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/artifacts/agents/delete", input);
}

/** ---- Docs types for page metadata ---- */
type DocsIn = InputOf<"/api/v4/artifacts/agents/docs", "post">;
type DocsOut = OutputOf<"/api/v4/artifacts/agents/docs", "post">;

const getDocs = async (input: DocsIn): Promise<DocsOut> => {
  return api.post("/artifacts/agents/docs", input);
};

export async function generateMetadata(): Promise<Metadata> {
  const docs = await getDocs({ body: {} });
  return { title: docs.list.title, description: docs.list.description };
}

interface AgentsPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function AgentsPage({ searchParams }: AgentsPageProps) {
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

  const q = loadAgentsSearchParams(searchParamsObj);

  // Compute pagination
  const pageIndex = q.page ?? 0;
  const pageSize = q.pageSize ?? 12;
  const offset = pageIndex * pageSize;

  // Build request body with filter values from URL
  const body: AgentsListBody = {
    search: q.search || null,
    filter_department_ids: q.departmentIds && q.departmentIds.length > 0 ? q.departmentIds : null,
    filter_model_ids: q.modelIds && q.modelIds.length > 0 ? q.modelIds : null,
    filter_tool_ids: q.toolIds && q.toolIds.length > 0 ? q.toolIds : null,
    department_search: q.departmentSearch || null,
    model_search: q.modelSearch || null,
    tool_search: q.toolSearch || null,
    page_size: pageSize,
    page_offset: offset,
  };

  // Fetch list data server-side with filters
  const listData = await getAgentsList(body);

  return (
    <div className="space-y-6" data-page="agents-index">
      <Agents
        listData={listData}
        duplicateAgentAction={duplicateAgent}
        deleteAgentAction={deleteAgent}
        pageIndex={pageIndex}
        pageSize={pageSize}
        totalCount={listData.total_count ?? 0}
        departmentSearch={q.departmentSearch ?? ""}
        modelSearch={q.modelSearch ?? ""}
        toolSearch={q.toolSearch ?? ""}
      />
    </div>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  AgentsListOut,
  DeleteAgentIn,
  DeleteAgentOut,
  DuplicateAgentIn,
  DuplicateAgentOut,
};
