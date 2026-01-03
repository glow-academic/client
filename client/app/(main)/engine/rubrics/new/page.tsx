/**
 * app/engine/rubrics/new/page.tsx
 * New rubric creation page using the unified rubric component
 * @AshokSaravanan222 & @siladiea
 * 06/09/2025
 */

import { createRubric } from "@/app/(main)/engine/rubrics/page";
import Rubric from "@/components/rubrics/Rubric";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";
import { createLoader, parseAsString } from "nuqs/server";

/** ---- Strong types from OpenAPI ---- */
type RubricNewIn = InputOf<"/api/v4/rubrics/new", "post">;
type RubricNewOut = OutputOf<"/api/v4/rubrics/new", "post">;
type PatchRubricDraftIn = InputOf<"/api/v4/rubrics/draft", "patch">;
type PatchRubricDraftOut = OutputOf<"/api/v4/rubrics/draft", "patch">;

/** ---- Direct fetch (no caching - source of truth) ----
 * Always bypass cache to ensure fresh data for new pages.
 */
const getRubricDefault = async (
  input: RubricNewIn
): Promise<RubricNewOut> => {
  return api.post("/rubrics/new", input, {
    cache: "no-store",
    headers: {
      "X-Bypass-Cache": "1",
    },
  });
};

/** ---- Strongly-typed server actions (single source of truth) ---- */
async function patchRubricDraft(
  input: PatchRubricDraftIn
): Promise<PatchRubricDraftOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
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
  };
  const loadRubricSearchParams = createLoader(rubricSearchParams);
  const q = loadRubricSearchParams(searchParamsObj);

  // Fetch default rubric detail server-side with draft_id
  const rubricNew = await getRubricDefault({
    body: {
      draft_id: q.draftId ?? null,
    },
  });

  return (
    <div className="space-y-6" data-page="rubric-new">
      <Rubric
        key={q.draftId || "no-draft"} // Force remount when draftId changes to ensure clean state reset
        rubricDetailDefault={rubricNew}
        createRubricAction={createRubric}
        patchRubricDraftAction={patchRubricDraft}
      />
    </div>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  RubricNewIn,
  RubricNewOut,
  PatchRubricDraftIn,
  PatchRubricDraftOut,
};
