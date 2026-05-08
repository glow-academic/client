/**
 * app/(main)/system/auth/page.tsx
 * Auth list page — full SSR rendering with FullPageLayout.
 * @AshokSaravanan222 & @siladiea
 * 04/14/2026
 */

import { getSession } from "@/auth";
import { UnifiedAccessDenied } from "@/components/common/layout/UnifiedAccessDenied";
import { FullPageLayout, type PanelProps } from "@/components/common/layout/FullPageLayout";
import { NewArtifactButton } from "@/components/common/layout/NewArtifactButton";
import Auths from "@/components/artifacts/auth/Auths";

import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import type { Metadata } from "next";
import { cookies } from "next/headers";

import { buildSnapshot } from "@/lib/auth";
import { guardPage } from "@/lib/permissions";
import { readViewCookie } from "@/lib/view-cookie";
import { loadAuthSearchParams } from "@/lib/search-params/auth";

import { cache } from "react";
import { readGenerationPanelPrefs } from "@/lib/generation/panel-prefs";
/** ---- Strong types from OpenAPI ---- */
type AuthListOut = OutputOf<"/auth/search", "post">;
type DuplicateAuthIn = InputOf<"/auth/duplicate", "post">;
type DuplicateAuthOut = OutputOf<"/auth/duplicate", "post">;
type DeleteAuthIn = InputOf<"/auth/delete", "post">;
type DeleteAuthOut = OutputOf<"/auth/delete", "post">;
type UpdateAuthIn = InputOf<"/auth/update", "post">;
type UpdateAuthOut = OutputOf<"/auth/update", "post">;
type GroupAuthIn = InputOf<"/auth/group", "post">;
type GroupAuthOut = OutputOf<"/auth/group", "post">;
type GenerationsIn = InputOf<"/auth/generations", "post">;
type GenerationsOut = OutputOf<"/auth/generations", "post">;
type ProblemAuthIn = InputOf<"/auth/problem", "post">;
type ProblemAuthOut = OutputOf<"/auth/problem", "post">;
type ContextIn = InputOf<"/auth/context", "post">;
type ContextOut = OutputOf<"/auth/context", "post">;

/** ---- Body type for auths list request ----
 *  Mirrors ``SearchAuthApiRequest`` from the OpenAPI schema plus
 *  ``flag_search`` (server accepts it; openapi.json regen pending). */
type AuthsListBody = {
  search?: string | null;
  filter_department_ids?: string[] | null;
  department_search?: string | null;
  flag_search?: string | null;
  page_size: number | null;
  page_offset: number | null;
};

/** ---- Direct fetch (no Next.js cache) ---- */
const getAuthList = async (body: AuthsListBody): Promise<AuthListOut> => {
  const bypassCache = await isHardRefresh();
  return api.post(
    "/auth/search",
    { body },
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

async function updateAuth(input: UpdateAuthIn): Promise<UpdateAuthOut> {
  "use server";
  return api.post("/auth/update", input);
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

/** ---- GenerationPanel server actions ---- */
async function getAuthGroup(input: GroupAuthIn): Promise<GroupAuthOut> {
  "use server";
  return api.post("/auth/group", input);
}

async function searchAuthGenerations(input: GenerationsIn): Promise<GenerationsOut> {
  "use server";
  return api.post("/auth/generations", input);
}


/** ---- Request-scoped context fetch ----
 * Wrapped in React's ``cache()`` so ``generateMetadata`` and the page
 * component share one network call per request. Server-only; not a
 * cross-request cache. */
const getAuthContext = cache(
  async (): Promise<ContextOut> =>
    api.post("/auth/context", { body: {} } as ContextIn) as Promise<ContextOut>,
);

/** ---- Page metadata ---- */
export async function generateMetadata(): Promise<Metadata> {
  try {
    const context = await getAuthContext();
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

interface AuthPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function AuthPage({ searchParams }: AuthPageProps) {
  const session = await getSession();
  const q = loadAuthSearchParams(await searchParams);

  // Read UI preferences from cookies for SSR
  const cookieStore = await cookies();
  const sidebarCookie = cookieStore.get(SIDEBAR_COOKIE);
  const initialSidebarOpen = sidebarCookie ? sidebarCookie.value === "true" : undefined;
  const panelCookie = cookieStore.get(PANEL_COOKIE);
  const initialPanelOpen = panelCookie ? panelCookie.value === "true" : false;

  try {
    // Profile data for providers
    const context = await getAuthContext();
    const snapshot = buildSnapshot(session, context.profile);
    guardPage("/system/auth", context.profile.role_permissions);

    // Build the search body — the same shape gets forwarded to the
    // bulk-write endpoints under select-all-matching mode so the
    // server resolves matching ids without a client-side enumeration.
    const body: AuthsListBody = { page_size: 1000, page_offset: 0 };

    // Fetch list data, view cookie, and group in parallel
    const [listData, initialColumnVisibility, groupResult] = await Promise.all([
      getAuthList(body),
      readViewCookie("auths"),
      api.post(
        "/auth/group",
        { body: q.groupId ? { group_id: q.groupId } : {} } as GroupAuthIn,
      ),
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
          initialPanelPrefs: await readGenerationPanelPrefs(),
          groupId: (groupResult as GroupAuthOut & { group_id?: string })?.group_id ?? null,
          groupName:
            (groupResult as GroupAuthOut & { name?: string | null })?.name ?? null,
          // Forward the full SSR-fetched group payload — the panel
          // seeds historicalMessages from this synchronously and
          // skips the duplicate client-side /<art>/group refetch
          // on first paint, eliminating the hydration flicker.
          initialGroupHistory: groupResult as Record<string, unknown>,
          operations: ["draft", "get", "title"],
          getGroupHistory: getAuthGroupHistory,
          searchGroups: searchAuthGroups,
          prompts: context.prompts?.prompts,
          getGroupAction: getAuthGroup as PanelProps["getGroupAction"],
          searchGenerationsAction:
            searchAuthGenerations as PanelProps["searchGenerationsAction"],
        }}
      >
        <div className="space-y-6 px-4" data-page="auth-index">
          <Auths
            listData={listData}
            initialColumnVisibility={initialColumnVisibility}
            duplicateAuthAction={duplicateAuth}
            deleteAuthAction={deleteAuth}
            updateAuthAction={updateAuth}
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
  AuthsListBody,
  DeleteAuthIn,
  DeleteAuthOut,
  DuplicateAuthIn,
  DuplicateAuthOut,
  UpdateAuthIn,
  UpdateAuthOut,
};
