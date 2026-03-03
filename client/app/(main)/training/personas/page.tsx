/**
 * app/(main)/create/personas/page.tsx
 * Persona list page - server-side filtering with nuqs URL-backed state
 * @AshokSaravanan222 & @siladiea
 * 06/09/2025
 */
import Personas from "@/components/artifacts/persona/Personas";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import { readViewCookie } from "@/lib/view-cookie";
import type { Metadata } from "next";

import { loadPersonasSearchParams } from "@/lib/search-params/personas";

/** ---- Strong types from OpenAPI ---- */
type PersonasListOut = OutputOf<"/api/v5/artifacts/personas/list", "post">;
type DuplicatePersonaIn = InputOf<"/api/v5/artifacts/personas/duplicate", "post">;
type DuplicatePersonaOut = OutputOf<"/api/v5/artifacts/personas/duplicate", "post">;
type DeletePersonaIn = InputOf<"/api/v5/artifacts/personas/delete", "post">;
type DeletePersonaOut = OutputOf<"/api/v5/artifacts/personas/delete", "post">;
type SavePersonaIn = InputOf<"/api/v5/artifacts/personas/save", "post">;
type SavePersonaOut = OutputOf<"/api/v5/artifacts/personas/save", "post">;
type SearchColorsIn = InputOf<"/api/v5/resources/colors/search", "post">;
type SearchColorsOut = NonNullable<OutputOf<"/api/v5/resources/colors/search", "post">["items"]>;
type SearchIconsIn = InputOf<"/api/v5/resources/icons/search", "post">;
type SearchIconsOut = NonNullable<OutputOf<"/api/v5/resources/icons/search", "post">["items"]>;
type SearchVoicesIn = InputOf<"/api/v5/resources/voices/search", "post">;
type SearchVoicesOut = NonNullable<OutputOf<"/api/v5/resources/voices/search", "post">["items"]>;
type ParseCsvIn = InputOf<"/api/v5/uploads/csv", "post">;
type ParseCsvOut = OutputOf<"/api/v5/uploads/csv", "post">;

/** ---- Body type for personas list request ---- */
type PersonasListBody = {
  search?: string | null;
  scenario_ids?: string[] | null;
  field_ids?: string[] | null;
  filter_department_ids?: string[] | null;
  scenario_search?: string | null;
  field_search?: string | null;
  department_search?: string | null;
  page_size: number | null;
  page_offset: number | null;
};

/** ---- Direct fetch (no Next.js cache) ----
 * Using cache: 'no-store' to disable Next.js default fetch caching so hard refresh works.
 * Sending X-Bypass-Cache header only on hard refresh to bypass Redis cache.
 */
const getPersonasList = async (body: PersonasListBody): Promise<PersonasListOut> => {
  const bypassCache = await isHardRefresh();
  return api.post(
    "/artifacts/personas/list",
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
async function duplicatePersona(
  input: DuplicatePersonaIn
): Promise<DuplicatePersonaOut> {
  "use server";
  return api.post("/artifacts/personas/duplicate", input);
}

async function deletePersona(
  input: DeletePersonaIn
): Promise<DeletePersonaOut> {
  "use server";
  return api.post("/artifacts/personas/delete", input);
}

async function savePersona(
  input: SavePersonaIn
): Promise<SavePersonaOut> {
  "use server";
  return api.post("/artifacts/personas/save", input);
}

async function searchColors(): Promise<SearchColorsOut> {
  "use server";
  const res = await api.post("/resources/colors/search", {
    body: { search: null, limit_count: 100, offset_count: 0, persona: true, setting: false },
  } as SearchColorsIn);
  return res.items ?? [];
}

async function searchIcons(): Promise<SearchIconsOut> {
  "use server";
  const res = await api.post("/resources/icons/search", {
    body: { search: null, limit_count: 100, offset_count: 0, persona: true },
  } as SearchIconsIn);
  return res.items ?? [];
}

async function searchVoices(): Promise<SearchVoicesOut> {
  "use server";
  const res = await api.post("/resources/voices/search", {
    body: { search: null, limit_count: 100, offset_count: 0, persona: true, agent: false, model: false },
  } as SearchVoicesIn);
  return res.items ?? [];
}

async function parseCsv(input: ParseCsvIn): Promise<ParseCsvOut> {
  "use server";
  return api.post("/uploads/csv", input);
}

/** ---- Docs types for page metadata ---- */
type DocsIn = InputOf<"/api/v5/artifacts/personas/docs", "post">;
type DocsOut = OutputOf<"/api/v5/artifacts/personas/docs", "post">;

const getDocs = async (input: DocsIn): Promise<DocsOut> => {
  return api.post("/artifacts/personas/docs", input);
};

export async function generateMetadata(): Promise<Metadata> {
  const docs = await getDocs({ body: {} });
  return { title: docs.list.title, description: docs.list.description };
}

interface PersonasPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function PersonasPage({ searchParams }: PersonasPageProps) {
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

  const q = loadPersonasSearchParams(searchParamsObj);

  // Compute pagination
  const pageIndex = q.page ?? 0;
  const pageSize = q.pageSize ?? 12;
  const offset = pageIndex * pageSize;

  // Build request body with filter values from URL
  const body: PersonasListBody = {
    search: q.search || null,
    scenario_ids: q.scenarioIds && q.scenarioIds.length > 0 ? q.scenarioIds : null,
    field_ids: q.fieldIds && q.fieldIds.length > 0 ? q.fieldIds : null,
    filter_department_ids: q.departmentIds && q.departmentIds.length > 0 ? q.departmentIds : null,
    scenario_search: q.scenarioSearch || null,
    field_search: q.fieldSearch || null,
    department_search: q.departmentSearch || null,
    page_size: pageSize,
    page_offset: offset,
  };

  // Fetch list data and view cookie in parallel
  const [listData, initialColumnVisibility] = await Promise.all([
    getPersonasList(body),
    readViewCookie("personas"),
  ]);

  return (
    <div className="space-y-6" data-page="personas-index">
      <Personas
        listData={listData}
        initialColumnVisibility={initialColumnVisibility}
        duplicatePersonaAction={duplicatePersona}
        deletePersonaAction={deletePersona}
        savePersonaAction={savePersona}
        searchColorsAction={searchColors}
        searchIconsAction={searchIcons}
        searchVoicesAction={searchVoices}
        parseCsvAction={parseCsv}
        importFields={listData.import_fields ?? undefined}
        pageIndex={pageIndex}
        pageSize={pageSize}
        totalCount={listData.total_count ?? 0}
        scenarioSearch={q.scenarioSearch ?? ""}
        fieldSearch={q.fieldSearch ?? ""}
        departmentSearch={q.departmentSearch ?? ""}
      />
    </div>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  DeletePersonaIn,
  DeletePersonaOut,
  DuplicatePersonaIn,
  DuplicatePersonaOut,
  ParseCsvIn,
  ParseCsvOut,
  PersonasListOut,
  SavePersonaIn,
  SavePersonaOut,
  SearchColorsOut,
  SearchIconsOut,
  SearchVoicesOut,
};
