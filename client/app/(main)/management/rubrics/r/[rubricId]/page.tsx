/**
 * app/management/rubrics/r/[rubricId]/page.tsx
 * Rubric editing page
 * @AshokSaravanan222 & @siladiea
 * 06/09/2025
 */

import Rubric from "@/components/rubrics/Rubric";
import { getSession } from "@/auth";

import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata, ResolvingMetadata } from "next";
import { revalidateTag } from "next/cache";
import { cache } from "react";

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
const getRubric = cache(
  async (input: RubricDetailIn): Promise<RubricDetailOut> => {
    return api.post("/rubrics/detail", input);
  },
);

const getRubricDefault = cache(
  async (input: RubricDetailDefaultIn): Promise<RubricDetailDefaultOut> => {
    return api.post("/rubrics/detail-default", input);
  },
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
    const rubric = await getRubric({ body: { rubricId, profileId } });
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
  const [rubricDetail, rubricDetailDefault] = await Promise.all([
    rubricId
      ? getRubric({ body: { rubricId, profileId } }).catch(() => null)
      : Promise.resolve(null),
    !rubricId
      ? getRubricDefault({ body: { profileId } }).catch(() => null)
      : Promise.resolve(null),
  ]);

  return (
    <div className="space-y-6">
      <Rubric
        rubricId={rubricId}
        {...(rubricDetail && { rubricDetail })}
        {...(rubricDetailDefault && { rubricDetailDefault })}
        updateRubricAction={updateRubric}
      />
    </div>
  );
}

/** ---- Strongly-typed server actions (single source of truth) ---- */
export async function updateRubric(
  input: UpdateRubricIn,
): Promise<UpdateRubricOut> {
  "use server";
  const out = await api.post("/rubrics/update", input);
  revalidateTag("rubrics");
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
