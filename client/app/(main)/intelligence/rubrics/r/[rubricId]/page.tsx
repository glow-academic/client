/**
 * app/engine/rubrics/r/[rubricId]/page.tsx
 * Rubric editing page
 * @AshokSaravanan222 & @siladiea
 * 06/09/2025
 */

import { UnifiedAccessDenied } from "@/components/common/layout/UnifiedAccessDenied";
import Rubric from "@/components/rubrics/Rubric";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata, ResolvingMetadata } from "next";
import { createLoader, parseAsString } from "nuqs/server";

/** ---- Strong types from OpenAPI ---- */
type GetRubricIn = InputOf<"/api/v4/rubrics/get", "post">;
type GetRubricOut = OutputOf<"/api/v4/rubrics/get", "post">;
type SaveRubricIn = InputOf<"/api/v4/rubrics/save", "post">;
type SaveRubricOut = OutputOf<"/api/v4/rubrics/save", "post">;
type PatchRubricDraftIn = InputOf<"/api/v4/rubrics/draft", "patch">;
type PatchRubricDraftOut = OutputOf<"/api/v4/rubrics/draft", "patch">;
type CreateDraftStandardsIn = InputOf<"/api/v4/resources/standards", "post">;
type CreateDraftStandardsOut = OutputOf<
  "/api/v4/resources/standards",
  "post"
>;

/** ---- Direct fetch (no caching - source of truth) ----
 * Always bypass cache to ensure fresh data for detail/edit pages.
 */
const getRubric = async (
  rubricId: string | null,
  draftId: string | null,
  descriptionSearch: string | null,
  standardGroupSearch: string | null
): Promise<GetRubricOut> => {
  return api.post(
    "/rubrics/get",
    {
      body: {
        rubric_id: rubricId,
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

/** ---- Metadata uses the same cached fetch ---- */
export async function generateMetadata(
  { params }: { params: Promise<{ rubricId: string }> },
  _parent: ResolvingMetadata
): Promise<Metadata> {
  const { rubricId } = await params;
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  try {
    const rubric = await getRubric(rubricId, null, null, null);
    return {
      title: `${rubric?.name_resource?.name || "Rubric"}`,
      description: `${rubric?.name_resource?.name ? `${rubric.name_resource.name} - ` : ""}Assessment rubric for teaching assistant evaluation.${rubric?.description_resource?.description ? ` ${rubric.description_resource.description}` : ""} Customize rubric-based evaluation criteria to assess pedagogical performance, teaching effectiveness, and student interaction skills.`,
    };
  } catch {
    // Fall through to default metadata
  }

  return {
    title: "Rubric",
    description:
      "Assessment rubric for teaching assistant evaluation. Customize rubric-based evaluation criteria to assess pedagogical performance, teaching effectiveness, and student interaction skills.",
  };
}

/** ---- Server renders client with typed data (read-only, mutations in child components) ---- */
export default async function EditRubricPage({
  params,
  searchParams,
}: {
  params: Promise<{ rubricId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { rubricId } = await params;
  // Access control handled server-side in layout
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  // Parse search params using nuqs
  const paramsObj = await searchParams;
  const searchParamsObj = new URLSearchParams();
  Object.entries(paramsObj).forEach(([key, value]) => {
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

  // Fetch data using unified get endpoint
  try {
    const rubricData = await getRubric(
      rubricId,
      q.draftId ?? null,
      q.descriptionSearch ?? null,
      q.standardGroupSearch ?? null
    );

    return (
      <div
        className="space-y-6"
        data-page="rubric-edit"
        data-rubric-id={rubricId}
      >
        <Rubric
          rubricId={rubricId}
          rubricData={rubricData}
          saveRubricAction={saveRubric}
          patchRubricDraftAction={patchRubricDraft}
          createStandardsAction={createStandards}
        />
      </div>
    );
  } catch (error: unknown) {
    // Check if it's a 403 error (department access denied)
    if (
      error &&
      typeof error === "object" &&
      "status" in error &&
      error.status === 403
    ) {
      return (
        <UnifiedAccessDenied
          reason="department"
          resourceType="rubric"
          redirectPath="/intelligence/rubrics"
        />
      );
    }
    // Re-throw other errors
    throw error;
  }
}

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

async function createStandards(
  input: CreateDraftStandardsIn
): Promise<CreateDraftStandardsOut> {
  "use server";
  return api.post("/resources/standards", input);
}

// Types are now defined inline in components using InputOf/OutputOf
