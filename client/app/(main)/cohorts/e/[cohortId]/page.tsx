/**
 * app/(main)/cohorts/e/[cohortId]/page.tsx
 * Cohort edit page for the cohort.
 * @AshokSaravanan222 & @siladiea
 * 07/20/2025
 */

import { auth } from "@/auth";
import Cohort from "@/components/cohorts/Cohort";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata, ResolvingMetadata } from "next";
import { revalidateTag } from "next/cache";
import { cache } from "react";

/** ---- Strong types from OpenAPI ---- */
type CohortDetailIn = InputOf<"/api/v3/cohorts/detail", "post">;
type CohortDetailOut = OutputOf<"/api/v3/cohorts/detail", "post">;
type CohortDetailDefaultIn = InputOf<
  "/api/v3/cohorts/detail-default",
  "post"
>;
type CohortDetailDefaultOut = OutputOf<
  "/api/v3/cohorts/detail-default",
  "post"
>;
type CreateCohortIn = InputOf<"/api/v3/cohorts/create", "post">;
type CreateCohortOut = OutputOf<"/api/v3/cohorts/create", "post">;
type UpdateCohortIn = InputOf<"/api/v3/cohorts/update", "post">;
type UpdateCohortOut = OutputOf<"/api/v3/cohorts/update", "post">;

/** ---- Cached fetch used by both page + metadata (prevents double hit) ---- */
const getCohort = cache(
  async (input: CohortDetailIn): Promise<CohortDetailOut> => {
    return api.post("/cohorts/detail", input);
  }
);

const getCohortDefault = cache(
  async (
    input: CohortDetailDefaultIn
  ): Promise<CohortDetailDefaultOut> => {
    return api.post("/cohorts/detail-default", input);
  }
);

/** ---- Metadata uses the same cached fetch ---- */
export async function generateMetadata(
  { params }: { params: Promise<{ cohortId: string }> },
  _parent: ResolvingMetadata
): Promise<Metadata> {
  const { cohortId } = await params;
  const session = await auth();
  const profileId = session?.effectiveProfileId || "";

  try {
    const cohort = await getCohort({ body: { cohortId, profileId } });
    return {
      title: `${cohort?.title || "Cohort"} Edit`,
      description: `${cohort ? `${cohort.title} ${cohort.description || ""}` : "Cohort"} in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
    };
  } catch {
    return {
      title: "Cohort Edit",
      description: `Cohort in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
    };
  }
}

/** ---- Strongly-typed server actions (single source of truth) ---- */
export async function createCohort(
  input: CreateCohortIn
): Promise<CreateCohortOut> {
  "use server";
  const out = await api.post("/cohorts/create", input);
  revalidateTag("cohorts");
  return out;
}

export async function updateCohort(
  input: UpdateCohortIn
): Promise<UpdateCohortOut> {
  "use server";
  const out = await api.post("/cohorts/update", input);
  revalidateTag("cohorts");
  return out;
}

/** ---- Server renders client with typed data and actions ---- */
export default async function CohortEditPage({
  params,
}: {
  params: Promise<{ cohortId: string }>;
}) {
  const { cohortId } = await params;
  const session = await auth();
  const profileId = session?.effectiveProfileId || "";

  // Fetch cohort detail (cached, won't duplicate with metadata)
  const cohortDetail = await getCohort({ body: { cohortId, profileId } });

  return (
    <div className="space-y-6">
      <Cohort
        cohortId={cohortId}
        cohortDetail={cohortDetail}
        createCohortAction={createCohort}
        updateCohortAction={updateCohort}
      />
    </div>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  CohortDetailIn,
  CohortDetailOut,
  CohortDetailDefaultIn,
  CohortDetailDefaultOut,
  CreateCohortIn,
  CreateCohortOut,
  UpdateCohortIn,
  UpdateCohortOut,
};
