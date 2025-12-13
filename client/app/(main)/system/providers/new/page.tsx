/**
 * app/(main)/system/providers/new/page.tsx
 * New provider page for the providers section.
 */

import Provider from "@/components/providers/Provider";
import { AccessDenied } from "@/components/common/layout/AccessDenied";
import { api } from "@/lib/api/client";
import { requireAuthenticated } from "@/lib/auth-helpers";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";

/** ---- Strong types from OpenAPI ---- */
type ProviderNewIn = InputOf<"/api/v3/providers/new", "post">;
type ProviderNewOut = OutputOf<"/api/v3/providers/new", "post">;
type CreateProviderIn = InputOf<"/api/v3/providers/create", "post">;
type CreateProviderOut = OutputOf<"/api/v3/providers/create", "post">;

/** ---- Direct fetch (no caching - source of truth) ----
 * Always bypass cache to ensure fresh data for detail/edit pages.
 */
const getProviderDefault = async (profileId: string): Promise<ProviderNewOut> => {
  return api.post(
    "/providers/new",
    { body: { profileId } },
    {
      cache: "no-store",
      headers: {
        "X-Bypass-Cache": "1",
      },
    },
  );
};

/** ---- Strongly-typed server action ---- */
async function createProvider(input: CreateProviderIn): Promise<CreateProviderOut> {
  "use server";
  const authResult = await requireAuthenticated();
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/providers/create", {
    ...input,
    body: { ...input.body, profileId: authResult.effectiveProfileId },
  });
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "New Provider",
    description: "Create a new AI provider configuration for teaching assistant training platform. Configure provider settings, API endpoints, and maintain platform integrations for educational institutions and L&D programs.",
  };
}

export default async function NewProviderPage() {
  const authResult = await requireAuthenticated().catch(() => null);
  if (!authResult) {
    return <AccessDenied redirectPath="/system/providers" />;
  }

  const profileId = authResult.effectiveProfileId;

  // Fetch provider default data (for dropdowns and defaults)
  const providerDetailDefault = await getProviderDefault(profileId);

  return (
    <div
      className="space-y-6"
      data-page="provider-new"
      aria-label="Create new provider page"
    >
      <Provider providerDetailDefault={providerDetailDefault} createProviderAction={createProvider} />
    </div>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type { CreateProviderIn, CreateProviderOut, ProviderNewIn, ProviderNewOut };

