/**
 * app/engine/rubrics/new/page.tsx
 * New rubric creation page using the unified rubric component
 * @AshokSaravanan222 & @siladiea
 * 06/09/2025
 */

import Rubric from "@/components/rubrics/Rubric";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";
import { createLoader, parseAsString } from "nuqs/server";

/** ---- Strong types from OpenAPI ---- */
type GetRubricOut = OutputOf<"/api/v4/rubrics/get", "post">;
type SaveRubricIn = InputOf<"/api/v4/rubrics/save", "post">;
type SaveRubricOut = OutputOf<"/api/v4/rubrics/save", "post">;
type PatchRubricDraftIn = InputOf<"/api/v4/rubrics/draft", "patch">;
type PatchRubricDraftOut = OutputOf<"/api/v4/rubrics/draft", "patch">;

/** ---- Direct fetch (no caching - source of truth) ----
 * Always bypass cache to ensure fresh data for new pages.
 */
const getRubric = async (
  draftId: string | null,
  descriptionSearch: string | null,
  standardGroupSearch: string | null
): Promise<GetRubricOut> => {
  return api.post(
    "/rubrics/get",
    {
      body: {
        rubric_id: null,
        draft_id: draftId || null,
        description_search: descriptionSearch || null,
        standard_group_search: standardGroupSearch || null,
      },
    },
    {
      cache: "no-store",
      headers: {
        "X-Bypass-Cache": "1",
      },
    }
  );
};

/** ---- Strongly-typed server actions (single source of truth) ---- */
async function saveRubric(input: SaveRubricIn): Promise<SaveRubricOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/rubrics/save", input);
}

async function patchRubricDraft(
  input: PatchRubricDraftIn
): Promise<PatchRubricDraftOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  // No revalidateTag needed - Redis cache handles invalidation
  return api.patch("/rubrics/draft", input);
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "New Rubric",
    description:
      "Create a new assessment rubric for teaching assistant evaluation. Design rubric-based evaluation criteria to assess pedagogical performance, teaching effectiveness, and student interaction skills through structured assessment frameworks.",
  };
}

/** ---- Server renders client with typed data (mutations in child components) ---- */
export default async function NewRubricPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
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

  // Inline server-side parsers for rubric search params
  const rubricSearchParams = {
    draftId: parseAsString,
    descriptionSearch: parseAsString,
    standardGroupSearch: parseAsString,
  };
  const loadRubricSearchParams = createLoader(rubricSearchParams);
  const q = loadRubricSearchParams(searchParamsObj);

  // Fetch rubric data using unified get endpoint (rubric_id = null for new mode)
  const rubricData = await getRubric(
    q.draftId ?? null,
    q.descriptionSearch ?? null,
    q.standardGroupSearch ?? null
  );

  return (
    <div className="space-y-6" data-page="rubric-new">
      <Rubric
        key={q.draftId || "no-draft"} // Force remount when draftId changes to ensure clean state reset
        rubricData={rubricData}
        saveRubricAction={saveRubric}
        patchRubricDraftAction={patchRubricDraft}
      />
    </div>
  );
}

// Types are now defined inline in components using InputOf/OutputOf
