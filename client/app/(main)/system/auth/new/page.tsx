/**
 * app/(main)/system/auth/new/page.tsx
 * Auth create page
 */
import Auth from "@/components/auth/Auth";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";
import { createLoader, parseAsString } from "nuqs/server";

/** ---- Strong types from OpenAPI ---- */
type AuthNewIn = InputOf<"/api/v4/auth/new", "post">;
type AuthNewOut = OutputOf<"/api/v4/auth/new", "post">;

type CreateAuthIn = InputOf<"/api/v4/auth/create", "post">;
type CreateAuthOut = OutputOf<"/api/v4/auth/create", "post">;

type PatchAuthDraftIn = InputOf<"/api/v4/auth/draft", "patch">;
type PatchAuthDraftOut = OutputOf<"/api/v4/auth/draft", "patch">;

/** ---- Direct fetch (no caching - source of truth) ----
 * Always bypass cache to ensure fresh data for create pages.
 */
const getAuthDefault = async (input: AuthNewIn): Promise<AuthNewOut> => {
  return api.post("/auth/new", input, {
    cache: "no-store",
    headers: {
      "X-Bypass-Cache": "1",
    },
  });
};

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Create Auth",
    description:
      "Create a new authentication method for teaching assistant training platform. Configure SSO, OAuth, and other identity providers for secure access to educational institutions and L&D programs.",
  };
}

/** ---- Strongly-typed server actions (single source of truth) ---- */
async function createAuth(input: CreateAuthIn): Promise<CreateAuthOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/auth/create", input);
}

async function patchAuthDraft(
  input: PatchAuthDraftIn
): Promise<PatchAuthDraftOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  return api.patch("/auth/draft", input);
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

  // Fetch default auth detail with draft_id
  const input: AuthNewIn = {
    body: {
      draft_id: q.draftId ?? null,
    } as AuthNewIn["body"],
  };
  const authDetailDefault = await getAuthDefault(input);

  return (
    <div className="space-y-6" data-page="auth-create">
      <Auth
        key={q.draftId || "no-draft"} // Force remount when draftId changes to ensure clean state reset
        mode="create"
        authDetailDefault={authDetailDefault}
        createAuthAction={createAuth}
        patchAuthDraftAction={patchAuthDraft}
      />
    </div>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  AuthNewIn,
  AuthNewOut,
  CreateAuthIn,
  CreateAuthOut,
  PatchAuthDraftIn,
  PatchAuthDraftOut,
};
