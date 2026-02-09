/**
 * app/(main)/engine/rubrics/page.tsx
 * Rubric list page - redirects to home with rubrics section
 * @AshokSaravanan222 & @siladiea
 * 06/09/2025
 */
import Rubrics from "@/components/rubrics/Rubrics";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import type { Metadata } from "next";

/** ---- Strong types from OpenAPI ---- */
type RubricsListOut = OutputOf<"/api/v4/artifacts/rubrics/list", "post">;
type DuplicateRubricIn = InputOf<"/api/v4/artifacts/rubrics/duplicate", "post">;
type DuplicateRubricOut = OutputOf<"/api/v4/artifacts/rubrics/duplicate", "post">;
type DeleteRubricIn = InputOf<"/api/v4/artifacts/rubrics/delete", "post">;
type DeleteRubricOut = OutputOf<"/api/v4/artifacts/rubrics/delete", "post">;
type SaveRubricIn = InputOf<"/api/v4/artifacts/rubrics/save", "post">;
type SaveRubricOut = OutputOf<"/api/v4/artifacts/rubrics/save", "post">;

/** ---- Direct fetch (no Next.js cache) ----
 * Using cache: 'no-store' to disable Next.js default fetch caching so hard refresh works.
 * Sending X-Bypass-Cache header only on hard refresh to bypass Redis cache.
 */
const getRubricsList = async (): Promise<RubricsListOut> => {
  const bypassCache = await isHardRefresh();
  return api.post(
    "/artifacts/rubrics/list",
    { body: {} },
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

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Rubrics",
    description:
      "Manage assessment rubrics for teaching assistant evaluation. Create and customize rubric-based evaluation criteria to assess pedagogical performance, teaching effectiveness, and student interaction skills.",
  };
}

export default async function RubricsPage() {
  // Access control handled server-side in layout
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  // Fetch list data server-side
  const listData = await getRubricsList();

  return (
    <div className="space-y-6" data-page="rubrics-index">
      <Rubrics
        listData={listData}
        duplicateRubricAction={duplicateRubric}
        deleteRubricAction={deleteRubric}
        saveRubricAction={saveRubric}
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
