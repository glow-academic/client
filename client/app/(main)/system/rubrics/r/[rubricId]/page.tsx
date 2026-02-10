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
type GetRubricIn = InputOf<"/api/v4/artifacts/rubrics/get", "post">;
type GetRubricOut = OutputOf<"/api/v4/artifacts/rubrics/get", "post">;
type SaveRubricIn = InputOf<"/api/v4/artifacts/rubrics/save", "post">;
type SaveRubricOut = OutputOf<"/api/v4/artifacts/rubrics/save", "post">;
type PatchRubricDraftIn = InputOf<"/api/v4/artifacts/rubrics/draft", "patch">;
type PatchRubricDraftOut = OutputOf<"/api/v4/artifacts/rubrics/draft", "patch">;
type CreateDraftNamesIn = InputOf<"/api/v4/resources/names", "post">;
type CreateDraftNamesOut = OutputOf<"/api/v4/resources/names", "post">;
type CreateDraftDescriptionsIn = InputOf<
  "/api/v4/resources/descriptions",
  "post"
>;
type CreateDraftDescriptionsOut = OutputOf<
  "/api/v4/resources/descriptions",
  "post"
>;
type CreateDraftPointsIn = InputOf<"/api/v4/resources/points", "post">;
type CreateDraftPointsOut = OutputOf<"/api/v4/resources/points", "post">;
type CreateDraftStandardGroupsIn = InputOf<
  "/api/v4/resources/standard_groups",
  "post"
>;
type CreateDraftStandardGroupsOut = OutputOf<
  "/api/v4/resources/standard_groups",
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
    "/artifacts/rubrics/get",
    ({
      body: {
        rubric_id: rubricId,
        draft_id: draftId || null,
        description_search: descriptionSearch || null,
        standard_group_search: standardGroupSearch || null,
      },
    } as GetRubricIn),
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
    const rubricName = rubric?.names?.resource?.name;
    const rubricDescription = rubric?.descriptions?.resource?.description;
    return {
      title: `${rubricName || "Rubric"}`,
      description: `${rubricName ? `${rubricName} - ` : ""}Assessment rubric for teaching assistant evaluation.${rubricDescription ? ` ${rubricDescription}` : ""} Customize rubric-based evaluation criteria to assess pedagogical performance, teaching effectiveness, and student interaction skills.`,
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
          createNamesAction={createDraftNames}
          createDescriptionsAction={createDraftDescriptions}
          createPointsAction={createDraftPoints}
          createStandardGroupsAction={createDraftStandardGroups}
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
          redirectPath="/system/rubrics"
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
  return api.post("/artifacts/rubrics/save", input);
}

async function patchRubricDraft(
  input: PatchRubricDraftIn
): Promise<PatchRubricDraftOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  // No revalidateTag needed - Redis cache handles invalidation
  return api.patch("/artifacts/rubrics/draft", input);
}

async function createDraftNames(
  input: CreateDraftNamesIn
): Promise<CreateDraftNamesOut> {
  "use server";
  return api.post("/resources/names", input);
}

async function createDraftDescriptions(
  input: CreateDraftDescriptionsIn
): Promise<CreateDraftDescriptionsOut> {
  "use server";
  return api.post("/resources/descriptions", input);
}

async function createDraftPoints(
  input: CreateDraftPointsIn
): Promise<CreateDraftPointsOut> {
  "use server";
  return api.post("/resources/points", input);
}

async function createDraftStandardGroups(
  input: CreateDraftStandardGroupsIn
): Promise<CreateDraftStandardGroupsOut> {
  "use server";
  return api.post("/resources/standard_groups", input);
}

// Types are now defined inline in components using InputOf/OutputOf
