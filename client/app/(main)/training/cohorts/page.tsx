/**
 * app/(main)/create/cohorts/page.tsx
 * Cohorts list page - server-side filtering with nuqs URL-backed state
 * @AshokSaravanan222 & @siladiea
 * 06/18/2025
 */
import Cohorts from "@/components/artifacts/cohort/Cohorts";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import { readViewCookie } from "@/lib/view-cookie";
import type { Metadata } from "next";

import { loadCohortsListSearchParams } from "@/lib/search-params/cohorts";

/** ---- Strong types from OpenAPI ---- */
type CohortsListOut = OutputOf<"/api/v5/artifacts/cohorts/list", "post">;
type DuplicateCohortIn = InputOf<"/api/v5/artifacts/cohorts/duplicate", "post">;
type DuplicateCohortOut = OutputOf<"/api/v5/artifacts/cohorts/duplicate", "post">;
type DeleteCohortIn = InputOf<"/api/v5/artifacts/cohorts/delete", "post">;
type DeleteCohortOut = OutputOf<"/api/v5/artifacts/cohorts/delete", "post">;
type SaveCohortIn = InputOf<"/api/v5/artifacts/cohorts/save", "post">;
type SaveCohortOut = OutputOf<"/api/v5/artifacts/cohorts/save", "post">;
type SearchFlagsIn = InputOf<"/api/v5/resources/flags/search", "post">;
type SearchFlagsOut = NonNullable<OutputOf<"/api/v5/resources/flags/search", "post">["items"]>;
type ParseCsvIn = InputOf<"/api/v5/uploads/csv", "post">;
type ParseCsvOut = OutputOf<"/api/v5/uploads/csv", "post">;

/** ---- Body type for cohorts list request ---- */
type CohortsListBody = {
  search?: string | null;
  filter_simulation_ids?: string[] | null;
  filter_profile_ids?: string[] | null;
  filter_department_ids?: string[] | null;
  simulation_search?: string | null;
  profile_search?: string | null;
  department_search?: string | null;
  page_size: number | null;
  page_offset: number | null;
};

/** ---- Direct fetch (no Next.js cache) ----
 * Using cache: 'no-store' to disable Next.js default fetch caching so hard refresh works.
 * Sending X-Bypass-Cache header only on hard refresh to bypass Redis cache.
 */
const getCohortsList = async (body: CohortsListBody): Promise<CohortsListOut> => {
  const bypassCache = await isHardRefresh();
  return api.post(
    "/artifacts/cohorts/list",
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
async function duplicateCohort(
  input: DuplicateCohortIn,
): Promise<DuplicateCohortOut> {
  "use server";
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/artifacts/cohorts/duplicate", input);
}

async function deleteCohort(input: DeleteCohortIn): Promise<DeleteCohortOut> {
  "use server";
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/artifacts/cohorts/delete", input);
}

async function saveCohort(input: SaveCohortIn): Promise<SaveCohortOut> {
  "use server";
  return api.post("/artifacts/cohorts/save", input);
}

async function searchFlags(): Promise<SearchFlagsOut> {
  "use server";
  const res = await api.post("/resources/flags/search", {
    body: { search: null, limit_count: 100, offset_count: 0, cohort: true },
  } as SearchFlagsIn);
  return res.items ?? [];
}

async function parseCsv(input: ParseCsvIn): Promise<ParseCsvOut> {
  "use server";
  return api.post("/uploads/csv", input);
}

/** ---- Docs types for page metadata ---- */
type DocsIn = InputOf<"/api/v5/artifacts/cohorts/docs", "post">;
type DocsOut = OutputOf<"/api/v5/artifacts/cohorts/docs", "post">;

const getDocs = async (input: DocsIn): Promise<DocsOut> => {
  return api.post("/artifacts/cohorts/docs", input);
};

export async function generateMetadata(): Promise<Metadata> {
  const docs = await getDocs({ body: {} });
  return { title: docs.list.title, description: docs.list.description };
}

interface CohortsPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function CohortsPage({ searchParams }: CohortsPageProps) {
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

  const q = loadCohortsListSearchParams(searchParamsObj);

  // Compute pagination
  const pageIndex = q.page ?? 0;
  const pageSize = q.pageSize ?? 12;
  const offset = pageIndex * pageSize;

  // Build request body with filter values from URL
  const body: CohortsListBody = {
    search: q.search || null,
    filter_simulation_ids: q.simulationIds && q.simulationIds.length > 0 ? q.simulationIds : null,
    filter_profile_ids: q.profileIds && q.profileIds.length > 0 ? q.profileIds : null,
    filter_department_ids: q.departmentIds && q.departmentIds.length > 0 ? q.departmentIds : null,
    simulation_search: q.simulationSearch || null,
    profile_search: q.profileSearch || null,
    department_search: q.departmentSearch || null,
    page_size: pageSize,
    page_offset: offset,
  };

  // Fetch list data and view cookie in parallel
  const [listData, initialColumnVisibility] = await Promise.all([
    getCohortsList(body),
    readViewCookie("cohorts"),
  ]);

  return (
    <div className="space-y-6" data-page="cohorts-index">
      <Cohorts
        listData={listData}
        initialColumnVisibility={initialColumnVisibility}
        duplicateCohortAction={duplicateCohort}
        deleteCohortAction={deleteCohort}
        saveCohortAction={saveCohort}
        searchFlagsAction={searchFlags}
        parseCsvAction={parseCsv}
        importFields={listData.import_fields as import("@/components/common/BulkImport").ImportFieldDef[] | undefined}
        pageIndex={pageIndex}
        pageSize={pageSize}
        totalCount={listData.total_count ?? 0}
        simulationSearch={q.simulationSearch ?? ""}
        profileSearch={q.profileSearch ?? ""}
        departmentSearch={q.departmentSearch ?? ""}
      />
    </div>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  CohortsListOut,
  DeleteCohortIn,
  DeleteCohortOut,
  DuplicateCohortIn,
  DuplicateCohortOut,
  ParseCsvIn,
  ParseCsvOut,
  SaveCohortIn,
  SaveCohortOut,
  SearchFlagsOut,
};
