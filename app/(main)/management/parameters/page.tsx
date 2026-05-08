/**
 * app/(main)/management/parameters/page.tsx
 * Parameters list page — full SSR rendering with FullPageLayout.
 * @AshokSaravanan222 & @siladiea
 * 07/21/2025
 */

import { getSession } from "@/auth";
import { UnifiedAccessDenied } from "@/components/common/layout/UnifiedAccessDenied";
import { FullPageLayout, type PanelProps } from "@/components/common/layout/FullPageLayout";
import { NewArtifactButton } from "@/components/common/layout/NewArtifactButton";
import Parameters from "@/components/artifacts/parameter/Parameters";

import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import type { Metadata } from "next";
import { cookies } from "next/headers";

import { buildSnapshot } from "@/lib/auth";
import { guardPage } from "@/lib/permissions";
import { readViewCookie } from "@/lib/view-cookie";
import { loadParametersSearchParams } from "@/lib/search-params/parameters";

import { cache } from "react";
import { readGenerationPanelPrefs } from "@/lib/generation/panel-prefs";
/** ---- Strong types from OpenAPI ---- */
type ParametersListOut = OutputOf<"/parameter/search", "post">;

/** ---- Body type for parameters list request ----
 * Mirrors persona's ``PersonasListBody`` — same shape that the bulk
 * delete/update endpoints accept under their ``all=true`` path so the
 * client can forward the SSR search body verbatim. NOTE: today the
 * parameters page does not URL-drive its filters (TanStack column
 * filters are client-side), so this body is effectively just the
 * pagination defaults. See known-gaps in
 * ``project_bulk_write_pattern.md``. */
type ParametersListBody = {
  search?: string | null;
  scenario_ids?: string[] | null;
  field_ids?: string[] | null;
  filter_department_ids?: string[] | null;
  scenario_search?: string | null;
  field_search?: string | null;
  department_search?: string | null;
  flag_search?: string | null;
  page_size?: number | null;
  page_offset?: number | null;
};
type DuplicateParameterIn = InputOf<"/parameter/duplicate", "post">;
type DuplicateParameterOut = OutputOf<"/parameter/duplicate", "post">;
type DeleteParameterIn = InputOf<"/parameter/delete", "post">;
type DeleteParameterOut = OutputOf<"/parameter/delete", "post">;
type UpdateParameterIn = InputOf<"/parameter/update", "post">;
type UpdateParameterOut = OutputOf<"/parameter/update", "post">;
type GroupParameterIn = InputOf<"/parameter/group", "post">;
type GroupParameterOut = OutputOf<"/parameter/group", "post">;
type GenerationsIn = InputOf<"/parameter/generations", "post">;
type GenerationsOut = OutputOf<"/parameter/generations", "post">;
type ProblemParameterIn = InputOf<"/parameter/problem", "post">;
type ProblemParameterOut = OutputOf<"/parameter/problem", "post">;
type ContextIn = InputOf<"/parameter/context", "post">;
type ContextOut = OutputOf<"/parameter/context", "post">;

/** ---- Direct fetch (no Next.js cache) ----
 * Using cache: 'no-store' to disable Next.js default fetch caching so hard refresh works.
 * Sending X-Bypass-Cache header only on hard refresh to bypass Redis cache.
 */
