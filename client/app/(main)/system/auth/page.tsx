/**
 * app/(main)/system/auth/page.tsx
 * Auth list page
 */
import Auths from "@/components/auth/Auths";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import { getSession } from "@/auth";
import type { Metadata } from "next";

/** ---- Strong types from OpenAPI ---- */
type AuthListOut = OutputOf<"/api/v3/auth/list", "post">;
type DuplicateAuthIn = InputOf<"/api/v3/auth/duplicate", "post">;
type DuplicateAuthOut = OutputOf<"/api/v3/auth/duplicate", "post">;
type DeleteAuthIn = InputOf<"/api/v3/auth/delete", "post">;
type DeleteAuthOut = OutputOf<"/api/v3/auth/delete", "post">;
type CreateKeyIn = InputOf<"/api/v3/keys/create", "post">;
type CreateKeyOut = OutputOf<"/api/v3/keys/create", "post">;
type DecryptKeyIn = InputOf<"/api/v3/keys/decrypt-key", "post">;
type DecryptKeyOut = OutputOf<"/api/v3/keys/decrypt-key", "post">;
type UpdateKeyIn = InputOf<"/api/v3/keys/update", "post">;
type UpdateKeyOut = OutputOf<"/api/v3/keys/update", "post">;

/** ---- Direct fetch (no Next.js cache) ----
 * Using cache: 'no-store' to disable Next.js default fetch caching so hard refresh works.
 * Sending X-Bypass-Cache header only on hard refresh to bypass Redis cache.
 */
const getAuthList = async (profileId: string): Promise<AuthListOut> => {
  const bypassCache = await isHardRefresh();
  return api.post(
    "/auth/list",
    { body: { profileId } },
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
  const session = await getSession();
  const profileId = session?.effectiveProfileId;
  if (!profileId) {
    throw new Error("Authentication required");
  }
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/auth/duplicate", {
    body: { ...input.body, profileId },
  });
}

async function deleteAuth(input: DeleteAuthIn): Promise<DeleteAuthOut> {
  "use server";
  const session = await getSession();
  const profileId = session?.effectiveProfileId;
  if (!profileId) {
    throw new Error("Authentication required");
  }
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/auth/delete", {
    body: { ...input.body, profileId },
  });
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Auth",
    description:
      "Manage authentication methods and identity providers for teaching assistant training platform. Configure SSO, OAuth, and other authentication mechanisms for secure access to educational institutions and L&D programs.",
  };
}

export default async function AuthPage() {
  // Access control is handled server-side in layout
  // Get profileId from session
  const session = await getSession();
  const profileId = session?.effectiveProfileId;

  if (!profileId) {
    // This should not happen due to server-side access control, but handle gracefully
    return null;
  }

  // Fetch list data server-side
  const listData = await getAuthList(profileId);

  return (
    <div className="space-y-6" data-page="auth-index">
      <Auths
        listData={listData}
        duplicateAuthAction={duplicateAuth}
        deleteAuthAction={deleteAuth}
      />
    </div>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  AuthListOut,
  CreateKeyIn,
  CreateKeyOut,
  DecryptKeyIn,
  DecryptKeyOut,
  DeleteAuthIn,
  DeleteAuthOut,
  DuplicateAuthIn,
  DuplicateAuthOut,
  UpdateKeyIn,
  UpdateKeyOut,
};
