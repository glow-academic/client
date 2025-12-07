/**
 * app/(main)/engine/evals/new/page.tsx
 * New eval page
 * @AshokSaravanan222
 * 01/26/2025
 */
import { getSession } from "@/auth";

import { EvalForm } from "@/components/evals/EvalForm";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";

/** ---- Strong types from OpenAPI ---- */
type CreateEvalIn = InputOf<"/api/v3/evals/create", "post">;
type CreateEvalOut = OutputOf<"/api/v3/evals/create", "post">;
type RubricsListOut = OutputOf<"/api/v3/rubrics/list", "post">;

/** ---- Direct fetch for rubrics list ---- */
const getRubricsList = async (profileId: string): Promise<RubricsListOut> => {
  return api.post(
    "/rubrics/list",
    { body: { profileId } },
    {
      cache: "no-store",
      headers: {
        "X-Bypass-Cache": "1",
      },
    },
  );
};

/** ---- Metadata ---- */
export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Create Eval",
    description:
      "Create a new automated evaluation run for teaching assistant assessments. Configure batch evaluations to analyze pedagogical performance, teaching effectiveness, and student interaction quality across multiple practice sessions.",
  };
}

/** ---- Strongly-typed server actions ---- */
async function createEval(input: CreateEvalIn): Promise<CreateEvalOut> {
  "use server";
  const session = await getSession();
  const profileId = session?.effectiveProfileId || "guest-profile-id";
  return api.post("/evals/create", {
    ...input,
    body: { ...input.body, profileId },
  });
}

/** ---- Server renders client with typed data and actions ---- */
export default async function NewEvalPage() {
  const session = await getSession();
  const profileId = session?.effectiveProfileId || "";

  // Fetch rubrics list
  const rubricsList = await getRubricsList(profileId);

  return (
    <EvalForm
      rubricsList={rubricsList}
      profileId={profileId}
      createEvalAction={createEval}
    />
  );
}

/** ---- Export types for client component ---- */
export type { CreateEvalIn, CreateEvalOut, RubricsListOut };
