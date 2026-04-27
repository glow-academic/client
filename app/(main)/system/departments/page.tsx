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

/** ---- Strong types from OpenAPI ---- */
type DepartmentsListOut = OutputOf<"/department/search", "post">;
type DuplicateDepartmentIn = InputOf<"/department/duplicate", "post">;
type DuplicateDepartmentOut = OutputOf<"/department/duplicate", "post">;
type DeleteDepartmentIn = InputOf<"/department/delete", "post">;
type DeleteDepartmentOut = OutputOf<"/department/delete", "post">;
type UpdateDepartmentIn = InputOf<"/department/update", "post">;
type UpdateDepartmentOut = OutputOf<"/department/update", "post">;
type GroupDepartmentIn = InputOf<"/department/group", "post">;
type GroupDepartmentOut = OutputOf<"/department/group", "post">;
type GenerateDepartmentIn = InputOf<"/department/generate", "post">;
type GenerateDepartmentOut = OutputOf<"/department/generate", "post">;
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
const getDepartmentsList = async (): Promise<DepartmentsListOut> => {
  const bypassCache = await isHardRefresh();
  return api.post(
    "/department/search",
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

async function generateDepartment(
  input: GenerateDepartmentIn
): Promise<GenerateDepartmentOut> {
  "use server";
  return api.post("/department/generate", input);
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

async function runDepartmentGenerate(input: GenerateDepartmentIn): Promise<GenerateDepartmentOut> {
  "use server";
  return api.post("/department/generate", input);
}

/** ---- Page metadata ---- */
export async function generateMetadata(): Promise<Metadata> {
  try {
    const context = await api.post("/department/context", { body: {} } as ContextIn) as ContextOut;
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
    const context = await api.post("/department/context", { body: {} } as ContextIn) as ContextOut;
    const snapshot = buildSnapshot(session, context.profile);
    guardPage("/system/departments", context.profile.role_permissions);

    // Fetch list data, view cookie, and group in parallel
    const [listData, initialColumnVisibility, groupResult] = await Promise.all([
      getDepartmentsList(),
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
          groupId: (groupResult as GroupDepartmentOut & { group_id?: string })?.group_id ?? null,
          groupName:
            (groupResult as GroupDepartmentOut & { name?: string | null })?.name ?? null,
          // Forward the full SSR-fetched group payload — the panel
          // seeds historicalMessages from this synchronously and
          // skips the duplicate client-side /<art>/group refetch
          // on first paint, eliminating the hydration flicker.
          initialGroupHistory: groupResult as Record<string, unknown>,
          generateAction: generateDepartment,
          operations: ["draft", "get", "group"],
          getGroupHistory: getDepartmentGroupHistory,
          searchGroups: searchDepartmentGroups,
          prompts: context.prompts?.prompts,
          getGroupAction: getDepartmentGroup as PanelProps["getGroupAction"],
          searchGenerationsAction:
            searchDepartmentGenerations as PanelProps["searchGenerationsAction"],
          runGenerateAction: runDepartmentGenerate as PanelProps["runGenerateAction"],
        }}
      >
        <div className="space-y-6 px-4" data-page="departments-index">
          <Departments
            listData={listData}
            initialColumnVisibility={initialColumnVisibility}
            duplicateDepartmentAction={duplicateDepartment}
            deleteDepartmentAction={deleteDepartment}
            updateDepartmentAction={updateDepartment}
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
  DepartmentsListOut,
  DuplicateDepartmentIn,
  DuplicateDepartmentOut,
  UpdateDepartmentIn,
  UpdateDepartmentOut,
};
