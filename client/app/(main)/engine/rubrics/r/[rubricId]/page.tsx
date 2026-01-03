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
type RubricDetailIn = InputOf<"/api/v4/rubrics/detail", "post">;
type RubricDetailOut = OutputOf<"/api/v4/rubrics/detail", "post">;

type RubricNewIn = InputOf<"/api/v4/rubrics/new", "post">;
type RubricNewOut = OutputOf<"/api/v4/rubrics/new", "post">;
type UpdateRubricIn = InputOf<"/api/v4/rubrics/update", "post">;
type UpdateRubricOut = OutputOf<"/api/v4/rubrics/update", "post">;
type PatchRubricDraftIn = InputOf<"/api/v4/rubrics/draft", "patch">;
type PatchRubricDraftOut = OutputOf<"/api/v4/rubrics/draft", "patch">;

/** ---- Direct fetch (no caching - source of truth) ----
 * Always bypass cache to ensure fresh data for detail/edit pages.
 */
const getRubric = async (
  rubricId: string,
  draftId: string | null
): Promise<RubricDetailOut> => {
  return api.post(
    "/rubrics/detail",
    { body: { rubric_id: rubricId, draft_id: draftId || null } },
    {
      cache: "no-store",
      headers: {
        "X-Bypass-Cache": "1",
      },
    }
  );
};

const getRubricDefault = async (
  draftId: string | null
): Promise<RubricNewOut> => {
  return api.post(
    "/rubrics/new",
    { body: { draft_id: draftId || null } },
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
    const rubric = await getRubric(rubricId, null);
    return {
      title: `${rubric?.name || "Rubric"}`,
      description: `${rubric?.name ? `${rubric.name} - ` : ""}Assessment rubric for teaching assistant evaluation.${rubric?.description ? ` ${rubric.description}` : ""} Customize rubric-based evaluation criteria to assess pedagogical performance, teaching effectiveness, and student interaction skills.`,
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
  };
  const loadRubricSearchParams = createLoader(rubricSearchParams);
  const q = loadRubricSearchParams(searchParamsObj);

  // Fetch data based on mode (edit vs create) with draft_id
  try {
    const [rubricDetail, rubricNew] = await Promise.all([
      rubricId
        ? getRubric(rubricId, q.draftId ?? null).catch(() => null)
        : Promise.resolve(null),
      !rubricId
        ? getRubricDefault(q.draftId ?? null).catch(() => null)
        : Promise.resolve(null),
    ]);

    return (
      <div
        className="space-y-6"
        data-page="rubric-edit"
        data-rubric-id={rubricId}
      >
        <Rubric
          rubricId={rubricId}
          {...(rubricDetail && { rubricDetail })}
          {...(rubricNew && { rubricDetailDefault: rubricNew })}
          updateRubricAction={updateRubric}
          patchRubricDraftAction={patchRubricDraft}
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
          redirectPath="/engine/rubrics"
        />
      );
    }
    // Re-throw other errors
    throw error;
  }
}

/** ---- Strongly-typed server actions (single source of truth) ---- */
async function updateRubric(input: UpdateRubricIn): Promise<UpdateRubricOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/rubrics/update", input);
}

async function patchRubricDraft(
  input: PatchRubricDraftIn
): Promise<PatchRubricDraftOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  return api.patch("/rubrics/draft", input);
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  RubricDetailIn,
  RubricDetailOut,
  RubricNewIn,
  RubricNewOut,
  UpdateRubricIn,
  UpdateRubricOut,
  PatchRubricDraftIn,
  PatchRubricDraftOut,
};
