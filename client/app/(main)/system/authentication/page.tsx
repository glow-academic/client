/**
 * app/(main)/system/authentication/page.tsx
 * Authentication list page
 */
import { getSession } from "@/auth";

import Auths from "@/components/auth/Auths";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import type { Metadata } from "next";

/** ---- Strong types from OpenAPI ---- */
type AuthListOut = OutputOf<"/api/v3/auth/list", "post">;
type DuplicateAuthIn = InputOf<"/api/v3/auth/duplicate", "post">;
type DuplicateAuthOut = OutputOf<"/api/v3/auth/duplicate", "post">;
type DeleteAuthIn = InputOf<"/api/v3/auth/delete", "post">;
type DeleteAuthOut = OutputOf<"/api/v3/auth/delete", "post">;
type CreateKeyIn = InputOf<"/api/v3/keys/create", "post">;
type CreateKeyOut = OutputOf<"/api/v3/keys/create", "post">;

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
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/auth/duplicate", input);
}

async function deleteAuth(input: DeleteAuthIn): Promise<DeleteAuthOut> {
  "use server";
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/auth/delete", input);
}

export async function createKey(input: CreateKeyIn): Promise<CreateKeyOut> {
  "use server";
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/keys/create", input);
}

export const metadata: Metadata = {
  title: "Authentication",
  description: `Manage authentication methods in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
};

export default async function AuthenticationPage() {
  const session = await getSession();
  const profileId = session?.effectiveProfileId || "";

  // Fetch list data server-side
  const listData = await getAuthList(profileId);

  return (
    <div className="space-y-6" data-page="authentication-index">
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
  DeleteAuthIn,
  DeleteAuthOut,
  DuplicateAuthIn,
  DuplicateAuthOut,
};