const getParametersList = async (
  body: ParametersListBody,
): Promise<ParametersListOut> => {
  const bypassCache = await isHardRefresh();
  return api.post(
    "/parameter/search",
    { body },
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

/** ---- Strongly-typed server actions (single source of truth) ---- */
async function duplicateParameter(
  input: DuplicateParameterIn,
): Promise<DuplicateParameterOut> {
  "use server";
  return api.post("/parameter/duplicate", input);
}

async function deleteParameter(
  input: DeleteParameterIn,
): Promise<DeleteParameterOut> {
  "use server";
  return api.post("/parameter/delete", input);
}

async function updateParameter(
  input: UpdateParameterIn,
): Promise<UpdateParameterOut> {
  "use server";
  return api.post("/parameter/update", input);
}


async function getParameterGroupHistory(groupId: string): Promise<GroupParameterOut> {
  "use server";
  return api.post("/parameter/group", { body: { group_id: groupId } } as GroupParameterIn);
}

async function searchParameterGroups(query: string): Promise<GenerationsOut> {
  "use server";
  return api.post("/parameter/generations", { body: { search: query || null } } as GenerationsIn);
}

async function createParameterProblem(input: ProblemParameterIn): Promise<ProblemParameterOut> {
  "use server";
  return api.post("/parameter/problem", input);
}

/** ---- GenerationPanel server actions ---- */
async function getParameterGroup(input: GroupParameterIn): Promise<GroupParameterOut> {
  "use server";
  return api.post("/parameter/group", input);
}

async function searchParameterGenerations(input: GenerationsIn): Promise<GenerationsOut> {
  "use server";
  return api.post("/parameter/generations", input);
}


/** ---- Request-scoped context fetch ----
 * Wrapped in React's ``cache()`` so ``generateMetadata`` and the page
 * component share one network call per request. Server-only; not a
 * cross-request cache. */
const getParameterContext = cache(
  async (): Promise<ContextOut> =>
    api.post("/parameter/context", { body: {} } as ContextIn) as Promise<ContextOut>,
);

/** ---- Page metadata ---- */
export async function generateMetadata(): Promise<Metadata> {
  try {
    const context = await getParameterContext();
    return {
      title: context.page_metadata?.list.title,
      description: context.page_metadata?.list.description,
    };
  } catch {
    return { title: "Parameters" };
  }
}

/** ---- Cookies ---- */
const SIDEBAR_COOKIE = "glow_sidebar";
const PANEL_COOKIE = "glow_panel";

interface ParametersPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function ContextPage({ searchParams }: ParametersPageProps) {
  const session = await getSession();
  const q = loadParametersSearchParams(await searchParams);

  // Read UI preferences from cookies for SSR
  const cookieStore = await cookies();
  const sidebarCookie = cookieStore.get(SIDEBAR_COOKIE);
  const initialSidebarOpen = sidebarCookie ? sidebarCookie.value === "true" : undefined;
  const panelCookie = cookieStore.get(PANEL_COOKIE);
  const initialPanelOpen = panelCookie ? panelCookie.value === "true" : false;

  try {
    // Profile data for providers
    const context = await getParameterContext();
    const snapshot = buildSnapshot(session, context.profile);
    guardPage("/management/parameters", context.profile.role_permissions);

    // SSR search body. Today this is empty (filters are client-side
    // TanStack column filters, not URL-driven), but the shape is in
    // place so flipping filters to nuqs URL params later is mechanical.
    // Forwarded to the bulk delete/update endpoints via the
    // ``currentSearchBody`` prop on the list component.
    const body: ParametersListBody = {};

    // Fetch list data, view cookie, and group in parallel
    const [listData, initialColumnVisibility, groupResult] = await Promise.all([
      getParametersList(body),
      readViewCookie("parameters"),
      api.post(
        "/parameter/group",
        { body: q.groupId ? { group_id: q.groupId } : {} } as GroupParameterIn,
      ),
    ]);

    return (
      <FullPageLayout
        profileData={context.profile}
        sessionSnapshot={snapshot}
        initialSidebarOpen={initialSidebarOpen}
        initialPanelOpen={initialPanelOpen}
        sidebarProps={{
          activeSection: "parameter",
          createFeedback: createParameterProblem,
        }}
        breadcrumbs={[
          { title: "Management", section: "management", url: "/management" },
          { title: "Parameters" },
        ]}
        toolbar={<NewArtifactButton label="New Parameter" href="/management/parameters/new" />}
        panelProps={{
          artifactType: "parameter",
          initialPanelPrefs: await readGenerationPanelPrefs(),
          groupId: (groupResult as GroupParameterOut & { group_id?: string })?.group_id ?? null,
          groupName:
            (groupResult as GroupParameterOut & { name?: string | null })?.name ?? null,
          // Forward the full SSR-fetched group payload — the panel
          // seeds historicalMessages from this synchronously and
          // skips the duplicate client-side /<art>/group refetch
          // on first paint, eliminating the hydration flicker.
          initialGroupHistory: groupResult as Record<string, unknown>,
          operations: ["draft", "get", "title"],
          getGroupHistory: getParameterGroupHistory,
          searchGroups: searchParameterGroups,
          prompts: context.prompts?.prompts,
          getGroupAction: getParameterGroup as PanelProps["getGroupAction"],
          searchGenerationsAction:
            searchParameterGenerations as PanelProps["searchGenerationsAction"],
        }}
      >
        <div className="space-y-6 px-4" data-page="parameters-index">
          <Parameters
            listData={listData}
            initialColumnVisibility={initialColumnVisibility}
            duplicateParameterAction={duplicateParameter}
            deleteParameterAction={deleteParameter}
            updateParameterAction={updateParameter}
            currentSearchBody={body}
          />
        </div>
      </FullPageLayout>
    );
  } catch (error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "status" in error &&
      (error.status === 401 || error.status === 403)
    ) {
      return (
        <UnifiedAccessDenied
          reason="not-logged-in"
          pathname="/management/parameters"
        />
      );
    }
    throw error;
  }
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  DeleteParameterIn,
  DeleteParameterOut,
  DuplicateParameterIn,
  DuplicateParameterOut,
  ParametersListOut,
  ParametersListBody,
  UpdateParameterIn,
  UpdateParameterOut,
};
