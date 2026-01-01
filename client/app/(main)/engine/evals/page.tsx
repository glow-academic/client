/**
 * app/(main)/engine/evals/page.tsx
 * Evals list page
 * @AshokSaravanan222
 * 01/26/2025
 */
import Evals from "@/components/evals/Evals";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import type { Metadata } from "next";

/** ---- Strong types from OpenAPI ---- */
type EvalsListOut = OutputOf<"/api/v4/evals/list", "post">;
type DeleteEvalIn = InputOf<"/api/v4/evals/delete", "post">;
type DeleteEvalOut = OutputOf<"/api/v4/evals/delete", "post">;

/** ---- Direct fetch (no Next.js cache) ---- */
const getEvalsList = async (): Promise<EvalsListOut> => {
  const bypassCache = await isHardRefresh();
  return api.post(
    "/evals/list",
    { body: {} },
    {
      cache: "no-store",
      ...(bypassCache && {
        headers: {
          "X-Bypass-Cache": "1",
        },
      }),
    }
  );
};

/** ---- Strongly-typed server actions ---- */
async function deleteEval(input: DeleteEvalIn): Promise<DeleteEvalOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  return api.post("/evals/delete", input);
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Evals",
    description:
      "Manage automated evaluation runs for teaching assistant assessments. Configure and execute batch evaluations to analyze pedagogical performance, teaching effectiveness, and student interaction quality across multiple practice sessions.",
  };
}

export default async function EvalsPage() {
  // Access control handled server-side in layout
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  // Fetch list data server-side
  const listData = await getEvalsList();

  return <Evals listData={listData} deleteEvalAction={deleteEval} />;
}

/** ---- Export types for client component ---- */
export type { DeleteEvalIn, DeleteEvalOut, EvalsListOut };
