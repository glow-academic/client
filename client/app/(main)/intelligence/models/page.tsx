/**
 * app/(main)/engine/models/page.tsx
 * Models list page - server-side filtering with nuqs URL-backed state
 * @AshokSaravanan222 & @siladiea
 * 06/18/2025
 */
import Models from "@/components/artifacts/model/Models";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import type { Metadata } from "next";

import { loadModelsSearchParams } from "@/lib/search-params/models";

/** ---- Strong types from OpenAPI ---- */
type ModelsListOut = OutputOf<"/api/v4/artifacts/models/list", "post">;
type DuplicateModelIn = InputOf<"/api/v4/artifacts/models/duplicate", "post">;
type DuplicateModelOut = OutputOf<"/api/v4/artifacts/models/duplicate", "post">;
type DeleteModelIn = InputOf<"/api/v4/artifacts/models/delete", "post">;
type DeleteModelOut = OutputOf<"/api/v4/artifacts/models/delete", "post">;

/** ---- Body type for models list request ---- */
type ModelsListBody = {
  search?: string | null;
  filter_provider_ids?: string[] | null;
  filter_department_ids?: string[] | null;
  filter_agent_ids?: string[] | null;
  provider_search?: string | null;
  department_search?: string | null;
  agent_search?: string | null;
  page_size: number | null;
  page_offset: number | null;
};

/** ---- Direct fetch (no Next.js cache) ----
 * Using cache: 'no-store' to disable Next.js default fetch caching so hard refresh works.
 * Sending X-Bypass-Cache header only on hard refresh to bypass Redis cache.
 */
const getModelsList = async (body: ModelsListBody): Promise<ModelsListOut> => {
  const bypassCache = await isHardRefresh();
  return api.post(
    "/artifacts/models/list",
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
async function duplicateModel(
  input: DuplicateModelIn,
): Promise<DuplicateModelOut> {
  "use server";
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/artifacts/models/duplicate", input);
}

async function deleteModel(input: DeleteModelIn): Promise<DeleteModelOut> {
  "use server";
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/artifacts/models/delete", input);
}

/** ---- Docs types for page metadata ---- */
type DocsIn = InputOf<"/api/v4/artifacts/models/docs", "post">;
type DocsOut = OutputOf<"/api/v4/artifacts/models/docs", "post">;

const getDocs = async (input: DocsIn): Promise<DocsOut> => {
  return api.post("/artifacts/models/docs", input);
};

export async function generateMetadata(): Promise<Metadata> {
  const docs = await getDocs({ body: {} });
  return { title: docs.list.title, description: docs.list.description };
}

interface ModelsPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function ModelsPage({ searchParams }: ModelsPageProps) {
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

  const q = loadModelsSearchParams(searchParamsObj);

  // Compute pagination
  const pageIndex = q.page ?? 0;
  const pageSize = q.pageSize ?? 12;
  const offset = pageIndex * pageSize;

  // Build request body with filter values from URL
  const body: ModelsListBody = {
    search: q.search || null,
    filter_provider_ids: q.providerIds && q.providerIds.length > 0 ? q.providerIds : null,
    filter_department_ids: q.departmentIds && q.departmentIds.length > 0 ? q.departmentIds : null,
    filter_agent_ids: q.agentIds && q.agentIds.length > 0 ? q.agentIds : null,
    provider_search: q.providerSearch || null,
    department_search: q.departmentSearch || null,
    agent_search: q.agentSearch || null,
    page_size: pageSize,
    page_offset: offset,
  };

  // Fetch list data server-side with filters
  const listData = await getModelsList(body);

  return (
    <div className="space-y-6" data-page="models-index">
      <Models
        listData={listData}
        duplicateModelAction={duplicateModel}
        deleteModelAction={deleteModel}
        pageIndex={pageIndex}
        pageSize={pageSize}
        totalCount={listData.total_count ?? 0}
        providerSearch={q.providerSearch ?? ""}
        departmentSearch={q.departmentSearch ?? ""}
        agentSearch={q.agentSearch ?? ""}
      />
    </div>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  DeleteModelIn,
  DeleteModelOut,
  DuplicateModelIn,
  DuplicateModelOut,
  ModelsListOut,
};
