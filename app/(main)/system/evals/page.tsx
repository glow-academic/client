/**
 * app/(main)/system/evals/page.tsx
 * Evals list page — full SSR rendering with FullPageLayout.
 * @AshokSaravanan222
 * 01/26/2025
 */
import { getSession } from "@/auth";
import { FullPageLayout } from "@/components/common/layout/FullPageLayout";
import { NewArtifactButton } from "@/components/common/layout/NewArtifactButton";
import Evals from "@/components/artifacts/eval/Evals";

import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import type { Metadata } from "next";
import { cookies } from "next/headers";

import { buildSnapshot } from "@/lib/auth";
import { loadEvalsSearchParams } from "@/lib/search-params/evals";

/** ---- Strong types from OpenAPI ---- */
type EvalsListOut = OutputOf<"/eval/search", "post">;
type DeleteEvalIn = InputOf<"/eval/delete", "post">;
type DeleteEvalOut = OutputOf<"/eval/delete", "post">;
type GroupEvalIn = InputOf<"/eval/group", "post">;
type GroupEvalOut = OutputOf<"/eval/group", "post">;
type GenerateEvalIn = InputOf<"/eval/generate", "post">;
type GenerateEvalOut = OutputOf<"/eval/generate", "post">;
type GenerationsIn = InputOf<"/eval/generations", "post">;
type GenerationsOut = OutputOf<"/eval/generations", "post">;
type ProblemEvalIn = InputOf<"/eval/problem", "post">;
type ProblemEvalOut = OutputOf<"/eval/problem", "post">;
type ContextIn = InputOf<"/eval/context", "post">;
type ContextOut = OutputOf<"/eval/context", "post">;

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
    "/eval/search",
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
  return api.post("/eval/delete", input);
}

async function generateEval(
  input: GenerateEvalIn
): Promise<GenerateEvalOut> {
  "use server";
  return api.post("/eval/generate", input);
}

async function getEvalGroupHistory(groupId: string): Promise<GroupEvalOut> {
  "use server";
  return api.post("/eval/group", { body: { group_id: groupId } } as GroupEvalIn);
}

async function searchEvalGroups(query: string): Promise<GenerationsOut> {
  "use server";
  return api.post("/eval/generations", { body: { search: query || null } } as GenerationsIn);
}

async function createEvalProblem(input: ProblemEvalIn): Promise<ProblemEvalOut> {
  "use server";
  return api.post("/eval/problem", input);
}

/** ---- Page metadata ---- */
export async function generateMetadata(): Promise<Metadata> {
  const context = await api.post("/eval/context", { body: {} } as ContextIn) as ContextOut;
  return {
    title: context.page_metadata?.list.title,
    description: context.page_metadata?.list.description,
  };
}

/** ---- Cookies ---- */
const SIDEBAR_COOKIE = "glow_sidebar";
const PANEL_COOKIE = "glow_panel";

interface EvalsPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function EvalsPage({ searchParams }: EvalsPageProps) {
  const session = await getSession();

  // Read UI preferences from cookies for SSR
  const cookieStore = await cookies();
  const sidebarCookie = cookieStore.get(SIDEBAR_COOKIE);
  const initialSidebarOpen = sidebarCookie ? sidebarCookie.value === "true" : undefined;
  const panelCookie = cookieStore.get(PANEL_COOKIE);
  const initialPanelOpen = panelCookie ? panelCookie.value === "true" : false;

  // Profile data for providers
  const context = await api.post("/eval/context", { body: {} } as ContextIn) as ContextOut;
  const snapshot = buildSnapshot(session, context.profile);

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

  // Fetch list data and group in parallel
  const [listData, groupResult] = await Promise.all([
    getEvalsList(body),
    api.post("/eval/group", { body: {} } as GroupEvalIn),
  ]);

  return (
    <FullPageLayout
      profileData={context.profile}
      sessionSnapshot={snapshot}
      initialSidebarOpen={initialSidebarOpen}
      initialPanelOpen={initialPanelOpen}
      sidebarProps={{
        activeSection: "eval",
        createFeedback: createEvalProblem,
      }}
      breadcrumbs={[
        { title: "System", section: "system", url: "/system" },
        { title: "Evals" },
      ]}
      toolbar={<NewArtifactButton label="New Eval" href="/system/evals/new" />}
      panelProps={{
        artifactType: "eval",
        groupId: (groupResult as GroupEvalOut & { group_id?: string })?.group_id ?? null,
        generateAction: generateEval,
        operations: ["draft", "get", "group"],
        getGroupHistory: getEvalGroupHistory,
        searchGroups: searchEvalGroups,
        prompts: context.prompts?.prompts,
      }}
    >
      <div className="space-y-6 px-4" data-page="evals-index">
        <Evals
          listData={listData}
          deleteEvalAction={deleteEval}
          pageIndex={pageIndex}
          pageSize={pageSize}
          totalCount={listData.total_count ?? 0}
          departmentSearch={q.departmentSearch ?? ""}
        />
      </div>
    </FullPageLayout>
  );
}

/** ---- Export types for client component ---- */
export type { DeleteEvalIn, DeleteEvalOut, EvalsListOut };
