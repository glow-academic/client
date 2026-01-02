/**
 * app/(main)/create/cohorts/new/page.tsx
 * New cohort page for the cohorts section.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import Cohort from "@/components/cohorts/Cohort";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";
import {
  createLoader,
  parseAsArrayOf,
  parseAsBoolean,
  parseAsString,
} from "nuqs/server";

/** ---- Strong types from OpenAPI ---- */
type CohortNewIn = InputOf<"/api/v4/cohorts/new", "post">;
type CohortNewOut = OutputOf<"/api/v4/cohorts/new", "post">;
type CreateCohortIn = InputOf<"/api/v4/cohorts/create", "post">;
type CreateCohortOut = OutputOf<"/api/v4/cohorts/create", "post">;
type PatchCohortDraftIn = InputOf<"/api/v4/cohorts/draft", "patch">;
type PatchCohortDraftOut = OutputOf<"/api/v4/cohorts/draft", "patch">;
/** ---- Direct fetch (no caching - source of truth) ----
 * Always bypass cache to ensure fresh data for detail/edit pages.
 */
const getCohortDefault = async (input: CohortNewIn): Promise<CohortNewOut> => {
  return api.post("/cohorts/new", input, {
    cache: "no-store",
    headers: {
      "X-Bypass-Cache": "1",
    },
  });
};

/** ---- Strongly-typed server actions (single source of truth) ---- */
async function createCohort(input: CreateCohortIn): Promise<CreateCohortOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/cohorts/create", input);
}

async function patchCohortDraft(
  input: PatchCohortDraftIn
): Promise<PatchCohortDraftOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  return api.patch("/cohorts/draft", input);
}

/** ---- Server action for searching profiles to add to cohort ---- */

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "New Cohort",
    description:
      "Create a new learning cohort for teaching assistant training programs. Organize groups of teaching assistants, configure cohort settings, and set up group-based learning activities for effective L&D program administration.",
  };
}

export default async function NewCohortPage({
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

  // Inline server-side parsers for cohort search params
  const cohortSearchParams = {
    draftId: parseAsString,
    simulationIds: parseAsArrayOf(parseAsString),
    departmentIds: parseAsArrayOf(parseAsString),
    // Search/filter params
    simulationSearch: parseAsString,
    simulationShowSelected: parseAsBoolean,
  };
  const loadCohortSearchParams = createLoader(cohortSearchParams);
  const q = loadCohortSearchParams(searchParamsObj);

  // Fetch default cohort detail server-side with filter params and draft_id
  // Note: current_simulation_ids will be extracted from draft payload in SQL if draft exists
  const input: CohortNewIn = {
    body: {
      draft_id: q.draftId ?? null,
      simulation_search: q.simulationSearch ?? null,
      simulation_show_selected: q.simulationShowSelected ?? null,
      current_simulation_ids: null, // Will be extracted from draft payload in SQL
    } as CohortNewIn["body"],
  };
  const cohortDetailDefault = await getCohortDefault(input);

  return (
    <div
      className="space-y-6"
      data-page="cohort-new"
      aria-label="Create new cohort page"
    >
      <Cohort
        key={q.draftId || "no-draft"} // Force remount when draftId changes to ensure clean state reset
        cohortDetailDefault={cohortDetailDefault}
        createCohortAction={createCohort}
        patchCohortDraftAction={patchCohortDraft}
      />
    </div>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  CohortNewIn,
  CohortNewOut,
  CreateCohortIn,
  CreateCohortOut,
  PatchCohortDraftIn,
  PatchCohortDraftOut,
};
