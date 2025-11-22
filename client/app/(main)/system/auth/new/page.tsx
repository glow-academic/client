/**
 * app/(main)/system/auth/new/page.tsx
 * Auth create page
 */

import { getSession } from "@/auth";

import Auth from "@/components/auth/Auth";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";
import type {
  CreateKeyIn,
  CreateKeyOut,
  UpdateKeyIn,
  UpdateKeyOut,
} from "@/app/(main)/system/auth/page";

/** ---- Strong types from OpenAPI ---- */
type AuthDetailDefaultIn = InputOf<
  "/api/v3/auth/detail-default",
  "post"
>;
type AuthDetailDefaultOut = OutputOf<
  "/api/v3/auth/detail-default",
  "post"
>;

type CreateAuthIn = InputOf<"/api/v3/auth/create", "post">;
type CreateAuthOut = OutputOf<"/api/v3/auth/create", "post">;

/** ---- Direct fetch (no caching - source of truth) ----
 * Always bypass cache to ensure fresh data for create pages.
 */
const getAuthDefault = async (
  profileId: string
): Promise<AuthDetailDefaultOut> => {
  return api.post(
    "/auth/detail-default",
    { body: { profileId } },
    {
      cache: "no-store",
      headers: {
        "X-Bypass-Cache": "1",
      },
    }
  );
};

export const metadata: Metadata = {
  title: "Create Auth",
  description: `Create a new authentication method in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
};

/** ---- Strongly-typed server actions (single source of truth) ---- */
async function createAuth(input: CreateAuthIn): Promise<CreateAuthOut> {
  "use server";
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/auth/create", input);
}

async function createKey(input: CreateKeyIn): Promise<CreateKeyOut> {
  "use server";
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/keys/create", input);
}

async function updateKey(input: UpdateKeyIn): Promise<UpdateKeyOut> {
  "use server";
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/keys/update", input);
}

/** ---- Server renders client with typed data and actions ---- */
export default async function AuthCreatePage() {
  const session = await getSession();
  const profileId = session?.effectiveProfileId || "";

  // Fetch default auth detail
  const authDetailDefault = await getAuthDefault(profileId);

  return (
    <div className="space-y-6" data-page="auth-create">
      <Auth
        mode="create"
        authDetailDefault={authDetailDefault}
        createAuthAction={createAuth}
        createKeyAction={createKey}
        updateKeyAction={updateKey}
      />
    </div>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  AuthDetailDefaultIn,
  AuthDetailDefaultOut,
  CreateAuthIn,
  CreateAuthOut,
};

