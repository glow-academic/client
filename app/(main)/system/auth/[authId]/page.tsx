/**
 * app/(main)/system/auth/[authId]/page.tsx
 * Auth edit page — full SSR rendering with FullPageLayout.
 * Page owns all data fetching, server actions, and layout rendering.
 * @AshokSaravanan222 & @siladiea
 * 04/14/2026
 */

import { getSession } from "@/auth";
import { UnifiedAccessDenied } from "@/components/common/layout/UnifiedAccessDenied";
import { FullPageLayout } from "@/components/common/layout/FullPageLayout";
import { SaveToolbar } from "@/components/common/drafts/SaveToolbar";
import Auth from "@/components/artifacts/auth/Auth";
import { DraftProviderClient } from "@/contexts/draft-context";

import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { createLoader, parseAsString } from "nuqs/server";

import { buildSnapshot } from "@/lib/auth";

/** ---- Strong types from OpenAPI ---- */
type GetAuthIn = InputOf<"/auth/get", "post">;
type GetAuthOut = OutputOf<"/auth/get", "post">;
type CreateAuthIn = InputOf<"/auth/create", "post">;
type CreateAuthOut = OutputOf<"/auth/create", "post">;
type UpdateAuthIn = InputOf<"/auth/update", "post">;
type UpdateAuthOut = OutputOf<"/auth/update", "post">;
type PatchAuthDraftIn = InputOf<"/auth/draft", "patch">;
type PatchAuthDraftOut = OutputOf<"/auth/draft", "patch">;
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
  return api.patch("/auth/draft", input);
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
export async function generateMetadata({
  params,
}: {
  params: Promise<{ authId: string }>;
}): Promise<Metadata> {
  try {
    const { authId } = await params;
    const context = await api.post("/auth/context", { body: { entity_id: authId } } as ContextIn) as ContextOut;
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
      api.post("/auth/context", { body: { entity_id: authId } } as ContextIn) as Promise<ContextOut>,
      api.post("/auth/drafts", {} as never),
      api.post("/auth/group", { body: {} } as GroupAuthIn),
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
        groupId: (groupResult as GroupAuthOut & { group_id?: string })?.group_id ?? null,
        generateAction: generateAuth,
        operations: ["draft", "get", "group"],
        getGroupHistory: getAuthGroupHistory,
        searchGroups: searchAuthGroups,
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
          redirectPath="/system/auth"
        />
      );
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
