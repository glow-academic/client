/**
 * app/(main)/system/auth/[authId]/page.tsx
 * Auth edit page — full SSR rendering with FullPageLayout.
 * Page owns all data fetching, server actions, and layout rendering.
 * @AshokSaravanan222 & @siladiea
 * 04/14/2026
 */

import { getSession } from "@/auth";
import { UnifiedAccessDenied } from "@/components/common/layout/UnifiedAccessDenied";
import { FullPageLayout, type PanelProps } from "@/components/common/layout/FullPageLayout";
import { SaveToolbar } from "@/components/common/drafts/SaveToolbar";
import Auth from "@/components/artifacts/auth/Auth";
import { DraftProviderClient } from "@/contexts/draft-context";

import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { createLoader, parseAsString } from "nuqs/server";

import { buildSnapshot } from "@/lib/auth";

import { cache } from "react";
import { readGenerationPanelPrefs } from "@/lib/generation/panel-prefs";
/** ---- Strong types from OpenAPI ---- */
type GetAuthIn = InputOf<"/auth/get", "post">;
type GetAuthOut = OutputOf<"/auth/get", "post">;
type CreateAuthIn = InputOf<"/auth/create", "post">;
type CreateAuthOut = OutputOf<"/auth/create", "post">;
type UpdateAuthIn = InputOf<"/auth/update", "post">;
type UpdateAuthOut = OutputOf<"/auth/update", "post">;
type PatchAuthDraftIn = InputOf<"/auth/draft", "post">;
type PatchAuthDraftOut = OutputOf<"/auth/draft", "post">;
type GroupAuthIn = InputOf<"/auth/group", "post">;
type GroupAuthOut = OutputOf<"/auth/group", "post">;
type GenerationsIn = InputOf<"/auth/generations", "post">;
type GenerationsOut = OutputOf<"/auth/generations", "post">;
type ProblemAuthIn = InputOf<"/auth/problem", "post">;
type ProblemAuthOut = OutputOf<"/auth/problem", "post">;
type ContextIn = InputOf<"/auth/context", "post">;
type ContextOut = OutputOf<"/auth/context", "post">;

/** ---- Direct fetch (no caching - source of truth) ---- */
const getAuth = async (input: GetAuthIn): Promise<GetAuthOut> => {
  return api.post("/auth/get", input, {
    cache: "no-store",
    headers: {
      "X-Bypass-Cache": "1",
    },
  });
};

/** ---- Strongly-typed server actions (single source of truth) ---- */
async function createAuth(input: CreateAuthIn): Promise<CreateAuthOut> {
  "use server";
  return api.post("/auth/create", input);
}

async function updateAuth(input: UpdateAuthIn): Promise<UpdateAuthOut> {
  "use server";
  return api.post("/auth/update", input);
}

async function patchAuthDraft(
  input: PatchAuthDraftIn
): Promise<PatchAuthDraftOut> {
  "use server";
  return api.post("/auth/draft", input);
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
const getAuthContextById = cache(
  async (id: string): Promise<ContextOut> =>
    api.post("/auth/context", { body: { entity_id: id } } as ContextIn) as Promise<ContextOut>,
);

/** ---- Page metadata ---- */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ authId: string }>;
}): Promise<Metadata> {
  try {
    const { authId } = await params;
    const context = await getAuthContextById(authId);
    return {
      title: context.page_metadata?.detail.title,
      description: context.page_metadata?.detail.description,
    };
  } catch {
    return { title: "Auth" };
  }
}

/** ---- Cookies ---- */
const SIDEBAR_COOKIE = "glow_sidebar";
const PANEL_COOKIE = "glow_panel";

