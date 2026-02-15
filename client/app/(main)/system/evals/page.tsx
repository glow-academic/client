/**
 * app/(main)/system/evals/page.tsx
 * Evals list page - server-side filtering with nuqs URL-backed state
 * @AshokSaravanan222
 * 01/26/2025
 */
import Evals from "@/components/artifacts/eval/Evals";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import type { Metadata } from "next";

import { loadEvalsSearchParams } from "@/lib/search-params/evals";

/** ---- Strong types from OpenAPI ---- */
type EvalsListOut = OutputOf<"/api/v4/artifacts/evals/list", "post">;
type DeleteEvalIn = InputOf<"/api/v4/artifacts/evals/delete", "post">;
type DeleteEvalOut = OutputOf<"/api/v4/artifacts/evals/delete", "post">;

/** ---- Body type for evals list request ---- */
type EvalsListBody = {
  search?: string | null;
  filter_department_ids?: string[] | null;
  department_search?: string | null;
  page_size: number | null;
  page_offset: number | null;
};

/** ---- Direct fetch (no Next.js cache) ---- */
const getEvalsList = async (body: EvalsListBody): Promise<EvalsListOut> => {
  const bypassCache = await isHardRefresh();
  return api.post(
    "/artifacts/evals/list",
    { body },
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

interface EvalsPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function EvalsPage({ searchParams }: EvalsPageProps) {
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

  const q = loadEvalsSearchParams(searchParamsObj);

  // Compute pagination
  const pageIndex = q.page ?? 0;
  const pageSize = q.pageSize ?? 12;
  const offset = pageIndex * pageSize;

  // Build request body with filter values from URL
  const body: EvalsListBody = {
    search: q.search || null,
    filter_department_ids: q.departmentIds && q.departmentIds.length > 0 ? q.departmentIds : null,
    department_search: q.departmentSearch || null,
    page_size: pageSize,
    page_offset: offset,
  };

  // Fetch list data server-side with filters
  const listData = await getEvalsList(body);

  return (
    <Evals
      listData={listData}
      deleteEvalAction={deleteEval}
      pageIndex={pageIndex}
      pageSize={pageSize}
      totalCount={listData.total_count ?? 0}
      departmentSearch={q.departmentSearch ?? ""}
    />
  );
}

/** ---- Export types for client component ---- */
export type { DeleteEvalIn, DeleteEvalOut, EvalsListOut };
