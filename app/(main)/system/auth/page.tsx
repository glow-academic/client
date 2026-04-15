/**
 * app/(main)/system/auth/page.tsx
 * Auth list page — full SSR rendering with FullPageLayout.
 * @AshokSaravanan222 & @siladiea
 * 04/14/2026
 */

import { getSession } from "@/auth";
import { FullPageLayout } from "@/components/common/layout/FullPageLayout";
import { NewArtifactButton } from "@/components/common/layout/NewArtifactButton";
import Auths from "@/components/artifacts/auth/Auths";

import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import type { Metadata } from "next";
import { cookies } from "next/headers";

import { buildSnapshot } from "@/lib/auth";

/** ---- Strong types from OpenAPI ---- */
type AuthListOut = OutputOf<"/auths/search", "post">;
type DuplicateAuthIn = InputOf<"/auths/duplicate", "post">;
type DuplicateAuthOut = OutputOf<"/auths/duplicate", "post">;
type DeleteAuthIn = InputOf<"/auths/delete", "post">;
type DeleteAuthOut = OutputOf<"/auths/delete", "post">;
type GroupAuthIn = InputOf<"/auths/group", "post">;
type GroupAuthOut = OutputOf<"/auths/group", "post">;
type GenerateAuthIn = InputOf<"/auths/generate", "post">;
type GenerateAuthOut = OutputOf<"/auths/generate", "post">;
type GenerationsIn = InputOf<"/auths/generations", "post">;
type GenerationsOut = OutputOf<"/auths/generations", "post">;
type ProblemAuthIn = InputOf<"/auths/problem", "post">;
type ProblemAuthOut = OutputOf<"/auths/problem", "post">;
type ContextIn = InputOf<"/auths/context", "post">;
type ContextOut = OutputOf<"/auths/context", "post">;

/** ---- Direct fetch (no Next.js cache) ---- */
const getAuthList = async (): Promise<AuthListOut> => {
  const bypassCache = await isHardRefresh();
  return api.post(
    "/auths/search",
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
  return api.post("/auths/duplicate", input);
}

async function deleteAuth(input: DeleteAuthIn): Promise<DeleteAuthOut> {
  "use server";
  return api.post("/auths/delete", input);
}

async function generateAuth(
  input: GenerateAuthIn
): Promise<GenerateAuthOut> {
  "use server";
  return api.post("/auths/generate", input);
}

async function getAuthGroupHistory(groupId: string): Promise<GroupAuthOut> {
  "use server";
  return api.post("/auths/group", { body: { group_id: groupId } } as GroupAuthIn);
}

async function searchAuthGroups(query: string): Promise<GenerationsOut> {
  "use server";
  return api.post("/auths/generations", { body: { search: query || null } } as GenerationsIn);
}

async function createAuthProblem(input: ProblemAuthIn): Promise<ProblemAuthOut> {
  "use server";
  return api.post("/auths/problem", input);
}

/** ---- Page metadata ---- */
export async function generateMetadata(): Promise<Metadata> {
  const context = await api.post("/auths/context", { body: {} } as ContextIn) as ContextOut;
  return {
    title: context.page_metadata?.list.title,
    description: context.page_metadata?.list.description,
  };
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

  // Profile data for providers
  const context = await api.post("/auths/context", { body: {} } as ContextIn) as ContextOut;
  const snapshot = buildSnapshot(session, context.profile);

  // Fetch list data and group in parallel
  const [listData, groupResult] = await Promise.all([
    getAuthList(),
    api.post("/auths/group", { body: {} } as GroupAuthIn),
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
        permissions: [
          { artifact: "auth", operation: "draft" },
          { artifact: "auth", operation: "get" },
          { artifact: "auth", operation: "docs" },
          { artifact: "auth", operation: "group" },
        ],
        getGroupHistory: getAuthGroupHistory,
        searchGroups: searchAuthGroups,
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
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  AuthListOut,
  DeleteAuthIn,
  DeleteAuthOut,
  DuplicateAuthIn,
  DuplicateAuthOut,
};
