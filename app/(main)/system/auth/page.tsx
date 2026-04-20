/**
 * app/(main)/system/auth/page.tsx
 * Auth list page — full SSR rendering with FullPageLayout.
 * @AshokSaravanan222 & @siladiea
 * 04/14/2026
 */

import { getSession } from "@/auth";
import { UnifiedAccessDenied } from "@/components/common/layout/UnifiedAccessDenied";
import { FullPageLayout } from "@/components/common/layout/FullPageLayout";
import { NewArtifactButton } from "@/components/common/layout/NewArtifactButton";
import Auths from "@/components/artifacts/auth/Auths";

import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import type { Metadata } from "next";
import { cookies } from "next/headers";

import { buildSnapshot } from "@/lib/auth";
import { guardPage } from "@/lib/permissions";

/** ---- Strong types from OpenAPI ---- */
type AuthListOut = OutputOf<"/auth/search", "post">;
type DuplicateAuthIn = InputOf<"/auth/duplicate", "post">;
type DuplicateAuthOut = OutputOf<"/auth/duplicate", "post">;
type DeleteAuthIn = InputOf<"/auth/delete", "post">;
type DeleteAuthOut = OutputOf<"/auth/delete", "post">;
type GroupAuthIn = InputOf<"/auth/group", "post">;
type GroupAuthOut = OutputOf<"/auth/group", "post">;
type GenerateAuthIn = InputOf<"/auth/generate", "post">;
type GenerateAuthOut = OutputOf<"/auth/generate", "post">;
type GenerationsIn = InputOf<"/auth/generations", "post">;
type GenerationsOut = OutputOf<"/auth/generations", "post">;
type ProblemAuthIn = InputOf<"/auth/problem", "post">;
type ProblemAuthOut = OutputOf<"/auth/problem", "post">;
type ContextIn = InputOf<"/auth/context", "post">;
type ContextOut = OutputOf<"/auth/context", "post">;

/** ---- Direct fetch (no Next.js cache) ---- */
const getAuthList = async (): Promise<AuthListOut> => {
  const bypassCache = await isHardRefresh();
  return api.post(
    "/auth/search",
    { body: {} },
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

/** ---- Strongly-typed server actions (single source of truth) ---- */
async function duplicateAuth(
  input: DuplicateAuthIn
): Promise<DuplicateAuthOut> {
  "use server";
  return api.post("/auth/duplicate", input);
}

async function deleteAuth(input: DeleteAuthIn): Promise<DeleteAuthOut> {
  "use server";
  return api.post("/auth/delete", input);
}

async function generateAuth(
  input: GenerateAuthIn
): Promise<GenerateAuthOut> {
  "use server";
  return api.post("/auth/generate", input);
}

async function getAuthGroupHistory(groupId: string): Promise<GroupAuthOut> {
  "use server";
  return api.post("/auth/group", { body: { group_id: groupId } } as GroupAuthIn);
}

async function searchAuthGroups(query: string): Promise<GenerationsOut> {
  "use server";
  return api.post("/auth/generations", { body: { search: query || null } } as GenerationsIn);
}

async function createAuthProblem(input: ProblemAuthIn): Promise<ProblemAuthOut> {
  "use server";
  return api.post("/auth/problem", input);
}

/** ---- Page metadata ---- */
export async function generateMetadata(): Promise<Metadata> {
  try {
    const context = await api.post("/auth/context", { body: {} } as ContextIn) as ContextOut;
    return {
      title: context.page_metadata?.list.title,
      description: context.page_metadata?.list.description,
    };
  } catch {
    return { title: "Auth" };
  }
}

/** ---- Cookies ---- */
const SIDEBAR_COOKIE = "glow_sidebar";
const PANEL_COOKIE = "glow_panel";

export default async function AuthPage() {
  const session = await getSession();

  // Read UI preferences from cookies for SSR
  const cookieStore = await cookies();
  const sidebarCookie = cookieStore.get(SIDEBAR_COOKIE);
  const initialSidebarOpen = sidebarCookie ? sidebarCookie.value === "true" : undefined;
  const panelCookie = cookieStore.get(PANEL_COOKIE);
  const initialPanelOpen = panelCookie ? panelCookie.value === "true" : false;

  try {
    // Profile data for providers
    const context = await api.post("/auth/context", { body: {} } as ContextIn) as ContextOut;
    const snapshot = buildSnapshot(session, context.profile);
    guardPage("/system/auth", context.profile.role_permissions);

    // Fetch list data and group in parallel
    const [listData, groupResult] = await Promise.all([
      getAuthList(),
      api.post("/auth/group", { body: {} } as GroupAuthIn),
    ]);

    return (
      <FullPageLayout
        profileData={context.profile}
        sessionSnapshot={snapshot}
        initialSidebarOpen={initialSidebarOpen}
        initialPanelOpen={initialPanelOpen}
        sidebarProps={{
          activeSection: "auth",
          createFeedback: createAuthProblem,
        }}
        breadcrumbs={[
          { title: "System", section: "system", url: "/system" },
          { title: "Auth" },
        ]}
        toolbar={<NewArtifactButton label="New Auth" href="/system/auth/new" />}
        panelProps={{
          artifactType: "auth",
          groupId: (groupResult as GroupAuthOut & { group_id?: string })?.group_id ?? null,
          generateAction: generateAuth,
          operations: ["draft", "get", "group"],
          getGroupHistory: getAuthGroupHistory,
          searchGroups: searchAuthGroups,
          prompts: context.prompts?.prompts,
        }}
      >
        <div className="space-y-6 px-4" data-page="auth-index">
          <Auths
            listData={listData}
            duplicateAuthAction={duplicateAuth}
            deleteAuthAction={deleteAuth}
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
          pathname="/system/auth"
        />
      );
    }
    throw error;
  }
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  AuthListOut,
  DeleteAuthIn,
  DeleteAuthOut,
  DuplicateAuthIn,
  DuplicateAuthOut,
};
