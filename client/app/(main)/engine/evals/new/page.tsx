/**
 * app/(main)/engine/evals/new/page.tsx
 * New eval page
 * @AshokSaravanan222
 * 01/26/2025
 */
import Eval from "@/components/evals/Eval";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { getSession } from "@/auth";
import type { Metadata } from "next";
import { isHardRefresh } from "@/lib/cache-utils";

/** ---- Strong types from OpenAPI ---- */
type EvalNewIn = InputOf<"/api/v3/evals/new", "post">;
type EvalNewOut = OutputOf<"/api/v3/evals/new", "post">;
type CreateEvalIn = InputOf<"/api/v3/evals/create", "post">;
type CreateEvalOut = OutputOf<"/api/v3/evals/create", "post">;

/** ---- Direct fetch (no caching - source of truth) ---- */
const getEvalDefault = async (profileId: string): Promise<EvalNewOut> => {
  const bypassCache = await isHardRefresh();
  return api.post(
    "/evals/new",
    { body: { profileId } },
    {
      cache: "no-store",
      ...(bypassCache && {
        headers: {
          "X-Bypass-Cache": "1",
        },
      }),
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
  const profileId = session?.effectiveProfileId;
  if (!profileId) {
    throw new Error("Authentication required");
  }
  return api.post("/evals/create", {
    ...input,
    body: { ...input.body, profileId },
  });
}

/** ---- Server renders client with typed data and actions ---- */
export default async function NewEvalPage() {
  // Access control is handled server-side in layout
  // Get profileId from session
  const session = await getSession();
  const profileId = session?.effectiveProfileId;

  if (!profileId) {
    // This should not happen due to server-side access control, but handle gracefully
    return null;
  }

  // Fetch eval default data (for dropdowns and defaults)
  const evalDetailDefault = await getEvalDefault(profileId);

  return (
    <div
      className="space-y-6"
      data-page="eval-new"
      aria-label="Create new eval page"
    >
      <Eval
        evalDetailDefault={evalDetailDefault}
        createEvalAction={createEval}
      />
    </div>
  );
}

/** ---- Export types for client component ---- */
export type { EvalNewIn, EvalNewOut, CreateEvalIn, CreateEvalOut };
