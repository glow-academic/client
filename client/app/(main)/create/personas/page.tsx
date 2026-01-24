/**
 * app/(main)/create/personas/page.tsx
 * Persona list page - server-side filtering with nuqs URL-backed state
 * @AshokSaravanan222 & @siladiea
 * 06/09/2025
 */
import Personas from "@/components/personas/Personas";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import type { Metadata } from "next";

import { loadPersonasSearchParams } from "./searchParams";

/** ---- Strong types from OpenAPI ---- */
type PersonasListOut = OutputOf<"/api/v4/personas/list", "post">;
type DuplicatePersonaIn = InputOf<"/api/v4/personas/duplicate", "post">;
type DuplicatePersonaOut = OutputOf<"/api/v4/personas/duplicate", "post">;
type DeletePersonaIn = InputOf<"/api/v4/personas/delete", "post">;
type DeletePersonaOut = OutputOf<"/api/v4/personas/delete", "post">;

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
    "/personas/list",
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
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/personas/duplicate", input);
}

async function deletePersona(
  input: DeletePersonaIn
): Promise<DeletePersonaOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/personas/delete", input);
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Personas",
    description:
      "Manage AI-powered student personas for teaching assistant training. Create and organize realistic student profiles with diverse personalities and learning styles to enhance simulation-based pedagogical practice and student interaction training.",
  };
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

  // Fetch list data server-side with filters
  const listData = await getPersonasList(body);

  return (
    <div className="space-y-6" data-page="personas-index">
      <Personas
        listData={listData}
        duplicatePersonaAction={duplicatePersona}
        deletePersonaAction={deletePersona}
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
  PersonasListOut,
};
