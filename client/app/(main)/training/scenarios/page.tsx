/**
 * app/(main)/create/scenarios/page.tsx
 * Scenario list page - server-side filtering with nuqs URL-backed state
 * @AshokSaravanan222 & @siladiea
 * 06/09/2025
 */
import { Scenarios } from "@/components/artifacts/scenario/Scenarios";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import type { Metadata } from "next";

import { loadScenariosListSearchParams } from "@/lib/search-params/scenarios-list";

/** ---- Strong types from OpenAPI ---- */
type ScenariosListOut = OutputOf<"/api/v4/artifacts/scenarios/list", "post">;
type DuplicateScenarioIn = InputOf<"/api/v4/artifacts/scenarios/duplicate", "post">;
type DuplicateScenarioOut = OutputOf<"/api/v4/artifacts/scenarios/duplicate", "post">;
type DeleteScenarioIn = InputOf<"/api/v4/artifacts/scenarios/delete", "post">;
type DeleteScenarioOut = OutputOf<"/api/v4/artifacts/scenarios/delete", "post">;
type SaveScenarioIn = InputOf<"/api/v4/artifacts/scenarios/save", "post">;
type SaveScenarioOut = OutputOf<"/api/v4/artifacts/scenarios/save", "post">;
type SearchFlagsIn = InputOf<"/api/v4/resources/flags/search", "post">;
type SearchFlagsOut = NonNullable<OutputOf<"/api/v4/resources/flags/search", "post">["items"]>;
type ParseCsvIn = InputOf<"/api/v4/uploads/csv", "post">;
type ParseCsvOut = OutputOf<"/api/v4/uploads/csv", "post">;

/** ---- Body type for scenarios list request ---- */
type ScenariosListBody = {
  search?: string | null;
  persona_ids?: string[] | null;
  simulation_ids?: string[] | null;
  filter_department_ids?: string[] | null;
  persona_search?: string | null;
  simulation_search?: string | null;
  department_search?: string | null;
  page_size: number | null;
  page_offset: number | null;
};

/** ---- Direct fetch (no Next.js cache) ----
 * Using cache: 'no-store' to disable Next.js default fetch caching so hard refresh works.
 * Sending X-Bypass-Cache header only on hard refresh to bypass Redis cache.
 */
const getScenariosList = async (body: ScenariosListBody): Promise<ScenariosListOut> => {
  const bypassCache = await isHardRefresh();
  return api.post(
    "/artifacts/scenarios/list",
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
async function duplicateScenario(
  input: DuplicateScenarioIn,
): Promise<DuplicateScenarioOut> {
  "use server";
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/artifacts/scenarios/duplicate", input);
}

async function deleteScenario(
  input: DeleteScenarioIn,
): Promise<DeleteScenarioOut> {
  "use server";
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/artifacts/scenarios/delete", input);
}

async function saveScenario(
  input: SaveScenarioIn,
): Promise<SaveScenarioOut> {
  "use server";
  return api.post("/artifacts/scenarios/save", input);
}

async function searchFlags(): Promise<SearchFlagsOut> {
  "use server";
  const res = await api.post("/resources/flags/search", {
    body: { search: null, limit_count: 100, offset_count: 0, scenario: true },
  } as SearchFlagsIn);
  return res.items ?? [];
}

async function parseCsv(input: ParseCsvIn): Promise<ParseCsvOut> {
  "use server";
  return api.post("/uploads/csv", input);
}

/** ---- Docs types for page metadata ---- */
type DocsIn = InputOf<"/api/v4/artifacts/scenarios/docs", "post">;
type DocsOut = OutputOf<"/api/v4/artifacts/scenarios/docs", "post">;

const getDocs = async (input: DocsIn): Promise<DocsOut> => {
  return api.post("/artifacts/scenarios/docs", input);
};

export async function generateMetadata(): Promise<Metadata> {
  const docs = await getDocs({ body: {} });
  return { title: docs.list.title, description: docs.list.description };
}

interface ScenariosPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function ScenariosPage({ searchParams }: ScenariosPageProps) {
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

  const q = loadScenariosListSearchParams(searchParamsObj);

  // Compute pagination
  const pageIndex = q.page ?? 0;
  const pageSize = q.pageSize ?? 10;
  const offset = pageIndex * pageSize;

  // Build request body with filter values from URL
  const body: ScenariosListBody = {
    search: q.search || null,
    persona_ids: q.personaIds && q.personaIds.length > 0 ? q.personaIds : null,
    simulation_ids: q.simulationIds && q.simulationIds.length > 0 ? q.simulationIds : null,
    filter_department_ids: q.departmentIds && q.departmentIds.length > 0 ? q.departmentIds : null,
    persona_search: q.personaSearch || null,
    simulation_search: q.simulationSearch || null,
    department_search: q.departmentSearch || null,
    page_size: pageSize,
    page_offset: offset,
  };

  // Fetch list data server-side with filters
  const listData = await getScenariosList(body);

  return (
    <div className="space-y-6" data-page="scenarios-index">
      <Scenarios
        listData={listData}
        duplicateScenarioAction={duplicateScenario}
        deleteScenarioAction={deleteScenario}
        saveScenarioAction={saveScenario}
        searchFlagsAction={searchFlags}
        parseCsvAction={parseCsv}
        importFields={listData.import_fields ?? undefined}
        pageIndex={pageIndex}
        pageSize={pageSize}
        totalCount={listData.total_count ?? 0}
        personaSearch={q.personaSearch ?? ""}
        simulationSearch={q.simulationSearch ?? ""}
        departmentSearch={q.departmentSearch ?? ""}
      />
    </div>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  DeleteScenarioIn,
  DeleteScenarioOut,
  DuplicateScenarioIn,
  DuplicateScenarioOut,
  ParseCsvIn,
  ParseCsvOut,
  SaveScenarioIn,
  SaveScenarioOut,
  SearchFlagsOut,
  ScenariosListOut,
};
