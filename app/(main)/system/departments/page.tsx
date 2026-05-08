/**
 * app/(main)/system/departments/page.tsx
 * Departments list page — full SSR rendering with FullPageLayout.
 * @AshokSaravanan222 & @siladiea
 * 06/09/2025
 */

import { getSession } from "@/auth";
import { UnifiedAccessDenied } from "@/components/common/layout/UnifiedAccessDenied";
import { FullPageLayout, type PanelProps } from "@/components/common/layout/FullPageLayout";
import { NewArtifactButton } from "@/components/common/layout/NewArtifactButton";
import Departments from "@/components/artifacts/department/Departments";

import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import type { Metadata } from "next";
import { cookies } from "next/headers";

import { buildSnapshot } from "@/lib/auth";
import { guardPage } from "@/lib/permissions";
import { readViewCookie } from "@/lib/view-cookie";
import { loadDepartmentsSearchParams } from "@/lib/search-params/departments";

import { cache } from "react";
import { readGenerationPanelPrefs } from "@/lib/generation/panel-prefs";
/** ---- Strong types from OpenAPI ---- */
type DepartmentsListIn = InputOf<"/department/search", "post">;
type DepartmentsListOut = OutputOf<"/department/search", "post">;
/** ---- Body type for departments list request ----
 *  Matches the server's ``SearchDepartmentApiRequest`` validator. The
 *  client passes this same shape to the bulk delete/update endpoints
 *  under ``all=true`` mode so the server can resolve matching ids
 *  without a client-side enumeration round-trip. */
type DepartmentsListBody = NonNullable<DepartmentsListIn["body"]>;
type DuplicateDepartmentIn = InputOf<"/department/duplicate", "post">;
type DuplicateDepartmentOut = OutputOf<"/department/duplicate", "post">;
type DeleteDepartmentIn = InputOf<"/department/delete", "post">;
type DeleteDepartmentOut = OutputOf<"/department/delete", "post">;
type UpdateDepartmentIn = InputOf<"/department/update", "post">;
type UpdateDepartmentOut = OutputOf<"/department/update", "post">;
type GroupDepartmentIn = InputOf<"/department/group", "post">;
type GroupDepartmentOut = OutputOf<"/department/group", "post">;
type GenerationsIn = InputOf<"/department/generations", "post">;
type GenerationsOut = OutputOf<"/department/generations", "post">;
type ProblemDepartmentIn = InputOf<"/department/problem", "post">;
type ProblemDepartmentOut = OutputOf<"/department/problem", "post">;
type ContextIn = InputOf<"/department/context", "post">;
type ContextOut = OutputOf<"/department/context", "post">;

/** ---- Direct fetch (no Next.js cache) ----
 * Using cache: 'no-store' to disable Next.js default fetch caching so hard refresh works.
 * Sending X-Bypass-Cache header only on hard refresh to bypass Redis cache.
 */
