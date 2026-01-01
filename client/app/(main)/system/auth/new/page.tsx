/**
 * app/(main)/system/auth/new/page.tsx
 * Auth create page
 */
import Auth from "@/components/auth/Auth";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";

/** ---- Strong types from OpenAPI ---- */
type AuthNewIn = InputOf<"/api/v4/auth/new", "post">;
type AuthNewOut = OutputOf<"/api/v4/auth/new", "post">;

type CreateAuthIn = InputOf<"/api/v4/auth/create", "post">;
type CreateAuthOut = OutputOf<"/api/v4/auth/create", "post">;

/** ---- Direct fetch (no caching - source of truth) ----
 * Always bypass cache to ensure fresh data for create pages.
 */
const getAuthDefault = async (): Promise<AuthNewOut> => {
  return api.post(
    "/auth/new",
    { body: {} },
    {
      cache: "no-store",
      headers: {
        "X-Bypass-Cache": "1",
      },
    }
  );
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

/** ---- Server renders client with typed data and actions ---- */
export default async function AuthCreatePage() {
  // Access control handled server-side in layout
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  // Fetch default auth detail
  const authDetailDefault = await getAuthDefault();

  return (
    <div className="space-y-6" data-page="auth-create">
      <Auth
        mode="create"
        authDetailDefault={authDetailDefault}
        createAuthAction={createAuth}
      />
    </div>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type { AuthNewIn, AuthNewOut, CreateAuthIn, CreateAuthOut };