/** ---- Server renders client with typed data and actions ---- */
export default async function AuthEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ authId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { authId } = await params;
  const session = await getSession();

  // Read UI preferences from cookies for SSR
  const cookieStore = await cookies();
  const sidebarCookie = cookieStore.get(SIDEBAR_COOKIE);
  const initialSidebarOpen = sidebarCookie ? sidebarCookie.value === "true" : undefined;
  const panelCookie = cookieStore.get(PANEL_COOKIE);
  const initialPanelOpen = panelCookie ? panelCookie.value === "true" : false;

  // Profile data for providers
  const context = await api.post("/auth/context", { body: {} } as ContextIn) as ContextOut;
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

  // Inline server-side parsers for auth search params
  const authSearchParams = {
    draftId: parseAsString,
    groupId: parseAsString,
    groupSearch: parseAsString,
  };
  const loadAuthSearchParams = createLoader(authSearchParams);
  const q = loadAuthSearchParams(searchParamsObj);

  // Fetch auth detail (always fresh - source of truth) with draft_id
  try {
    const input = {
      body: {
        auth_id: authId,
        draft_id: q.draftId ?? null,
      } as GetAuthIn["body"],
    } as GetAuthIn;
    const [authData, context, draftsResult, groupResult] = await Promise.all([
      getAuth(input),
      getAuthContextById(authId) as Promise<ContextOut>,
      api.post("/auth/drafts", { body: { page_limit: 50, page_offset: 0 } }),
      api.post(
        "/auth/group",
        { body: q.groupId ? { group_id: q.groupId } : {} } as GroupAuthIn,
      ),
    ]);

    const entityName = context.page_metadata?.detail.title ?? "Auth";

    const layoutProps = {
      profileData: context.profile,
      sessionSnapshot: snapshot,
      sidebarProps: {
        activeSection: "auth",
        createFeedback: createAuthProblem as never,
      },
      breadcrumbs: [
        { title: "System", section: "system", url: "/system" },
        { title: "Auth", section: "auth", url: "/system/auth" },
        { title: entityName },
      ],
      toolbar: <SaveToolbar />,
      panelProps: {
        artifactType: "auth",
        initialPanelPrefs: await readGenerationPanelPrefs(),
        groupId: (groupResult as GroupAuthOut & { group_id?: string })?.group_id ?? null,
        groupName:
          (groupResult as GroupAuthOut & { name?: string | null })?.name ?? null,
        operations: ["draft", "get", "title"],
        getGroupHistory: getAuthGroupHistory,
        searchGroups: searchAuthGroups,
        getGroupAction: getAuthGroup as PanelProps["getGroupAction"],
        searchGenerationsAction:
          searchAuthGenerations as PanelProps["searchGenerationsAction"],
      },
      ...(initialSidebarOpen !== undefined ? { initialSidebarOpen } : {}),
      ...(initialPanelOpen !== undefined ? { initialPanelOpen } : {}),
    };
    return (
      <DraftProviderClient drafts={(draftsResult.entries ?? []) as never}>
        <FullPageLayout {...layoutProps}>
          <div className="space-y-6 px-4" data-page="auth-edit" data-auth-id={authId}>
            <Auth
              key={q.draftId || "no-draft"}
              authId={authId}
              authData={authData}
              createAuthAction={createAuth}
              updateAuthAction={updateAuth}
              patchAuthDraftAction={patchAuthDraft}
            />
          </div>
        </FullPageLayout>
      </DraftProviderClient>
    );
  } catch (error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "status" in error
    ) {
      // 401 → not logged in. 403 → resource belongs to a department the
      // user isn't in. Don't conflate.
      if (error.status === 401) {
        return (
          <UnifiedAccessDenied
            reason="not-logged-in"
            pathname={`/system/auth/${authId}`}
          />
        );
      }
      if (error.status === 403) {
        return (
          <UnifiedAccessDenied
            reason="department"
            resourceType="auth"
            redirectPath="/system/auth"
          />
        );
      }
    }
    // Re-throw other errors
    throw error;
  }
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  GetAuthIn,
  GetAuthOut,
  PatchAuthDraftIn,
  PatchAuthDraftOut,
  CreateAuthIn,
  CreateAuthOut,
  UpdateAuthIn,
  UpdateAuthOut,
};
