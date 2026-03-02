/**
 * app/(main)/system/auth/[authId]/page.tsx
 * Auth edit page - uses unified get/save endpoints and Auth component
 */

import Auth from "@/components/artifacts/auth/Auth";
import { UnifiedAccessDenied } from "@/components/common/layout/UnifiedAccessDenied";
import { resolveGroupId } from "@/app/(main)/layout-server";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";
import { createLoader, parseAsString } from "nuqs/server";

/** ---- Strong types from OpenAPI ---- */
type GetAuthIn = InputOf<"/api/v4/artifacts/auths/get", "post">;
type GetAuthOut = OutputOf<"/api/v4/artifacts/auths/get", "post">;
type SaveAuthIn = InputOf<"/api/v4/artifacts/auths/save", "post">;
type SaveAuthOut = OutputOf<"/api/v4/artifacts/auths/save", "post">;
type PatchAuthDraftIn = InputOf<"/api/v4/artifacts/auths/draft", "patch">;
type PatchAuthDraftOut = OutputOf<"/api/v4/artifacts/auths/draft", "patch">;
type CreateDraftNamesIn = InputOf<"/api/v4/resources/names", "post">;
type CreateDraftNamesOut = OutputOf<"/api/v4/resources/names", "post">;
type CreateDraftDescriptionsIn = InputOf<
  "/api/v4/resources/descriptions",
  "post"
>;
type CreateDraftDescriptionsOut = OutputOf<
  "/api/v4/resources/descriptions",
  "post"
>;
type CreateDraftProtocolsIn = InputOf<"/api/v4/resources/protocols", "post">;
type CreateDraftProtocolsOut = OutputOf<"/api/v4/resources/protocols", "post">;
type CreateDraftSlugsIn = InputOf<"/api/v4/resources/slugs", "post">;
type CreateDraftSlugsOut = OutputOf<"/api/v4/resources/slugs", "post">;

/** ---- Direct fetch (no caching - source of truth) ----
 * Always bypass cache to ensure fresh data for detail/edit pages.
 */
const getAuth = async (input: GetAuthIn): Promise<GetAuthOut> => {
  return api.post("/artifacts/auths/get", input, {
    cache: "no-store",
    headers: {
      "X-Bypass-Cache": "1",
    },
  });
};

/** ---- Docs types for page metadata ---- */
type DocsIn = InputOf<"/api/v4/artifacts/auths/docs", "post">;
type DocsOut = OutputOf<"/api/v4/artifacts/auths/docs", "post">;

const getDocs = async (input: DocsIn): Promise<DocsOut> => {
  return api.post("/artifacts/auths/docs", input);
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ authId: string }>;
}): Promise<Metadata> {
  const { authId } = await params;
  const docs = await getDocs({ body: { entity_id: authId } });
  return { title: docs.detail.title, description: docs.detail.description };
}

/** ---- Strongly-typed server actions (single source of truth) ---- */
async function saveAuth(input: SaveAuthIn): Promise<SaveAuthOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/artifacts/auths/save", input);
}

async function patchAuthDraft(
  input: PatchAuthDraftIn
): Promise<PatchAuthDraftOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  return api.patch("/artifacts/auths/draft", input);
}

async function createDraftNames(
  input: CreateDraftNamesIn
): Promise<CreateDraftNamesOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  return api.post("/resources/names", input);
}

async function createDraftDescriptions(
  input: CreateDraftDescriptionsIn
): Promise<CreateDraftDescriptionsOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  return api.post("/resources/descriptions", input);
}

async function createDraftProtocols(
  input: CreateDraftProtocolsIn
): Promise<CreateDraftProtocolsOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  return api.post("/resources/protocols", input);
}

async function createDraftSlugs(
  input: CreateDraftSlugsIn
): Promise<CreateDraftSlugsOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  return api.post("/resources/slugs", input);
}

/** ---- Server renders client with typed data and actions ---- */
export default async function AuthEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ authId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { authId } = await params;
  // Access control handled server-side in layout
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
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

  const groupId = (await resolveGroupId({ draft_id: q.draftId ?? null, artifact_type: "auth" })).group_id;

  // Fetch auth detail (always fresh - source of truth) with draft_id
  try {
    const input: GetAuthIn = {
      body: {
        auth_id: authId,
        draft_id: q.draftId ?? null,
        group_id: groupId,
      } as GetAuthIn["body"],
    };
    const authData = await getAuth(input);

    return (
      <div className="space-y-6" data-page="auth-edit" data-auth-id={authId}>
        <Auth
          key={q.draftId || "no-draft"} // Force remount when draftId changes to ensure clean state reset
          authId={authId}
          authData={authData}
          saveAuthAction={saveAuth}
          patchAuthDraftAction={patchAuthDraft}
          createNamesAction={createDraftNames}
          createDescriptionsAction={createDraftDescriptions}
          createProtocolsAction={createDraftProtocols}
          createSlugsAction={createDraftSlugs}
        />
      </div>
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
  SaveAuthIn,
  SaveAuthOut,
};
