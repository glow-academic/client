/**
 * app/(main)/engine/rubrics/page.tsx
 * Rubric list page - server-side filtering with nuqs URL-backed state
 * @AshokSaravanan222 & @siladiea
 * 06/09/2025
 */
import Rubrics from "@/components/artifacts/rubric/Rubrics";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import type { Metadata } from "next";

import { loadRubricsSearchParams } from "@/lib/search-params/rubrics";

/** ---- Strong types from OpenAPI ---- */
type RubricsListOut = OutputOf<"/api/v5/artifacts/rubrics/list", "post">;
type DuplicateRubricIn = InputOf<"/api/v5/artifacts/rubrics/duplicate", "post">;
type DuplicateRubricOut = OutputOf<"/api/v5/artifacts/rubrics/duplicate", "post">;
type DeleteRubricIn = InputOf<"/api/v5/artifacts/rubrics/delete", "post">;
type DeleteRubricOut = OutputOf<"/api/v5/artifacts/rubrics/delete", "post">;
type SaveRubricIn = InputOf<"/api/v5/artifacts/rubrics/save", "post">;
type SaveRubricOut = OutputOf<"/api/v5/artifacts/rubrics/save", "post">;

/** ---- Body type for rubrics list request ---- */
type RubricsListBody = {
  search?: string | null;
  filter_department_ids?: string[] | null;
  filter_simulation_ids?: string[] | null;
  department_search?: string | null;
  simulation_search?: string | null;
  page_size: number | null;
  page_offset: number | null;
};

/** ---- Direct fetch (no Next.js cache) ----
 * Using cache: 'no-store' to disable Next.js default fetch caching so hard refresh works.
 * Sending X-Bypass-Cache header only on hard refresh to bypass Redis cache.
 */
const getRubricsList = async (body: RubricsListBody): Promise<RubricsListOut> => {
  const bypassCache = await isHardRefresh();
  return api.post(
    "/artifacts/rubrics/list",
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
export async function duplicateRubric(
  input: DuplicateRubricIn
): Promise<DuplicateRubricOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/artifacts/rubrics/duplicate", input);
}

export async function deleteRubric(
  input: DeleteRubricIn
): Promise<DeleteRubricOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/artifacts/rubrics/delete", input);
}

export async function saveRubric(input: SaveRubricIn): Promise<SaveRubricOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/artifacts/rubrics/save", input);
}

/** ---- Docs types for page metadata ---- */
type DocsIn = InputOf<"/api/v5/artifacts/rubrics/docs", "post">;
type DocsOut = OutputOf<"/api/v5/artifacts/rubrics/docs", "post">;

const getDocs = async (input: DocsIn): Promise<DocsOut> => {
  return api.post("/artifacts/rubrics/docs", input);
};

export async function generateMetadata(): Promise<Metadata> {
  const docs = await getDocs({ body: {} });
  return { title: docs.list.title, description: docs.list.description };
}

interface RubricsPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function RubricsPage({ searchParams }: RubricsPageProps) {
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

  const q = loadRubricsSearchParams(searchParamsObj);

  // Compute pagination
  const pageIndex = q.page ?? 0;
  const pageSize = q.pageSize ?? 12;
  const offset = pageIndex * pageSize;

  // Build request body with filter values from URL
  const body: RubricsListBody = {
    search: q.search || null,
    filter_department_ids: q.departmentIds && q.departmentIds.length > 0 ? q.departmentIds : null,
    filter_simulation_ids: q.simulationIds && q.simulationIds.length > 0 ? q.simulationIds : null,
    department_search: q.departmentSearch || null,
    simulation_search: q.simulationSearch || null,
    page_size: pageSize,
    page_offset: offset,
  };

  // Fetch list data server-side with filters
  const listData = await getRubricsList(body);

  return (
    <div className="space-y-6" data-page="rubrics-index">
      <Rubrics
        listData={listData}
        duplicateRubricAction={duplicateRubric}
        deleteRubricAction={deleteRubric}
        saveRubricAction={saveRubric}
        pageIndex={pageIndex}
        pageSize={pageSize}
        totalCount={listData.total_count ?? 0}
        departmentSearch={q.departmentSearch ?? ""}
        simulationSearch={q.simulationSearch ?? ""}
      />
    </div>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  DeleteRubricIn,
  DeleteRubricOut,
  DuplicateRubricIn,
  DuplicateRubricOut,
  RubricsListOut,
  SaveRubricIn,
  SaveRubricOut,
};
