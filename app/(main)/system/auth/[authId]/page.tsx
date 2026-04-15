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

import { getLayoutContextData } from "@/app/(main)/layout-server";

/** ---- Strong types from OpenAPI ---- */
type GetAuthIn = InputOf<"/auths/get", "post">;
type GetAuthOut = OutputOf<"/auths/get", "post">;
type CreateAuthIn = InputOf<"/auths/create", "post">;
type CreateAuthOut = OutputOf<"/auths/create", "post">;
type UpdateAuthIn = InputOf<"/auths/update", "post">;
type UpdateAuthOut = OutputOf<"/auths/update", "post">;
type PatchAuthDraftIn = InputOf<"/auths/draft", "patch">;
type PatchAuthDraftOut = OutputOf<"/auths/draft", "patch">;
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
type CreateDraftProtocolsIn = InputOf<"/api/v5/resources/protocols", "post">;
type CreateDraftProtocolsOut = OutputOf<"/api/v5/resources/protocols", "post">;
type CreateDraftSlugsIn = InputOf<"/api/v5/resources/slugs", "post">;
type CreateDraftSlugsOut = OutputOf<"/api/v5/resources/slugs", "post">;
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

/** ---- Direct fetch (no caching - source of truth) ---- */
const getAuth = async (input: GetAuthIn): Promise<GetAuthOut> => {
  return api.post("/auths/get", input, {
    cache: "no-store",
    headers: {
      "X-Bypass-Cache": "1",
    },
  });
};

/** ---- Strongly-typed server actions (single source of truth) ---- */
async function createAuth(input: CreateAuthIn): Promise<CreateAuthOut> {
  "use server";
  return api.post("/auths/create", input);
}

async function updateAuth(input: UpdateAuthIn): Promise<UpdateAuthOut> {
  "use server";
  return api.post("/auths/update", input);
}

async function patchAuthDraft(
  input: PatchAuthDraftIn
): Promise<PatchAuthDraftOut> {
  "use server";
  return api.patch("/auths/draft", input);
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

async function createDraftProtocols(
  input: CreateDraftProtocolsIn
): Promise<CreateDraftProtocolsOut> {
  "use server";
  return api.post("/resources/protocols", input);
}

async function createDraftSlugs(
  input: CreateDraftSlugsIn
): Promise<CreateDraftSlugsOut> {
  "use server";
  return api.post("/resources/slugs", input);
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
export async function generateMetadata({
  params,
}: {
  params: Promise<{ authId: string }>;
}): Promise<Metadata> {
  const { authId } = await params;
  const context = await api.post("/auths/context", { body: { entity_id: authId } } as ContextIn) as ContextOut;
  return {
    title: context.page_metadata?.detail.title,
    description: context.page_metadata?.detail.description,
  };
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
  const { profileData, snapshot } = await getLayoutContextData(session);

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
    const input: GetAuthIn = {
      body: {
        auth_id: authId,
        draft_id: q.draftId ?? null,
      } as GetAuthIn["body"],
    };
    const [authData, context, draftsResult, groupResult] = await Promise.all([
      getAuth(input),
      api.post("/auths/context", { body: { entity_id: authId } } as ContextIn) as Promise<ContextOut>,
      api.post("/auths/drafts", {}),
      api.post("/auths/group", { body: {} } as GroupAuthIn),
    ]);

    const entityName = context.page_metadata?.detail.title;

    return (
      <DraftProviderClient drafts={draftsResult.entries ?? []}>
        <FullPageLayout
          profileData={profileData}
          sessionSnapshot={snapshot}
          initialSidebarOpen={initialSidebarOpen}
          initialPanelOpen={initialPanelOpen}
          sidebarProps={{
            activeSection: "auth",
            createFeedback: createAuthProblem,
          }}
          breadcrumbs={[
            { title: "System", section: "system", url: "/system" },
            { title: "Auth", section: "auth", url: "/system/auth" },
            { title: entityName },
          ]}
          toolbar={<SaveToolbar />}
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
          <div className="space-y-6 px-4" data-page="auth-edit" data-auth-id={authId}>
            <Auth
              key={q.draftId || "no-draft"}
              authId={authId}
              authData={authData}
              createAuthAction={createAuth}
              updateAuthAction={updateAuth}
              patchAuthDraftAction={patchAuthDraft}
              createNamesAction={createDraftNames}
              createDescriptionsAction={createDraftDescriptions}
              createProtocolsAction={createDraftProtocols}
              createSlugsAction={createDraftSlugs}
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
      error.status === 403
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
  CreateDraftDescriptionsIn,
  CreateDraftDescriptionsOut,
  CreateDraftNamesIn,
  CreateDraftNamesOut,
  CreateDraftProtocolsIn,
  CreateDraftProtocolsOut,
  CreateDraftSlugsIn,
  CreateDraftSlugsOut,
  GetAuthIn,
  GetAuthOut,
  PatchAuthDraftIn,
  PatchAuthDraftOut,
  CreateAuthIn,
  CreateAuthOut,
  UpdateAuthIn,
  UpdateAuthOut,
};
