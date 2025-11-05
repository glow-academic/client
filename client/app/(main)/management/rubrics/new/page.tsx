/**
 * app/management/rubrics/new/page.tsx
 * New rubric creation page using the unified rubric component
 * @AshokSaravanan222 & @siladiea
 * 06/09/2025
 */

import { auth } from "@/auth";
import Rubric from "@/components/rubrics/Rubric";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";
import { cache } from "react";

/** ---- Strong types from OpenAPI ---- */
type RubricDetailDefaultIn = InputOf<"/api/v3/rubrics/detail-default", "post">;
type RubricDetailDefaultOut = OutputOf<
  "/api/v3/rubrics/detail-default",
  "post"
>;

/** ---- Cached fetch used by both page + metadata (prevents double hit) ---- */
const getRubricDefault = cache(
  async (input: RubricDetailDefaultIn): Promise<RubricDetailDefaultOut> => {
    return api.post("/rubrics/detail-default", input);
  }
);

export const metadata: Metadata = {
  title: "New Rubric",
  description: `New rubric creation page using the unified rubric component in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
};

/** ---- Server renders client with typed data (mutations in child components) ---- */
export default async function NewRubricPage() {
  const session = await auth();
  const profileId = session?.effectiveProfileId || "";

  // Fetch default rubric detail server-side
  const rubricDetailDefault = await getRubricDefault({
    body: { profileId },
  });

  return (
    <div className="space-y-6">
      <Rubric rubricDetailDefault={rubricDetailDefault} />
    </div>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type { RubricDetailDefaultIn, RubricDetailDefaultOut };
