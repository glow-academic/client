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
type AuthNewIn = InputOf<"/api/v3/auth/new", "post">;
type AuthNewOut = OutputOf<"/api/v3/auth/new", "post">;

type CreateAuthIn = InputOf<"/api/v3/auth/create", "post">;
type CreateAuthOut = OutputOf<"/api/v3/auth/create", "post">;

/** ---- Direct fetch (no caching - source of truth) ----
 * Always bypass cache to ensure fresh data for create pages.
 */
const getAuthDefault = async (profileId: string): Promise<AuthNewOut> => {
  return api.post(
    "/auth/new",
    { body: { profileId } },
    {
      cache: "no-store",
      headers: {
        "X-Bypass-Cache": "1",
      },
    },
  );
};

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Create Auth",
    description: "Create a new authentication method for teaching assistant training platform. Configure SSO, OAuth, and other identity providers for secure access to educational institutions and L&D programs.",
  };
}

/** ---- Strongly-typed server actions (single source of truth) ---- */
async function createAuth(input: CreateAuthIn): Promise<CreateAuthOut> {
  "use server";
  const session = await getSession();
  const profileId = session?.effectiveProfileId || "guest-profile-id";
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/auth/create", {
    ...input,
    body: { ...input.body, profileId },
  });
}

async function createKey(input: CreateKeyIn): Promise<CreateKeyOut> {
  "use server";
  const session = await getSession();
  const profileId = session?.effectiveProfileId || "guest-profile-id";
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/keys/create", {
    ...input,
    body: { ...input.body, profileId },
  });
}

async function updateKey(input: UpdateKeyIn): Promise<UpdateKeyOut> {
  "use server";
  const session = await getSession();
  const profileId = session?.effectiveProfileId || "guest-profile-id";
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/keys/update", {
    ...input,
    body: { ...input.body, profileId },
  });
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
export type { AuthNewIn, AuthNewOut, CreateAuthIn, CreateAuthOut };
