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

/** ---- Strong types from OpenAPI ---- */
type ParametersListOut = OutputOf<"/parameter/search", "post">;
type DuplicateParameterIn = InputOf<"/parameter/duplicate", "post">;
type DuplicateParameterOut = OutputOf<"/parameter/duplicate", "post">;
type DeleteParameterIn = InputOf<"/parameter/delete", "post">;
type DeleteParameterOut = OutputOf<"/parameter/delete", "post">;
type UpdateParameterIn = InputOf<"/parameter/update", "post">;
type UpdateParameterOut = OutputOf<"/parameter/update", "post">;
type GroupParameterIn = InputOf<"/parameter/group", "post">;
type GroupParameterOut = OutputOf<"/parameter/group", "post">;
type GenerateParameterIn = InputOf<"/parameter/generate", "post">;
type GenerateParameterOut = OutputOf<"/parameter/generate", "post">;
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
const getParametersList = async (): Promise<ParametersListOut> => {
  const bypassCache = await isHardRefresh();
  return api.post(
    "/parameter/search",
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

async function generateParameter(
  input: GenerateParameterIn
): Promise<GenerateParameterOut> {
  "use server";
  return api.post("/parameter/generate", input);
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

async function runParameterGenerate(input: GenerateParameterIn): Promise<GenerateParameterOut> {
  "use server";
  return api.post("/parameter/generate", input);
}

/** ---- Page metadata ---- */
export async function generateMetadata(): Promise<Metadata> {
  try {
    const context = await api.post("/parameter/context", { body: {} } as ContextIn) as ContextOut;
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
    const context = await api.post("/parameter/context", { body: {} } as ContextIn) as ContextOut;
    const snapshot = buildSnapshot(session, context.profile);
    guardPage("/management/parameters", context.profile.role_permissions);

    // Fetch list data, view cookie, and group in parallel
    const [listData, initialColumnVisibility, groupResult] = await Promise.all([
      getParametersList(),
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
          groupId: (groupResult as GroupParameterOut & { group_id?: string })?.group_id ?? null,
          groupName:
            (groupResult as GroupParameterOut & { name?: string | null })?.name ?? null,
          // Forward the full SSR-fetched group payload — the panel
          // seeds historicalMessages from this synchronously and
          // skips the duplicate client-side /<art>/group refetch
          // on first paint, eliminating the hydration flicker.
          initialGroupHistory: groupResult as Record<string, unknown>,
          generateAction: generateParameter,
          operations: ["draft", "get", "group"],
          getGroupHistory: getParameterGroupHistory,
          searchGroups: searchParameterGroups,
          prompts: context.prompts?.prompts,
          getGroupAction: getParameterGroup as PanelProps["getGroupAction"],
          searchGenerationsAction:
            searchParameterGenerations as PanelProps["searchGenerationsAction"],
          runGenerateAction: runParameterGenerate as PanelProps["runGenerateAction"],
        }}
      >
        <div className="space-y-6 px-4" data-page="parameters-index">
          <Parameters
            listData={listData}
            initialColumnVisibility={initialColumnVisibility}
            duplicateParameterAction={duplicateParameter}
            deleteParameterAction={deleteParameter}
            updateParameterAction={updateParameter}
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
  UpdateParameterIn,
  UpdateParameterOut,
};