const getDepartmentsList = async (
  body: DepartmentsListBody,
): Promise<DepartmentsListOut> => {
  const bypassCache = await isHardRefresh();
  return api.post(
    "/department/search",
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
async function duplicateDepartment(
  input: DuplicateDepartmentIn,
): Promise<DuplicateDepartmentOut> {
  "use server";
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/department/duplicate", input);
}

async function deleteDepartment(
  input: DeleteDepartmentIn,
): Promise<DeleteDepartmentOut> {
  "use server";
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/department/delete", input);
}

async function updateDepartment(
  input: UpdateDepartmentIn,
): Promise<UpdateDepartmentOut> {
  "use server";
  return api.post("/department/update", input);
}


async function getDepartmentGroupHistory(groupId: string): Promise<GroupDepartmentOut> {
  "use server";
  return api.post("/department/group", { body: { group_id: groupId } } as GroupDepartmentIn);
}

async function searchDepartmentGroups(query: string): Promise<GenerationsOut> {
  "use server";
  return api.post("/department/generations", { body: { search: query || null } } as GenerationsIn);
}

async function createDepartmentProblem(input: ProblemDepartmentIn): Promise<ProblemDepartmentOut> {
  "use server";
  return api.post("/department/problem", input);
}

/** ---- GenerationPanel server actions ---- */
async function getDepartmentGroup(input: GroupDepartmentIn): Promise<GroupDepartmentOut> {
  "use server";
  return api.post("/department/group", input);
}

async function searchDepartmentGenerations(input: GenerationsIn): Promise<GenerationsOut> {
  "use server";
  return api.post("/department/generations", input);
}


/** ---- Request-scoped context fetch ----
 * Wrapped in React's ``cache()`` so ``generateMetadata`` and the page
 * component share one network call per request. Server-only; not a
 * cross-request cache. */
const getDepartmentContext = cache(
  async (): Promise<ContextOut> =>
    api.post("/department/context", { body: {} } as ContextIn) as Promise<ContextOut>,
);

/** ---- Page metadata ---- */
export async function generateMetadata(): Promise<Metadata> {
  try {
    const context = await getDepartmentContext();
    return {
      title: context.page_metadata?.list.title,
      description: context.page_metadata?.list.description,
    };
  } catch {
    return { title: "Departments" };
  }
}

/** ---- Cookies ---- */
const SIDEBAR_COOKIE = "glow_sidebar";
const PANEL_COOKIE = "glow_panel";

interface DepartmentsPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function DepartmentsPage({ searchParams }: DepartmentsPageProps) {
  const session = await getSession();
  const q = loadDepartmentsSearchParams(await searchParams);

  // Read UI preferences from cookies for SSR
  const cookieStore = await cookies();
  const sidebarCookie = cookieStore.get(SIDEBAR_COOKIE);
  const initialSidebarOpen = sidebarCookie ? sidebarCookie.value === "true" : undefined;
  const panelCookie = cookieStore.get(PANEL_COOKIE);
  const initialPanelOpen = panelCookie ? panelCookie.value === "true" : false;

  try {
    // Profile data for providers
    const context = await getDepartmentContext();
    const snapshot = buildSnapshot(session, context.profile);
    guardPage("/system/departments", context.profile.role_permissions);

    // The departments list page doesn't yet expose URL-backed filters,
    // but we still build a ``body`` so bulk write endpoints under
    // ``selectAll=1`` mode have a well-formed filter envelope to echo
    // back. As filter URL state is added, populate fields from ``q``
    // here — the client component already passes this through.
    // ``page_size``/``page_offset`` are required-but-nullable in the
    // OpenAPI schema; passing null lets the server use its defaults.
    const body: DepartmentsListBody = {
      page_size: null,
      page_offset: null,
    };

    // Fetch list data, view cookie, and group in parallel
    const [listData, initialColumnVisibility, groupResult] = await Promise.all([
      getDepartmentsList(body),
      readViewCookie("departments"),
      api.post(
        "/department/group",
        { body: q.groupId ? { group_id: q.groupId } : {} } as GroupDepartmentIn,
      ),
    ]);

    return (
      <FullPageLayout
        profileData={context.profile}
        sessionSnapshot={snapshot}
        initialSidebarOpen={initialSidebarOpen}
        initialPanelOpen={initialPanelOpen}
        sidebarProps={{
          activeSection: "department",
          createFeedback: createDepartmentProblem,
        }}
        breadcrumbs={[
          { title: "System", section: "system", url: "/system" },
          { title: "Departments" },
        ]}
        toolbar={<NewArtifactButton label="New Department" href="/system/departments/new" />}
        panelProps={{
          artifactType: "department",
          initialPanelPrefs: await readGenerationPanelPrefs(),
          groupId: (groupResult as GroupDepartmentOut & { group_id?: string })?.group_id ?? null,
          groupName:
            (groupResult as GroupDepartmentOut & { name?: string | null })?.name ?? null,
          // Forward the full SSR-fetched group payload — the panel
          // seeds historicalMessages from this synchronously and
          // skips the duplicate client-side /<art>/group refetch
          // on first paint, eliminating the hydration flicker.
          initialGroupHistory: groupResult as Record<string, unknown>,
          operations: ["draft", "get", "title"],
          getGroupHistory: getDepartmentGroupHistory,
          searchGroups: searchDepartmentGroups,
          prompts: context.prompts?.prompts,
          getGroupAction: getDepartmentGroup as PanelProps["getGroupAction"],
          searchGenerationsAction:
            searchDepartmentGenerations as PanelProps["searchGenerationsAction"],
        }}
      >
        <div className="space-y-6 px-4" data-page="departments-index">
          <Departments
            listData={listData}
            initialColumnVisibility={initialColumnVisibility}
            duplicateDepartmentAction={duplicateDepartment}
            deleteDepartmentAction={deleteDepartment}
            updateDepartmentAction={updateDepartment}
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
          pathname="/system/departments"
        />
      );
    }
    throw error;
  }
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  DeleteDepartmentIn,
  DeleteDepartmentOut,
  DepartmentsListBody,
  DepartmentsListOut,
  DuplicateDepartmentIn,
  DuplicateDepartmentOut,
  UpdateDepartmentIn,
  UpdateDepartmentOut,
};
