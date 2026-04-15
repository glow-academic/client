/**
 * app/(main)/system/departments/page.tsx
 * Departments list page — full SSR rendering with FullPageLayout.
 * @AshokSaravanan222 & @siladiea
 * 06/09/2025
 */

import { getSession } from "@/auth";
import { FullPageLayout } from "@/components/common/layout/FullPageLayout";
import { NewArtifactButton } from "@/components/common/layout/NewArtifactButton";
import Departments from "@/components/artifacts/department/Departments";

import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import type { Metadata } from "next";
import { cookies } from "next/headers";

import { buildSnapshot } from "@/lib/auth";

/** ---- Strong types from OpenAPI ---- */
type DepartmentsListOut = OutputOf<"/departments/search", "post">;
type DuplicateDepartmentIn = InputOf<"/departments/duplicate", "post">;
type DuplicateDepartmentOut = OutputOf<"/departments/duplicate", "post">;
type DeleteDepartmentIn = InputOf<"/departments/delete", "post">;
type DeleteDepartmentOut = OutputOf<"/departments/delete", "post">;
type GroupDepartmentIn = InputOf<"/departments/group", "post">;
type GroupDepartmentOut = OutputOf<"/departments/group", "post">;
type GenerateDepartmentIn = InputOf<"/departments/generate", "post">;
type GenerateDepartmentOut = OutputOf<"/departments/generate", "post">;
type GenerationsIn = InputOf<"/departments/generations", "post">;
type GenerationsOut = OutputOf<"/departments/generations", "post">;
type ProblemDepartmentIn = InputOf<"/departments/problem", "post">;
type ProblemDepartmentOut = OutputOf<"/departments/problem", "post">;
type ContextIn = InputOf<"/departments/context", "post">;
type ContextOut = OutputOf<"/departments/context", "post">;

/** ---- Direct fetch (no Next.js cache) ----
 * Using cache: 'no-store' to disable Next.js default fetch caching so hard refresh works.
 * Sending X-Bypass-Cache header only on hard refresh to bypass Redis cache.
 */
const getDepartmentsList = async (): Promise<DepartmentsListOut> => {
  const bypassCache = await isHardRefresh();
  return api.post(
    "/departments/search",
    { body: {} },
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
  return api.post("/departments/duplicate", input);
}

async function deleteDepartment(
  input: DeleteDepartmentIn,
): Promise<DeleteDepartmentOut> {
  "use server";
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/departments/delete", input);
}

async function generateDepartment(
  input: GenerateDepartmentIn
): Promise<GenerateDepartmentOut> {
  "use server";
  return api.post("/departments/generate", input);
}

async function getDepartmentGroupHistory(groupId: string): Promise<GroupDepartmentOut> {
  "use server";
  return api.post("/departments/group", { body: { group_id: groupId } } as GroupDepartmentIn);
}

async function searchDepartmentGroups(query: string): Promise<GenerationsOut> {
  "use server";
  return api.post("/departments/generations", { body: { search: query || null } } as GenerationsIn);
}

async function createDepartmentProblem(input: ProblemDepartmentIn): Promise<ProblemDepartmentOut> {
  "use server";
  return api.post("/departments/problem", input);
}

/** ---- Page metadata ---- */
export async function generateMetadata(): Promise<Metadata> {
  const context = await api.post("/departments/context", { body: {} } as ContextIn) as ContextOut;
  return {
    title: context.page_metadata?.list.title,
    description: context.page_metadata?.list.description,
  };
}

/** ---- Cookies ---- */
const SIDEBAR_COOKIE = "glow_sidebar";
const PANEL_COOKIE = "glow_panel";

export default async function DepartmentsPage() {
  const session = await getSession();

  // Read UI preferences from cookies for SSR
  const cookieStore = await cookies();
  const sidebarCookie = cookieStore.get(SIDEBAR_COOKIE);
  const initialSidebarOpen = sidebarCookie ? sidebarCookie.value === "true" : undefined;
  const panelCookie = cookieStore.get(PANEL_COOKIE);
  const initialPanelOpen = panelCookie ? panelCookie.value === "true" : false;

  // Profile data for providers
  const context = await api.post("/departments/context", { body: {} } as ContextIn) as ContextOut;
  const snapshot = buildSnapshot(session, context.profile);

  // Fetch list data and group in parallel
  const [listData, groupResult] = await Promise.all([
    getDepartmentsList(),
    api.post("/departments/group", { body: {} } as GroupDepartmentIn),
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
        groupId: (groupResult as GroupDepartmentOut & { group_id?: string })?.group_id ?? null,
        generateAction: generateDepartment,
        permissions: [
          { artifact: "department", operation: "draft" },
          { artifact: "department", operation: "get" },
          { artifact: "department", operation: "docs" },
          { artifact: "department", operation: "group" },
        ],
        getGroupHistory: getDepartmentGroupHistory,
        searchGroups: searchDepartmentGroups,
      }}
    >
      <div className="space-y-6 px-4" data-page="departments-index">
        <Departments
          listData={listData}
          duplicateDepartmentAction={duplicateDepartment}
          deleteDepartmentAction={deleteDepartment}
        />
      </div>
    </FullPageLayout>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  DeleteDepartmentIn,
  DeleteDepartmentOut,
  DepartmentsListOut,
  DuplicateDepartmentIn,
  DuplicateDepartmentOut,
};
