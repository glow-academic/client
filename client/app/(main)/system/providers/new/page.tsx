/**
 * app/(main)/system/providers/new/page.tsx
 * New provider page for the providers section.
 */

import Provider from "@/components/providers/Provider";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { getSession } from "@/auth";
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
  const session = await getSession();
  const profileId = session?.effectiveProfileId;
  if (!profileId) {
    throw new Error("Authentication required");
  }
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/providers/create", {
    ...input,
    body: { ...input.body, profileId },
  });
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "New Provider",
    description: "Create a new AI provider configuration for teaching assistant training platform. Configure provider settings, API endpoints, and maintain platform integrations for educational institutions and L&D programs.",
  };
}

export default async function NewProviderPage() {
  // Access control is handled server-side in layout
  // Get profileId from session
  const session = await getSession();
  const profileId = session?.effectiveProfileId;

  if (!profileId) {
    // This should not happen due to server-side access control, but handle gracefully
    return null;
  }

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

