/**
 * app/(main)/system/providers/p/[providerId]/page.tsx
 * Provider editing page
 */

import { UnifiedAccessDenied } from "@/components/common/layout/UnifiedAccessDenied";
import Provider from "@/components/providers/Provider";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata, ResolvingMetadata } from "next";

/** ---- Strong types from OpenAPI ---- */
type ProviderDetailIn = InputOf<"/api/v3/providers/detail", "post">;
type ProviderDetailOut = OutputOf<"/api/v3/providers/detail", "post">;

type UpdateProviderIn = InputOf<"/api/v3/providers/update", "post">;
type UpdateProviderOut = OutputOf<"/api/v3/providers/update", "post">;

/** ---- Direct fetch (no caching - source of truth) ----
 * Always bypass cache to ensure fresh data for detail/edit pages.
 */
const getProvider = async (providerId: string): Promise<ProviderDetailOut> => {
  return api.post(
    "/providers/detail",
    { body: { providerId } },
    {
      cache: "no-store",
      headers: {
        "X-Bypass-Cache": "1",
      },
    }
  );
};

/** ---- Metadata uses the same cached fetch ---- */
export async function generateMetadata(
  { params }: { params: Promise<{ providerId: string }> },
  _parent: ResolvingMetadata
): Promise<Metadata> {
  const { providerId } = await params;

  try {
    const provider = await getProvider(providerId);
    return {
      title: `${provider?.name || "Provider"}`,
      description: `${provider?.name ? `${provider.name} - ` : ""}AI provider configuration for teaching assistant training platform. Manage provider settings, API endpoints, and platform integrations for educational institutions and L&D programs.`,
    };
  } catch {
    // Fall through to default metadata
  }

  return {
    title: "Provider",
    description:
      "AI provider configuration for teaching assistant training platform. Manage provider settings, API endpoints, and platform integrations for educational institutions and L&D programs.",
  };
}

/** ---- Server renders client with typed data (read-only, mutations in child components) ---- */
export default async function EditProviderPage({
  params,
}: {
  params: Promise<{ providerId: string }>;
}) {
  const { providerId } = await params;
  // Access control is handled server-side in layout
  // Get profileId from session

  // Fetch data for edit mode
  try {
    const providerDetail = await getProvider(providerId).catch(() => null);

    if (!providerDetail) {
      throw new Error("Provider not found");
    }

    return (
      <div
        className="space-y-6"
        data-page="provider-edit"
        data-provider-id={providerId}
      >
        <Provider
          providerId={providerId}
          providerDetail={providerDetail}
          updateProviderAction={updateProvider}
        />
      </div>
    );
  } catch (error: unknown) {
    // Check if it's a 403 error (department access denied)
    if (
      error &&
      typeof error === "object" &&
      "status" in error &&
      error.status === 403
    ) {
      return (
        <UnifiedAccessDenied
          reason="department"
          resourceType="provider"
          redirectPath="/system/providers"
        />
      );
    }
    // Re-throw other errors
    throw error;
  }
}

/** ---- Strongly-typed server actions (single source of truth) ---- */
async function updateProvider(
  input: UpdateProviderIn
): Promise<UpdateProviderOut> {
  "use server";
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/providers/update", {
    ...input,
    body: { ...input.body },
  });
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  ProviderDetailIn,
  ProviderDetailOut,
  UpdateProviderIn,
  UpdateProviderOut,
};
