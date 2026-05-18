/**
 * app/(main)/system/evals/page.tsx
 * Evals list page — full SSR rendering with FullPageLayout.
 * @AshokSaravanan222
 * 01/26/2025
 */
import { getSession } from "@/auth";
import { UnifiedAccessDenied } from "@/components/common/layout/UnifiedAccessDenied";
import { FullPageLayout, type PanelProps } from "@/components/common/layout/FullPageLayout";
import { ArtifactToolbarActions } from "@/components/common/layout/ArtifactToolbarActions";
import Evals from "@/components/artifacts/eval/Evals";

import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import type { Metadata } from "next";
import { cookies } from "next/headers";

import { buildSnapshot } from "@/lib/auth";
import { guardPage } from "@/lib/permissions";
import { loadEvalsSearchParams } from "@/lib/search-params/evals";
import { readViewCookie } from "@/lib/view-cookie";
import type { ParseCsvResult } from "@/components/common/BulkImport";

import { cache } from "react";
import { readGenerationPanelPrefs } from "@/lib/generation/panel-prefs";
/** ---- Strong types from OpenAPI ---- */
type EvalsListOut = OutputOf<"/eval/search", "post">;
type DeleteEvalIn = InputOf<"/eval/delete", "post">;
type DeleteEvalOut = OutputOf<"/eval/delete", "post">;
type UpdateEvalIn = InputOf<"/eval/update", "post">;
type UpdateEvalOut = OutputOf<"/eval/update", "post">;
type CreateEvalIn = InputOf<"/eval/create", "post">;
type CreateEvalOut = OutputOf<"/eval/create", "post">;
type GroupEvalIn = InputOf<"/eval/group", "post">;
type GroupEvalOut = OutputOf<"/eval/group", "post">;
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

async function updateEval(input: UpdateEvalIn): Promise<UpdateEvalOut> {
  "use server";
  return api.post("/eval/update", input);
}

async function createEval(input: CreateEvalIn): Promise<CreateEvalOut> {
  "use server";
  return api.post("/eval/create", input);
}

async function exportEvals(): Promise<{
  file_id: string;
  file_name?: string;
}> {
  "use server";
  const result = (await api.post("/eval/export", {
    body: {},
  } as unknown as InputOf<"/eval/export", "post">)) as unknown as {
    file_id: string;
    file_name?: string;
  };
  return {
    file_id: result.file_id,
    ...(result.file_name !== undefined && { file_name: result.file_name }),
  };
}

async function refreshEvals(): Promise<unknown> {
  "use server";
  return api.post("/eval/refresh", {
    body: {},
  } as unknown as InputOf<"/eval/refresh", "post">);
}

async function parseCsv(formData: FormData): Promise<ParseCsvResult> {
  "use server";
  return api.post("/eval/csv", { formData });
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

/** ---- GenerationPanel server actions ---- */
async function getEvalGroup(input: GroupEvalIn): Promise<GroupEvalOut> {
  "use server";
  return api.post("/eval/group", input);
}

async function searchEvalGenerations(input: GenerationsIn): Promise<GenerationsOut> {
  "use server";
  return api.post("/eval/generations", input);
}


/** ---- Request-scoped context fetch ----
 * Wrapped in React's ``cache()`` so ``generateMetadata`` and the page
 * component share one network call per request. Server-only; not a
 * cross-request cache. */
const getEvalContext = cache(
  async (): Promise<ContextOut> =>
    api.post("/eval/context", { body: {} } as ContextIn) as Promise<ContextOut>,
);

/** ---- Page metadata ---- */
export async function generateMetadata(): Promise<Metadata> {
  try {
    const context = await getEvalContext();
    return {
      title: context.page_metadata?.list.title,
      description: context.page_metadata?.list.description,
    };
  } catch {
    return { title: "Evals" };
  }
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

  try {
    // Profile data for providers
    const context = await getEvalContext();
    const snapshot = buildSnapshot(session, context.profile);
    guardPage("/system/evals", context.profile.role_permissions);

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

    // Fetch list data, view cookie, and group in parallel
    const [listData, initialColumnVisibility, groupResult] = await Promise.all([
      getEvalsList(body),
      readViewCookie("evals"),
      api.post(
        "/eval/group",
        { body: q.groupId ? { group_id: q.groupId } : {} } as GroupEvalIn,
      ),
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
        toolbar={
          <ArtifactToolbarActions
            newButton={{ label: "New Eval", href: "/system/evals/new" }}
            exportAction={exportEvals}
            refreshAction={refreshEvals}
            bffDownloadPrefix="/api/eval/download"
          />
        }
        panelProps={{
          artifactType: "eval",
          initialPanelPrefs: await readGenerationPanelPrefs(),
          groupId: (groupResult as GroupEvalOut & { group_id?: string })?.group_id ?? null,
          groupName:
            (groupResult as GroupEvalOut & { name?: string | null })?.name ?? null,
          // Forward the full SSR-fetched group payload — the panel
          // seeds historicalMessages from this synchronously and
          // skips the duplicate client-side /<art>/group refetch
          // on first paint, eliminating the hydration flicker.
          initialGroupHistory: groupResult as Record<string, unknown>,
          operations: ["draft", "get", "title"],
          getGroupHistory: getEvalGroupHistory,
          searchGroups: searchEvalGroups,
          prompts: context.prompts?.prompts,
          getGroupAction: getEvalGroup as PanelProps["getGroupAction"],
          searchGenerationsAction:
            searchEvalGenerations as PanelProps["searchGenerationsAction"],
        }}
      >
        <div className="space-y-6 px-4" data-page="evals-index">
          <Evals
            listData={listData}
            initialColumnVisibility={initialColumnVisibility}
            deleteEvalAction={deleteEval}
            updateEvalAction={updateEval}
            createEvalAction={createEval}
            parseCsvAction={parseCsv}
            importFields={listData.import_fields ?? undefined}
            currentSearchBody={body}
            pageIndex={pageIndex}
            pageSize={pageSize}
            totalCount={listData.total_count ?? 0}
            departmentSearch={q.departmentSearch ?? ""}
          />
        </div>
      </FullPageLayout>
    );
  } catch (error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "status" in error
    ) {
      // 401 → not logged in. 403 → resource belongs to a department the
      // user isn't in. Don't conflate.
      if (error.status === 401) {
        return (
          <UnifiedAccessDenied
            reason="not-logged-in"
            pathname="/system/evals"
          />
        );
      }
      if (error.status === 403) {
        return (
          <UnifiedAccessDenied
            reason="department"
            resourceType="eval"
            redirectPath="/system/evals"
          />
        );
      }
    }
    throw error;
  }
}

/** ---- Export types for client component ---- */
export type {
  DeleteEvalIn,
  DeleteEvalOut,
  EvalsListOut,
  EvalsListBody,
  UpdateEvalIn,
  UpdateEvalOut,
  CreateEvalIn,
  CreateEvalOut,
};
