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
import { getSession } from "@/auth";
import type { Metadata, ResolvingMetadata } from "next";

/** ---- Strong types from OpenAPI ---- */
type RubricDetailIn = InputOf<"/api/v3/rubrics/detail", "post">;
type RubricDetailOut = OutputOf<"/api/v3/rubrics/detail", "post">;

type RubricNewIn = InputOf<"/api/v3/rubrics/new", "post">;
type RubricNewOut = OutputOf<"/api/v3/rubrics/new", "post">;
type UpdateRubricIn = InputOf<"/api/v3/rubrics/update", "post">;
type UpdateRubricOut = OutputOf<"/api/v3/rubrics/update", "post">;

/** ---- Direct fetch (no caching - source of truth) ----
 * Always bypass cache to ensure fresh data for detail/edit pages.
 */
const getRubric = async (
  rubricId: string,
  profileId: string
): Promise<RubricDetailOut> => {
  return api.post(
    "/rubrics/detail",
    { body: { rubricId, profileId } },
    {
      cache: "no-store",
      headers: {
        "X-Bypass-Cache": "1",
      },
    }
  );
};

const getRubricDefault = async (profileId: string): Promise<RubricNewOut> => {
  return api.post(
    "/rubrics/new",
    { body: { profileId } },
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
  const session = await getSession();
  const profileId = session?.effectiveProfileId;

  if (profileId) {
    try {
      const rubric = await getRubric(rubricId, profileId);
      return {
        title: `${rubric?.name || "Rubric"}`,
        description: `${rubric?.name ? `${rubric.name} - ` : ""}Assessment rubric for teaching assistant evaluation.${rubric?.description ? ` ${rubric.description}` : ""} Customize rubric-based evaluation criteria to assess pedagogical performance, teaching effectiveness, and student interaction skills.`,
      };
    } catch {
      // Fall through to default metadata
    }
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
}: {
  params: Promise<{ rubricId: string }>;
}) {
  const { rubricId } = await params;
  // Access control is handled server-side in layout
  // Get profileId from session
  const session = await getSession();
  const profileId = session?.effectiveProfileId;

  if (!profileId) {
    // This should not happen due to server-side access control, but handle gracefully
    return null;
  }

  // Fetch data based on mode (edit vs create)
  try {
    const [rubricDetail, rubricNew] = await Promise.all([
      rubricId
        ? getRubric(rubricId, profileId).catch(() => null)
        : Promise.resolve(null),
      !rubricId
        ? getRubricDefault(profileId).catch(() => null)
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
  const session = await getSession();
  const profileId = session?.effectiveProfileId;
  if (!profileId) {
    throw new Error("Authentication required");
  }
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/rubrics/update", {
    ...input,
    body: { ...input.body, profileId },
  });
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  RubricDetailIn,
  RubricDetailOut,
  RubricNewIn,
  RubricNewOut,
  UpdateRubricIn,
  UpdateRubricOut,
};
