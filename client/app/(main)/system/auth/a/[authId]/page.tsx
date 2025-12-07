/**
 * app/(main)/system/auth/a/[authId]/page.tsx
 * Auth edit page
 */

import { getSession } from "@/auth";

import type {
  CreateKeyIn,
  CreateKeyOut,
  DecryptKeyIn,
  DecryptKeyOut,
  UpdateKeyIn,
  UpdateKeyOut,
} from "@/app/(main)/system/auth/page";
import Auth from "@/components/auth/Auth";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata, ResolvingMetadata } from "next";

/** ---- Strong types from OpenAPI ---- */
type AuthDetailIn = InputOf<"/api/v3/auth/detail", "post">;
type AuthDetailOut = OutputOf<"/api/v3/auth/detail", "post">;

type CreateAuthIn = InputOf<"/api/v3/auth/create", "post">;
type CreateAuthOut = OutputOf<"/api/v3/auth/create", "post">;

type UpdateAuthIn = InputOf<"/api/v3/auth/update", "post">;
type UpdateAuthOut = OutputOf<"/api/v3/auth/update", "post">;
type AuthNewOut = OutputOf<"/api/v3/auth/new", "post">;

/** ---- Direct fetch (no caching - source of truth) ----
 * Always bypass cache to ensure fresh data for detail/edit pages.
 */
const getAuth = async (
  authId: string,
  profileId: string,
): Promise<AuthDetailOut> => {
  return api.post(
    "/auth/detail",
    { body: { authId, profileId } },
    {
      cache: "no-store",
      headers: {
        "X-Bypass-Cache": "1",
      },
    },
  );
};

/** ---- Metadata uses the same cached fetch ---- */
export async function generateMetadata(
  { params }: { params: Promise<{ authId: string }> },
  _parent: ResolvingMetadata,
): Promise<Metadata> {
  const { authId } = await params;
  const session = await getSession();
  const profileId = session?.effectiveProfileId || "";

  try {
    const auth = await getAuth(authId, profileId);
    return {
      title: `${auth?.name || "Auth"} Auth`,
      description: `${auth?.name ? `${auth.name} - ` : ""}Authentication method configuration for teaching assistant training platform.${auth?.description ? ` ${auth.description}` : ""} Manage identity providers and secure access mechanisms for educational institutions and L&D programs.`,
    };
  } catch {
    return {
      title: "Auth",
      description: "Authentication method configuration for teaching assistant training platform. Manage identity providers and secure access mechanisms for educational institutions and L&D programs.",
    };
  }
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

async function updateAuth(input: UpdateAuthIn): Promise<UpdateAuthOut> {
  "use server";
  const session = await getSession();
  const profileId = session?.effectiveProfileId || "guest-profile-id";
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/auth/update", {
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

async function decryptKey(input: DecryptKeyIn): Promise<DecryptKeyOut> {
  "use server";
  // decrypt-key doesn't need profileId
  return api.post("/keys/decrypt-key", input);
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
export default async function AuthEditPage({
  params,
}: {
  params: Promise<{ authId: string }>;
}) {
  const { authId } = await params;
  const session = await getSession();
  const profileId = session?.effectiveProfileId || "";

  // Fetch auth detail (always fresh - source of truth)
  try {
    const authDetail = await getAuth(authId, profileId);

    return (
      <div className="space-y-6" data-page="auth-edit" data-auth-id={authId}>
        <Auth
          authId={authId}
          mode="edit"
          authDetail={authDetail}
          createAuthAction={createAuth}
          updateAuthAction={updateAuth}
          createKeyAction={createKey}
          decryptKeyAction={decryptKey}
          updateKeyAction={updateKey}
        />
      </div>
    );
  } catch (error: unknown) {
    // Check if it's a 403 error (access denied)
    if (
      error &&
      typeof error === "object" &&
      "status" in error &&
      error.status === 403
    ) {
      return (
        <div className="space-y-6">
          <div className="flex items-center justify-center h-96">
            <p className="text-muted-foreground">
              You don't have access to this auth entry.
            </p>
          </div>
        </div>
      );
    }
    // Re-throw other errors
    throw error;
  }
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  AuthNewOut,
  AuthDetailIn,
  AuthDetailOut,
  CreateAuthIn,
  CreateAuthOut,
  UpdateAuthIn,
  UpdateAuthOut,
};
