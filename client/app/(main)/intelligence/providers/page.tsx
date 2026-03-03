/**
 * app/(main)/system/providers/page.tsx
 * Providers list page - server-side filtering with nuqs URL-backed state
 */
import Providers from "@/components/artifacts/provider/Providers";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import type { Metadata } from "next";

import { loadProvidersSearchParams } from "@/lib/search-params/providers";

/** ---- Strong types from OpenAPI ---- */
type ProvidersListOut = OutputOf<"/api/v5/artifacts/providers/list", "post">;
type DeleteProviderIn = InputOf<"/api/v5/artifacts/providers/delete", "post">;
type DeleteProviderOut = OutputOf<"/api/v5/artifacts/providers/delete", "post">;

/** ---- Body type for providers list request ---- */
type ProvidersListBody = {
  search?: string | null;
  filter_department_ids?: string[] | null;
  filter_model_ids?: string[] | null;
  filter_status?: string[] | null;
  department_search?: string | null;
  model_search?: string | null;
  page_size: number | null;
  page_offset: number | null;
};

/** ---- Direct fetch (no Next.js cache) ----
 * Using cache: 'no-store' to disable Next.js default fetch caching so hard refresh works.
 * Sending X-Bypass-Cache header only on hard refresh to bypass Redis cache.
 */
const getProvidersList = async (body: ProvidersListBody): Promise<ProvidersListOut> => {
  const bypassCache = await isHardRefresh();
  return api.post(
    "/artifacts/providers/list",
    { body },
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
async function deleteProvider(
  input: DeleteProviderIn
): Promise<DeleteProviderOut> {
  "use server";
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/artifacts/providers/delete", {
    ...input,
    body: { ...input.body },
  });
}

/** ---- Docs types for page metadata ---- */
type DocsIn = InputOf<"/api/v5/artifacts/providers/docs", "post">;
type DocsOut = OutputOf<"/api/v5/artifacts/providers/docs", "post">;

const getDocs = async (input: DocsIn): Promise<DocsOut> => {
  return api.post("/artifacts/providers/docs", input);
};

export async function generateMetadata(): Promise<Metadata> {
  const docs = await getDocs({ body: {} });
  return { title: docs.list.title, description: docs.list.description };
}

interface ProvidersPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function ProvidersPage({ searchParams }: ProvidersPageProps) {
  // Access control is handled server-side in layout

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

  const q = loadProvidersSearchParams(searchParamsObj);

  // Compute pagination
  const pageIndex = q.page ?? 0;
  const pageSize = q.pageSize ?? 12;
  const offset = pageIndex * pageSize;

  // Build request body with filter values from URL
  const body: ProvidersListBody = {
    search: q.search || null,
    filter_department_ids: q.departmentIds && q.departmentIds.length > 0 ? q.departmentIds : null,
    filter_model_ids: q.modelIds && q.modelIds.length > 0 ? q.modelIds : null,
    filter_status: q.statusIds && q.statusIds.length > 0 ? q.statusIds : null,
    department_search: q.departmentSearch || null,
    model_search: q.modelSearch || null,
    page_size: pageSize,
    page_offset: offset,
  };

  // Fetch list data server-side with filters
  const listData = await getProvidersList(body);

  return (
    <div className="space-y-6" data-page="providers-index">
      <Providers
        listData={listData}
        deleteProviderAction={deleteProvider}
        pageIndex={pageIndex}
        pageSize={pageSize}
        totalCount={listData.total_count ?? 0}
        departmentSearch={q.departmentSearch ?? ""}
        modelSearch={q.modelSearch ?? ""}
      />
    </div>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type { DeleteProviderIn, DeleteProviderOut, ProvidersListOut };
