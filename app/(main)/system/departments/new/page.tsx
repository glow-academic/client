/**
 * app/(main)/system/departments/new/page.tsx
 * New department page — full SSR rendering with FullPageLayout.
 * Page owns all data fetching, server actions, and layout rendering.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import { getSession } from "@/auth";
import { UnifiedAccessDenied } from "@/components/common/layout/UnifiedAccessDenied";
import { FullPageLayout } from "@/components/common/layout/FullPageLayout";
import { SaveToolbar } from "@/components/common/drafts/SaveToolbar";
import { DraftProviderClient } from "@/contexts/draft-context";
import Department from "@/components/artifacts/department/Department";

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
const getDepartmentDefault = async (
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

async function patchDepartmentDraft(
  input: PatchDepartmentDraftIn
): Promise<PatchDepartmentDraftOut> {
  "use server";
  return api.patch("/department/draft", input);
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
export async function generateMetadata(): Promise<Metadata> {
  try {
    const context = await api.post("/department/context", { body: {} } as ContextIn) as ContextOut;
    return {
      title: context.page_metadata?.new.title,
      description: context.page_metadata?.new.description,
    };
  } catch {
    return { title: "Departments" };
  }
}

/** ---- Cookies ---- */
const SIDEBAR_COOKIE = "glow_sidebar";
const PANEL_COOKIE = "glow_panel";

/** ---- Server renders client with typed data and actions ---- */
export default async function NewDepartmentPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await getSession();

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

    // Inline server-side parsers for department search params
    const departmentSearchParams = {
      draftId: parseAsString,
    };
    const loadDepartmentSearchParams = createLoader(departmentSearchParams);
    const q = loadDepartmentSearchParams(searchParamsObj);

    // Fetch default department detail server-side with draft_id (unified get endpoint with department_id = null)
    const input: GetDepartmentIn = {
      body: {
        department_id: null, // NULL for new mode
        draft_id: q.draftId ?? null,
      } as GetDepartmentIn["body"],
    };
    const [departmentDetailDefault, draftsResult, groupResult] = await Promise.all([
      getDepartmentDefault(input),
      api.post("/department/drafts", {}),
      api.post("/department/group", { body: {} } as GroupDepartmentIn),
    ]);

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
            { title: "New Department" },
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
            data-page="department-new"
            aria-label="Create new department page"
          >
            <Department
              key={q.draftId || "no-draft"}
              departmentData={departmentDetailDefault}
              createDepartmentAction={createDepartment}
              patchDepartmentDraftAction={patchDepartmentDraft}
              createNamesAction={createDraftNames}
              createDescriptionsAction={createDraftDescriptions}
            />
          </div>
        </FullPageLayout>
      </DraftProviderClient>
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
          pathname="/system/departments/new"
        />
      );
    }
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
};
