/**
 * app/(main)/system/auth/page.tsx
 * Auth list page
 */
import Auths from "@/components/auth/Auths";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import type { Metadata } from "next";

/** ---- Strong types from OpenAPI ---- */
type AuthListOut = OutputOf<"/api/v4/artifacts/auths/list", "post">;
type DuplicateAuthIn = InputOf<"/api/v4/artifacts/auths/duplicate", "post">;
type DuplicateAuthOut = OutputOf<"/api/v4/artifacts/auths/duplicate", "post">;
type DeleteAuthIn = InputOf<"/api/v4/artifacts/auths/delete", "post">;
type DeleteAuthOut = OutputOf<"/api/v4/artifacts/auths/delete", "post">;

/** ---- Direct fetch (no Next.js cache) ----
 * Using cache: 'no-store' to disable Next.js default fetch caching so hard refresh works.
 * Sending X-Bypass-Cache header only on hard refresh to bypass Redis cache.
 */
const getAuthList = async (): Promise<AuthListOut> => {
  const bypassCache = await isHardRefresh();
  return api.post(
    "/artifacts/auths/list",
    { body: {} },
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
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/artifacts/auths/duplicate", input);
}

async function deleteAuth(input: DeleteAuthIn): Promise<DeleteAuthOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/artifacts/auths/delete", input);
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Auth",
    description:
      "Manage authentication methods and identity providers for teaching assistant training platform. Configure SSO, OAuth, and other authentication mechanisms for secure access to educational institutions and L&D programs.",
  };
}

export default async function AuthPage() {
  // Access control handled server-side in layout
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  // Fetch list data server-side
  const listData = await getAuthList();

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
  DeleteAuthIn,
  DeleteAuthOut,
  DuplicateAuthIn,
  DuplicateAuthOut,
};
