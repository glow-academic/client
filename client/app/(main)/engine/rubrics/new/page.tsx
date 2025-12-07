/**
 * app/engine/rubrics/new/page.tsx
 * New rubric creation page using the unified rubric component
 * @AshokSaravanan222 & @siladiea
 * 06/09/2025
 */

import { createRubric } from "@/app/(main)/engine/rubrics/page";
import { getSession } from "@/auth";

import Rubric from "@/components/rubrics/Rubric";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";
import { cache } from "react";

/** ---- Strong types from OpenAPI ---- */
type RubricNewIn = InputOf<"/api/v3/rubrics/new", "post">;
type RubricNewOut = OutputOf<"/api/v3/rubrics/new", "post">;

/** ---- Cached fetch used by both page + metadata (prevents double hit) ---- */
const getRubricDefault = cache(
  async (input: RubricNewIn): Promise<RubricNewOut> => {
    return api.post("/rubrics/new", input);
  },
);

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "New Rubric",
    description:
      "Create a new assessment rubric for teaching assistant evaluation. Design rubric-based evaluation criteria to assess pedagogical performance, teaching effectiveness, and student interaction skills through structured assessment frameworks.",
  };
}

/** ---- Server renders client with typed data (mutations in child components) ---- */
export default async function NewRubricPage() {
  const session = await getSession();
  const profileId = session?.effectiveProfileId || "";

  // Fetch default rubric detail server-side
  const rubricNew = await getRubricDefault({
    body: { profileId },
  });

  return (
    <div className="space-y-6">
      <Rubric
        rubricDetailDefault={rubricNew}
        createRubricAction={createRubric}
      />
    </div>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type { RubricNewIn, RubricNewOut };
