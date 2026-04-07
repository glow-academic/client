/**
 * app/(main)/create/cohorts/page.tsx
 * Cohorts list page - server-side filtering with nuqs URL-backed state
 * @AshokSaravanan222 & @siladiea
 * 06/18/2025
 */
import Cohorts from "@/components/artifacts/cohort/Cohorts";
import { NewArtifactButton } from "@/components/common/layout/NewArtifactButton";
import { PageHeader } from "@/components/common/layout/PageHeader";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import { readViewCookie } from "@/lib/view-cookie";
import type { Metadata } from "next";

import { loadCohortsListSearchParams } from "@/lib/search-params/cohorts";

/** ---- Strong types from OpenAPI ---- */
type CohortsListOut = OutputOf<"/cohorts/search", "post">;
type DuplicateCohortIn = InputOf<"/cohorts/duplicate", "post">;
type DuplicateCohortOut = OutputOf<"/cohorts/duplicate", "post">;
type DeleteCohortIn = InputOf<"/cohorts/delete", "post">;
type DeleteCohortOut = OutputOf<"/cohorts/delete", "post">;
type CreateCohortIn = InputOf<"/cohorts/create", "post">;
type CreateCohortOut = OutputOf<"/cohorts/create", "post">;
type UpdateCohortIn = InputOf<"/cohorts/update", "post">;
type UpdateCohortOut = OutputOf<"/cohorts/update", "post">;
import type { ParseCsvResult } from "@/components/common/BulkImport";

/** ---- Body type for cohorts list request ---- */
type CohortsListBody = {
  search?: string | null;
  filter_simulation_ids?: string[] | null;
  filter_profile_ids?: string[] | null;
  filter_department_ids?: string[] | null;
  simulation_search?: string | null;
  profile_search?: string | null;
  department_search?: string | null;
  flag_search?: string | null;
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
    "/cohorts/search",
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
  return api.post("/cohorts/duplicate", input);
}

async function deleteCohort(input: DeleteCohortIn): Promise<DeleteCohortOut> {
  "use server";
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/cohorts/delete", input);
}

async function createCohort(input: CreateCohortIn): Promise<CreateCohortOut> {
  "use server";
  return api.post("/cohorts/create", input);
}

async function updateCohort(input: UpdateCohortIn): Promise<UpdateCohortOut> {
  "use server";
  return api.post("/cohorts/update", input);
}

async function parseCsv(formData: FormData): Promise<ParseCsvResult> {
  "use server";
  return api.post("/cohorts/csv", { formData });
}

/** ---- Docs types for page metadata ---- */
type DocsIn = InputOf<"/cohorts/docs", "post">;
type DocsOut = OutputOf<"/cohorts/docs", "post">;

const getDocs = async (input: DocsIn): Promise<DocsOut> => {
  return api.post("/cohorts/docs", input);
};

export async function generateMetadata(): Promise<Metadata> {
  const docs = await getDocs({ body: {} });
  return { title: docs.page_metadata?.list.title, description: docs.page_metadata?.list.description };
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
    flag_search: q.flagSearch || null,
    page_size: pageSize,
    page_offset: offset,
  };

  // Fetch list data and view cookie in parallel
  const [listData, initialColumnVisibility] = await Promise.all([
    getCohortsList(body),
    readViewCookie("cohorts"),
  ]);

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { title: "Training", section: "training", url: "/training" },
          { title: "Cohorts" },
        ]}
        toolbar={<NewArtifactButton label="New Cohort" href="/training/cohorts/new" />}
      />
      <div className="space-y-6 px-4" data-page="cohorts-index">
        <Cohorts
          listData={listData}
          initialColumnVisibility={initialColumnVisibility}
          duplicateCohortAction={duplicateCohort}
          deleteCohortAction={deleteCohort}
          createCohortAction={createCohort}
          updateCohortAction={updateCohort}
          parseCsvAction={parseCsv}
          importFields={listData.import_fields as import("@/components/common/BulkImport").ImportFieldDef[] | undefined}
          pageIndex={pageIndex}
          pageSize={pageSize}
          totalCount={listData.total_count ?? 0}
          simulationSearch={q.simulationSearch ?? ""}
          profileSearch={q.profileSearch ?? ""}
          departmentSearch={q.departmentSearch ?? ""}
          flagSearch={q.flagSearch ?? ""}
        />
      </div>
    </>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  CohortsListOut,
  DeleteCohortIn,
  DeleteCohortOut,
  DuplicateCohortIn,
  DuplicateCohortOut,
  CreateCohortIn,
  CreateCohortOut,
  UpdateCohortIn,
  UpdateCohortOut,
};
