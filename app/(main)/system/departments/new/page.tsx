/**
 * app/(main)/system/departments/new/page.tsx
 * New department page — full SSR rendering with FullPageLayout.
 * Page owns all data fetching, server actions, and layout rendering.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import { getSession } from "@/auth";
import { UnifiedAccessDenied } from "@/components/common/layout/UnifiedAccessDenied";
import { FullPageLayout, type PanelProps } from "@/components/common/layout/FullPageLayout";
import { SaveToolbar } from "@/components/common/drafts/SaveToolbar";
import { DraftProviderClient } from "@/contexts/draft-context";
import Department from "@/components/artifacts/department/Department";

import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { createLoader, parseAsString } from "nuqs/server";

import { buildSnapshot } from "@/lib/auth";

import { cache } from "react";
import { readGenerationPanelPrefs } from "@/lib/generation/panel-prefs";
/** ---- Strong types from OpenAPI ---- */
type GetDepartmentIn = InputOf<"/department/get", "post">;
type GetDepartmentOut = OutputOf<"/department/get", "post">;
type CreateDepartmentIn = InputOf<"/department/create", "post">;
type CreateDepartmentOut = OutputOf<"/department/create", "post">;
type PatchDepartmentDraftIn = InputOf<"/department/draft", "patch">;
type PatchDepartmentDraftOut = OutputOf<"/department/draft", "patch">;
type GroupDepartmentIn = InputOf<"/department/group", "post">;
type GroupDepartmentOut = OutputOf<"/department/group", "post">;
type GenerationsIn = InputOf<"/department/generations", "post">;
type GenerationsOut = OutputOf<"/department/generations", "post">;
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

async function patchDepartmentDraft(
  input: PatchDepartmentDraftIn
): Promise<PatchDepartmentDraftOut> {
  "use server";
  return api.patch("/department/draft", input);
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
    const context = await getDepartmentContext();
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
      groupId: parseAsString,
      groupSearch: parseAsString,
    };
    const loadDepartmentSearchParams = createLoader(departmentSearchParams);
    const q = loadDepartmentSearchParams(searchParamsObj);

    // Fetch default department detail server-side with draft_id (unified get endpoint with department_id = null)
    const input: GetDepartmentIn = {
      body: {
        id: null,
        draft_id: q.draftId ?? null,
      } as GetDepartmentIn["body"],
    } as unknown as GetDepartmentIn;
    const [departmentDetailDefault, draftsResult, groupResult] = await Promise.all([
      getDepartmentDefault(input),
      api.post("/department/drafts", {} as never),
      api.post(
        "/department/group",
        { body: q.groupId ? { group_id: q.groupId } : {} } as GroupDepartmentIn,
      ),
    ]);

    return (
      <DraftProviderClient drafts={((draftsResult as any).entries ?? [])}>
        <FullPageLayout
          profileData={context.profile}
          sessionSnapshot={snapshot}
          {...(initialSidebarOpen !== undefined ? { initialSidebarOpen } : {})}
          initialPanelOpen={initialPanelOpen}
          sidebarProps={{
            activeSection: "department",
            createFeedback: createDepartmentProblem as unknown as (
              input: Record<string, unknown>,
            ) => Promise<Record<string, unknown>>,
          }}
          breadcrumbs={[
            { title: "System", section: "system", url: "/system" },
            { title: "Departments", section: "departments", url: "/system/departments" },
            { title: "New Department" },
          ]}
          toolbar={<SaveToolbar />}
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
            ...(context.prompts?.prompts
              ? { prompts: context.prompts.prompts }
              : {}),
            getGroupAction: getDepartmentGroup as PanelProps["getGroupAction"],
            searchGenerationsAction:
              searchDepartmentGenerations as PanelProps["searchGenerationsAction"],
          } as any}
        >
          <div
            className="space-y-6 px-4"
            data-page="department-new"
            aria-label="Create new department page"
          >
            <Department
              departmentData={departmentDetailDefault}
              createDepartmentAction={createDepartment}
              patchDepartmentDraftAction={patchDepartmentDraft}
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
  GetDepartmentIn,
  GetDepartmentOut,
  PatchDepartmentDraftIn,
  PatchDepartmentDraftOut,
  CreateDepartmentIn,
  CreateDepartmentOut,
};
