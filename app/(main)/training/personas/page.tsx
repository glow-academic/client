/**
 * app/(main)/create/personas/page.tsx
 * Persona list page - server-side filtering with nuqs URL-backed state
 * @AshokSaravanan222 & @siladiea
 * 06/09/2025
 */
import Personas from "@/components/artifacts/persona/Personas";
import { NewArtifactButton } from "@/components/common/layout/NewArtifactButton";
import { PageHeader } from "@/components/common/layout/PageHeader";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import { readViewCookie } from "@/lib/view-cookie";
import type { Metadata } from "next";

import { loadPersonasSearchParams } from "@/lib/search-params/personas";

/** ---- Strong types from OpenAPI ---- */
type PersonasListOut = OutputOf<"/personas/search", "post">;
type DuplicatePersonaIn = InputOf<"/personas/duplicate", "post">;
type DuplicatePersonaOut = OutputOf<"/personas/duplicate", "post">;
type DeletePersonaIn = InputOf<"/personas/delete", "post">;
type DeletePersonaOut = OutputOf<"/personas/delete", "post">;
type CreatePersonaIn = InputOf<"/personas/create", "post">;
type CreatePersonaOut = OutputOf<"/personas/create", "post">;
type UpdatePersonaIn = InputOf<"/personas/update", "post">;
type UpdatePersonaOut = OutputOf<"/personas/update", "post">;
import type { ParseCsvResult } from "@/components/common/BulkImport";

/** ---- Body type for personas list request ---- */
type PersonasListBody = {
  search?: string | null;
  scenario_ids?: string[] | null;
  field_ids?: string[] | null;
  filter_department_ids?: string[] | null;
  scenario_search?: string | null;
  field_search?: string | null;
  department_search?: string | null;
  color_search?: string | null;
  icon_search?: string | null;
  voice_search?: string | null;
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
    "/personas/search",
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
  return api.post("/personas/duplicate", input);
}

async function deletePersona(
  input: DeletePersonaIn
): Promise<DeletePersonaOut> {
  "use server";
  return api.post("/personas/delete", input);
}

async function createPersona(input: CreatePersonaIn): Promise<CreatePersonaOut> {
  "use server";
  return api.post("/personas/create", input);
}

async function updatePersona(input: UpdatePersonaIn): Promise<UpdatePersonaOut> {
  "use server";
  return api.post("/personas/update", input);
}

async function parseCsv(formData: FormData): Promise<ParseCsvResult> {
  "use server";
  return api.post("/personas/csv", { formData });
}

/** ---- Docs types for page metadata ---- */
type DocsIn = InputOf<"/personas/docs", "post">;
type DocsOut = OutputOf<"/personas/docs", "post">;

const getDocs = async (input: DocsIn): Promise<DocsOut> => {
  return api.post("/personas/docs", input);
};

export async function generateMetadata(): Promise<Metadata> {
  const docs = await getDocs({ body: {} });
  return { title: docs.page_metadata?.list.title, description: docs.page_metadata?.list.description };
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
    color_search: q.colorSearch || null,
    icon_search: q.iconSearch || null,
    voice_search: q.voiceSearch || null,
    page_size: pageSize,
    page_offset: offset,
  };

  // Fetch list data and view cookie in parallel
  const [listData, initialColumnVisibility] = await Promise.all([
    getPersonasList(body),
    readViewCookie("personas"),
  ]);

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { title: "Training", section: "training", url: "/training" },
          { title: "Personas" },
        ]}
        toolbar={<NewArtifactButton label="New Persona" href="/training/personas/new" />}
      />
      <div className="space-y-6 px-4" data-page="personas-index">
        <Personas
          listData={listData}
          initialColumnVisibility={initialColumnVisibility}
          duplicatePersonaAction={duplicatePersona}
          deletePersonaAction={deletePersona}
          createPersonaAction={createPersona}
          updatePersonaAction={updatePersona}
          parseCsvAction={parseCsv}
          importFields={listData.import_fields ?? undefined}
          pageIndex={pageIndex}
          pageSize={pageSize}
          totalCount={listData.total_count ?? 0}
          scenarioSearch={q.scenarioSearch ?? ""}
          fieldSearch={q.fieldSearch ?? ""}
          departmentSearch={q.departmentSearch ?? ""}
          colorSearch={q.colorSearch ?? ""}
          iconSearch={q.iconSearch ?? ""}
          voiceSearch={q.voiceSearch ?? ""}
        />
      </div>
    </>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  DeletePersonaIn,
  DeletePersonaOut,
  DuplicatePersonaIn,
  DuplicatePersonaOut,
  PersonasListOut,
  CreatePersonaIn,
  CreatePersonaOut,
  UpdatePersonaIn,
  UpdatePersonaOut,
};
