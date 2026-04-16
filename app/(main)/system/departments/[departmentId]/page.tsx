/**
 * app/(main)/system/departments/[departmentId]/page.tsx
 * Department edit page — full SSR rendering with FullPageLayout.
 * Page owns all data fetching, server actions, and layout rendering.
 * @AshokSaravanan222 & @siladiea
 * 07/20/2025
 */

import { getSession } from "@/auth";
import { UnifiedAccessDenied } from "@/components/common/layout/UnifiedAccessDenied";
import { FullPageLayout } from "@/components/common/layout/FullPageLayout";
import { SaveToolbar } from "@/components/common/drafts/SaveToolbar";
import Department from "@/components/artifacts/department/Department";
import { DraftProviderClient } from "@/contexts/draft-context";

import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { createLoader, parseAsString } from "nuqs/server";

import { buildSnapshot } from "@/lib/auth";

/** ---- Strong types from OpenAPI ---- */
type GetDepartmentIn = InputOf<"/department/get", "post">;
type GetDepartmentOut = OutputOf<"/department/get", "post">;
type CreateDepartmentIn = InputOf<"/department/create", "post">;
type CreateDepartmentOut = OutputOf<"/department/create", "post">;
type UpdateDepartmentIn = InputOf<"/department/update", "post">;
type UpdateDepartmentOut = OutputOf<"/department/update", "post">;
type PatchDepartmentDraftIn = InputOf<"/department/draft", "patch">;
type PatchDepartmentDraftOut = OutputOf<"/department/draft", "patch">;
type CreateDraftNamesIn = InputOf<"/api/v5/resources/names", "post">;
type CreateDraftNamesOut = OutputOf<"/api/v5/resources/names", "post">;
type CreateDraftDescriptionsIn = InputOf<
  "/api/v5/resources/descriptions",
  "post"
>;
type CreateDraftDescriptionsOut = OutputOf<
  "/api/v5/resources/descriptions",
  "post"
>;
type GroupDepartmentIn = InputOf<"/department/group", "post">;
type GroupDepartmentOut = OutputOf<"/department/group", "post">;
type GenerateDepartmentIn = InputOf<"/department/generate", "post">;
type GenerateDepartmentOut = OutputOf<"/department/generate", "post">;
type ProblemDepartmentIn = InputOf<"/department/problem", "post">;
type ProblemDepartmentOut = OutputOf<"/department/problem", "post">;
type ContextIn = InputOf<"/department/context", "post">;
type ContextOut = OutputOf<"/department/context", "post">;

/** ---- Direct fetch (no caching - source of truth) ---- */
const getDepartment = async (
  input: GetDepartmentIn
): Promise<GetDepartmentOut> => {
  return api.post("/department/get", input, {
    cache: "no-store",
    headers: { "X-Bypass-Cache": "1" },
  });
};

/** ---- Strongly-typed server actions ---- */
async function createDepartment(
  input: CreateDepartmentIn
): Promise<CreateDepartmentOut> {
  "use server";
  return api.post("/department/create", input);
}

async function updateDepartment(
  input: UpdateDepartmentIn
): Promise<UpdateDepartmentOut> {
  "use server";
  return api.post("/department/update", input);
}

async function patchDepartmentDraft(
  input: PatchDepartmentDraftIn
): Promise<PatchDepartmentDraftOut> {
  "use server";
  return api.patch("/department/draft", input);
}

async function createDraftNames(
  input: CreateDraftNamesIn
): Promise<CreateDraftNamesOut> {
  "use server";
  return api.post("/resources/names", input);
}

async function createDraftDescriptions(
  input: CreateDraftDescriptionsIn
): Promise<CreateDraftDescriptionsOut> {
  "use server";
  return api.post("/resources/descriptions", input);
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

type GenerationsIn = InputOf<"/department/generations", "post">;
type GenerationsOut = OutputOf<"/department/generations", "post">;

async function searchDepartmentGroups(query: string): Promise<GenerationsOut> {
  "use server";
  return api.post("/department/generations", { body: { search: query || null } } as GenerationsIn);
}

async function createDepartmentProblem(input: ProblemDepartmentIn): Promise<ProblemDepartmentOut> {
  "use server";
  return api.post("/department/problem", input);
}

/** ---- Page metadata ---- */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ departmentId: string }>;
}): Promise<Metadata> {
  try {
    const { departmentId } = await params;
    const context = await api.post("/department/context", { body: { entity_id: departmentId } } as ContextIn) as ContextOut;
    return {
      title: context.page_metadata?.detail.title,
      description: context.page_metadata?.detail.description,
    };
  } catch {
    return { title: "Departments" };
  }
}

