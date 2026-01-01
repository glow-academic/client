/**
 * app/(main)/system/providers/new/page.tsx
 * New provider page for the providers section.
 */

import Provider from "@/components/providers/Provider";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata } from "next";

/** ---- Strong types from OpenAPI ---- */
type ProviderNewIn = InputOf<"/api/v4/providers/new", "post">;
type ProviderNewOut = OutputOf<"/api/v4/providers/new", "post">;
type CreateProviderIn = InputOf<"/api/v4/providers/create", "post">;
type CreateProviderOut = OutputOf<"/api/v4/providers/create", "post">;

/** ---- Strongly-typed server action ---- */
async function createProvider(
  input: CreateProviderIn
): Promise<CreateProviderOut> {
  "use server";
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/providers/create", {
    ...input,
    body: { ...input.body },
  });
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "New Provider",
    description:
      "Create a new AI provider configuration for teaching assistant training platform. Configure provider settings, API endpoints, and maintain platform integrations for educational institutions and L&D programs.",
  };
}

export default async function NewProviderPage() {
  // Access control is handled server-side in layout
  // Get profileId from session

  return (
    <div
      className="space-y-6"
      data-page="provider-new"
      aria-label="Create new provider page"
    >
      <Provider createProviderAction={createProvider} />
    </div>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  CreateProviderIn,
  CreateProviderOut,
  ProviderNewIn,
  ProviderNewOut,
};
