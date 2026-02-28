/**
 * app/(main)/system/auth/new/page.tsx
 * Auth create page - uses unified get/save endpoints and NewAuth component
 */
import Auth from "@/components/artifacts/auth/Auth";
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
 * Always bypass cache to ensure fresh data for create pages.
 */
const getAuthDefault = async (input: GetAuthIn): Promise<GetAuthOut> => {
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

export async function generateMetadata(): Promise<Metadata> {
  const docs = await getDocs({ body: {} });
  return { title: docs.new.title, description: docs.new.description };
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
export default async function AuthCreatePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // Access control handled server-side in layout
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
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

  // Inline server-side parsers for auth search params
  const authSearchParams = {
    draftId: parseAsString,
  };
  const loadAuthSearchParams = createLoader(authSearchParams);
  const q = loadAuthSearchParams(searchParamsObj);

  const groupId = await resolveGroupId(q.draftId ?? null, "auth");

  // Fetch default auth detail with draft_id (auth_id = NULL for new mode)
  const input: GetAuthIn = {
    body: {
      auth_id: null, // NULL for new mode
      draft_id: q.draftId ?? null,
      group_id: groupId,
    } as GetAuthIn["body"],
  };
  const authData = await getAuthDefault(input);

  return (
    <div className="space-y-6" data-page="auth-create">
      <Auth
        key={q.draftId || "no-draft"} // Force remount when draftId changes to ensure clean state reset
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
