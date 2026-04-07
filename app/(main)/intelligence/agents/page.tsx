/**
 * app/(main)/system/agents/page.tsx
 * System Agent list page - server-side filtering with nuqs URL-backed state
 * @AshokSaravanan222 & @siladiea
 * 06/09/2025
 */
import Agents from "@/components/artifacts/agent/Agents";
import { NewArtifactButton } from "@/components/common/layout/NewArtifactButton";
import { PageHeader } from "@/components/common/layout/PageHeader";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import type { Metadata } from "next";

import { loadAgentsSearchParams } from "@/lib/search-params/agents";

/** ---- Strong types from OpenAPI ---- */
type AgentsListOut = OutputOf<"/agents/search", "post">;
type DuplicateAgentIn = InputOf<"/agents/duplicate", "post">;
type DuplicateAgentOut = OutputOf<"/agents/duplicate", "post">;
type DeleteAgentIn = InputOf<"/agents/delete", "post">;
type DeleteAgentOut = OutputOf<"/agents/delete", "post">;

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
    "/agents/search",
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
  return api.post("/agents/duplicate", input);
}

async function deleteAgent(input: DeleteAgentIn): Promise<DeleteAgentOut> {
  "use server";
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/agents/delete", input);
}

/** ---- Docs types for page metadata ---- */
type DocsIn = InputOf<"/agents/docs", "post">;
type DocsOut = OutputOf<"/agents/docs", "post">;

const getDocs = async (input: DocsIn): Promise<DocsOut> => {
  return api.post("/agents/docs", input);
};

export async function generateMetadata(): Promise<Metadata> {
  const docs = await getDocs({ body: {} });
  return { title: docs.page_metadata?.list.title, description: docs.page_metadata?.list.description };
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
    <>
      <PageHeader
        breadcrumbs={[
          { title: "Intelligence", section: "intelligence", url: "/intelligence" },
          { title: "Agents" },
        ]}
        toolbar={<NewArtifactButton label="New Agent" href="/intelligence/agents/new" />}
      />
      <div className="space-y-6 px-4" data-page="agents-index">
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
    </>
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
