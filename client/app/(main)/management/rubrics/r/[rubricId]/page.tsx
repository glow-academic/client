/**
 * app/management/rubrics/r/[rubricId]/page.tsx
 * Rubric editing page
 * @AshokSaravanan222 & @siladiea
 * 06/09/2025
 */

import Rubric from "@/components/rubrics/Rubric";
import { DepartmentAccessDenied } from "@/components/common/layout/DepartmentAccessDenied";
import { getSession } from "@/auth";

import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata, ResolvingMetadata } from "next";
import { revalidateTag, unstable_cache } from "next/cache";

/** ---- Strong types from OpenAPI ---- */
type RubricDetailIn = InputOf<"/api/v3/rubrics/detail", "post">;
type RubricDetailOut = OutputOf<"/api/v3/rubrics/detail", "post">;

type RubricDetailDefaultIn = InputOf<"/api/v3/rubrics/detail-default", "post">;
type RubricDetailDefaultOut = OutputOf<
  "/api/v3/rubrics/detail-default",
  "post"
>;
type UpdateRubricIn = InputOf<"/api/v3/rubrics/update", "post">;
type UpdateRubricOut = OutputOf<"/api/v3/rubrics/update", "post">;

/** ---- Cached fetch used by both page + metadata (prevents double hit) ---- */
const getRubric = (rubricId: string) =>
  unstable_cache(
    async (profileId: string): Promise<RubricDetailOut> => {
      return api.post("/rubrics/detail", {
        body: { rubricId, profileId },
      });
    },
    ["rubrics:detail", rubricId],
    { tags: ["rubrics", `rubric:${rubricId}`] }
  );

const getRubricDefault = unstable_cache(
  async (profileId: string): Promise<RubricDetailDefaultOut> => {
    return api.post("/rubrics/detail-default", {
      body: { profileId },
    });
  },
  ["rubrics:detail-default"],
  { tags: ["rubrics"] }
);

/** ---- Metadata uses the same cached fetch ---- */
export async function generateMetadata(
  { params }: { params: Promise<{ rubricId: string }> },
  _parent: ResolvingMetadata,
): Promise<Metadata> {
  const { rubricId } = await params;
  const session = await getSession();
  const profileId = session?.effectiveProfileId || "";

  try {
    const rubric = await getRubric(rubricId)(profileId);
    return {
      title: `${rubric?.name || "Rubric"}`,
      description: `${rubric ? `${rubric.name} ${rubric.description || ""}` : "Rubric"} in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
    };
  } catch {
    return {
      title: "Rubric",
      description: `Rubric in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
    };
  }
}

/** ---- Server renders client with typed data (read-only, mutations in child components) ---- */
export default async function EditRubricPage({
  params,
}: {
  params: Promise<{ rubricId: string }>;
}) {
  const { rubricId } = await params;
  const session = await getSession();
  const profileId = session?.effectiveProfileId || "";

  // Fetch data based on mode (edit vs create)
  try {
    const [rubricDetail, rubricDetailDefault] = await Promise.all([
      rubricId
        ? getRubric(rubricId)(profileId).catch(() => null)
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
          {...(rubricDetailDefault && { rubricDetailDefault })}
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
        <DepartmentAccessDenied
          resourceType="rubric"
          redirectPath="/management/rubrics"
        />
      );
    }
    // Re-throw other errors
    throw error;
  }
}

/** ---- Strongly-typed server actions (single source of truth) ---- */
export async function updateRubric(
  input: UpdateRubricIn,
): Promise<UpdateRubricOut> {
  "use server";
  const out = await api.post("/rubrics/update", input);
  revalidateTag("rubrics");
  const rubricId = input.body?.rubricId;
  if (rubricId) {
    revalidateTag(`rubric:${rubricId}`);
  }
  return out;
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  RubricDetailDefaultIn,
  RubricDetailDefaultOut,
  RubricDetailIn,
  RubricDetailOut,
  UpdateRubricIn,
  UpdateRubricOut,
};
