/**
 * app/(main)/system/auth/a/[authId]/page.tsx
 * Auth edit page
 */

import Auth from "@/components/auth/Auth";
import { UnifiedAccessDenied } from "@/components/common/layout/UnifiedAccessDenied";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata, ResolvingMetadata } from "next";
import { createLoader, parseAsString } from "nuqs/server";

/** ---- Strong types from OpenAPI ---- */
type AuthDetailIn = InputOf<"/api/v4/auth/detail", "post">;
type AuthDetailOut = OutputOf<"/api/v4/auth/detail", "post">;

type CreateAuthIn = InputOf<"/api/v4/auth/create", "post">;
type CreateAuthOut = OutputOf<"/api/v4/auth/create", "post">;

type UpdateAuthIn = InputOf<"/api/v4/auth/update", "post">;
type UpdateAuthOut = OutputOf<"/api/v4/auth/update", "post">;
type AuthNewOut = OutputOf<"/api/v4/auth/new", "post">;

type PatchAuthDraftIn = InputOf<"/api/v4/auth/draft", "patch">;
type PatchAuthDraftOut = OutputOf<"/api/v4/auth/draft", "patch">;

/** ---- Direct fetch (no caching - source of truth) ----
 * Always bypass cache to ensure fresh data for detail/edit pages.
 */
const getAuth = async (input: AuthDetailIn): Promise<AuthDetailOut> => {
  return api.post("/auth/detail", input, {
    cache: "no-store",
    headers: {
      "X-Bypass-Cache": "1",
    },
  });
};

/** ---- Metadata uses the same cached fetch ---- */
export async function generateMetadata(
  { params }: { params: Promise<{ authId: string }> },
  _parent: ResolvingMetadata
): Promise<Metadata> {
  const { authId } = await params;
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  try {
    const input: AuthDetailIn = {
      body: {
        auth_id: authId,
        draft_id: null,
      } as AuthDetailIn["body"],
    };
    const auth = await getAuth(input);
    return {
      title: `${auth?.name || "Auth"} Auth`,
      description: `${auth?.name ? `${auth.name} - ` : ""}Authentication method configuration for teaching assistant training platform.${auth?.description ? ` ${auth.description}` : ""} Manage identity providers and secure access mechanisms for educational institutions and L&D programs.`,
    };
  } catch {
    // Fall through to default metadata
  }

  return {
    title: "Auth",
    description:
      "Authentication method configuration for teaching assistant training platform. Manage identity providers and secure access mechanisms for educational institutions and L&D programs.",
  };
}

/** ---- Strongly-typed server actions (single source of truth) ---- */
async function createAuth(input: CreateAuthIn): Promise<CreateAuthOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/auth/create", input);
}

async function updateAuth(input: UpdateAuthIn): Promise<UpdateAuthOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/auth/update", input);
}

async function patchAuthDraft(
  input: PatchAuthDraftIn
): Promise<PatchAuthDraftOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  return api.patch("/auth/draft", input);
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

  // Fetch auth detail (always fresh - source of truth) with draft_id
  try {
    const input: AuthDetailIn = {
      body: {
        auth_id: authId,
        draft_id: q.draftId ?? null,
      } as AuthDetailIn["body"],
    };
    const authDetail = await getAuth(input);

    return (
      <div className="space-y-6" data-page="auth-edit" data-auth-id={authId}>
        <Auth
          key={q.draftId || "no-draft"} // Force remount when draftId changes to ensure clean state reset
          authId={authId}
          mode="edit"
          authDetail={authDetail}
          createAuthAction={createAuth}
          updateAuthAction={updateAuth}
          patchAuthDraftAction={patchAuthDraft}
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
  AuthDetailIn,
  AuthDetailOut,
  AuthNewOut,
  CreateAuthIn,
  CreateAuthOut,
  PatchAuthDraftIn,
  PatchAuthDraftOut,
  UpdateAuthIn,
  UpdateAuthOut,
};