/** ---- Cookies ---- */
const SIDEBAR_COOKIE = "glow_sidebar";
const PANEL_COOKIE = "glow_panel";

/** ---- Server renders client with typed data and actions ---- */
export default async function DepartmentEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ departmentId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { departmentId } = await params;
  const session = await getSession();

  // Read UI preferences from cookies for SSR
  const cookieStore = await cookies();
  const sidebarCookie = cookieStore.get(SIDEBAR_COOKIE);
  const initialSidebarOpen = sidebarCookie ? sidebarCookie.value === "true" : undefined;
  const panelCookie = cookieStore.get(PANEL_COOKIE);
  const initialPanelOpen = panelCookie ? panelCookie.value === "true" : false;

  // Profile data for providers
  const context = await api.post("/department/context", { body: {} } as ContextIn) as ContextOut;
  const snapshot = buildSnapshot(session, context.profile);

  // Parse search params using nuqs
  const paramsObj = await searchParams;
  const searchParamsObj = new URLSearchParams();
  Object.entries(paramsObj).forEach(([key, value]) => {
    if (value) {
      if (Array.isArray(value)) {
        value.forEach((v) => searchParamsObj.append(key, v));
      } else {
        searchParamsObj.set(key, value);
      }
    }
  });

  // Inline server-side parsers for department search params
  const departmentSearchParams = {
    draftId: parseAsString,
  };
  const loadDepartmentSearchParams = createLoader(departmentSearchParams);
  const q = loadDepartmentSearchParams(searchParamsObj);

  try {
    const input: GetDepartmentIn = {
      body: {
        department_id: departmentId,
        draft_id: q.draftId ?? null,
      } as GetDepartmentIn["body"],
    };

    const [departmentDetail, context, draftsResult, groupResult] = await Promise.all([
      getDepartment(input),
      api.post("/department/context", { body: { entity_id: departmentId } } as ContextIn) as Promise<ContextOut>,
      api.post("/department/drafts", {}),
      api.post("/department/group", { body: {} } as GroupDepartmentIn),
    ]);

    const entityName = context.page_metadata?.detail.title;

    return (
      <DraftProviderClient drafts={draftsResult.entries ?? []}>
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
            { title: "Departments", section: "departments", url: "/system/departments" },
            { title: entityName },
          ]}
          toolbar={<SaveToolbar />}
          panelProps={{
            artifactType: "department",
            groupId: (groupResult as GroupDepartmentOut & { group_id?: string })?.group_id ?? null,
            generateAction: generateDepartment,
            operations: ["draft", "get", "group"],
            getGroupHistory: getDepartmentGroupHistory,
            searchGroups: searchDepartmentGroups,
            prompts: context.prompts?.prompts,
          }}
        >
          <div
            className="space-y-6 px-4"
            data-page="department-edit"
            data-department-id={departmentId}
          >
            <Department
              key={q.draftId || departmentId}
              departmentId={departmentId}
              departmentData={departmentDetail}
              createDepartmentAction={createDepartment}
              updateDepartmentAction={updateDepartment}
              patchDepartmentDraftAction={patchDepartmentDraft}
              createNamesAction={createDraftNames}
              createDescriptionsAction={createDraftDescriptions}
            />
          </div>
        </FullPageLayout>
      </DraftProviderClient>
    );
  } catch (error: unknown) {
    // Check if it's a 403 error (department access denied)
    if (
      error &&
      typeof error === "object" &&
      "status" in error &&
      (error.status === 401 || error.status === 403)
    ) {
      return (
        <UnifiedAccessDenied
          reason="department"
          resourceType="department"
          redirectPath="/system/departments"
        />
      );
    }
    // Re-throw other errors
    throw error;
  }
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  CreateDraftDescriptionsIn,
  CreateDraftDescriptionsOut,
  CreateDraftNamesIn,
  CreateDraftNamesOut,
  GetDepartmentIn,
  GetDepartmentOut,
  PatchDepartmentDraftIn,
  PatchDepartmentDraftOut,
  CreateDepartmentIn,
  CreateDepartmentOut,
  UpdateDepartmentIn,
  UpdateDepartmentOut,
};
