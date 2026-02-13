/**
 * app/(main)/system/evals/page.tsx
 * Evals list page
 * @AshokSaravanan222
 * 01/26/2025
 */
import Evals from "@/components/artifacts/eval/Evals";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import type { Metadata } from "next";

/** ---- Strong types from OpenAPI ---- */
type EvalsListOut = OutputOf<"/api/v4/artifacts/evals/list", "post">;
type DeleteEvalIn = InputOf<"/api/v4/artifacts/evals/delete", "post">;
type DeleteEvalOut = OutputOf<"/api/v4/artifacts/evals/delete", "post">;

/** ---- Direct fetch (no Next.js cache) ---- */
const getEvalsList = async (): Promise<EvalsListOut> => {
  const bypassCache = await isHardRefresh();
  return api.post(
    "/artifacts/evals/list",
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
  return api.post("/artifacts/evals/delete", input);
}

/** ---- Docs types for page metadata ---- */
type DocsIn = InputOf<"/api/v4/artifacts/evals/docs", "post">;
type DocsOut = OutputOf<"/api/v4/artifacts/evals/docs", "post">;

const getDocs = async (input: DocsIn): Promise<DocsOut> => {
  return api.post("/artifacts/evals/docs", input);
};

export async function generateMetadata(): Promise<Metadata> {
  const docs = await getDocs({ body: {} });
  return { title: docs.list.title, description: docs.list.description };
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
