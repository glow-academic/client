/**
 * app/(main)/system/providers/page.tsx
 * Providers list page
 */
import Providers from "@/components/providers/Providers";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import { getSession } from "@/auth";
import type { Metadata } from "next";

/** ---- Strong types from OpenAPI ---- */
type ProvidersListOut = OutputOf<"/api/v3/providers/list", "post">;
type DeleteProviderIn = InputOf<"/api/v3/providers/delete", "post">;
type DeleteProviderOut = OutputOf<"/api/v3/providers/delete", "post">;

/** ---- Direct fetch (no Next.js cache) ----
 * Using cache: 'no-store' to disable Next.js default fetch caching so hard refresh works.
 * Sending X-Bypass-Cache header only on hard refresh to bypass Redis cache.
 */
const getProvidersList = async (profileId: string): Promise<ProvidersListOut> => {
  const bypassCache = await isHardRefresh();
  return api.post(
    "/providers/list",
    { body: { profileId } },
    {
      cache: "no-store",
      ...(bypassCache && {
        headers: {
          "X-Bypass-Cache": "1",
        },
      }),
    },
  );
};

/** ---- Strongly-typed server actions (single source of truth) ---- */
async function deleteProvider(input: DeleteProviderIn): Promise<DeleteProviderOut> {
  "use server";
  const authResult = await requireAuthenticated();
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/providers/delete", {
    ...input,
    body: { ...input.body, profileId: authResult.effectiveProfileId },
  });
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Providers",
    description: "Manage AI providers and their configurations for teaching assistant training platform. Configure provider settings, API endpoints, and maintain platform integrations for educational institutions and L&D programs.",
  };
}

export default async function ProvidersPage() {
  // Access control is handled server-side in layout
  // Get profileId from session
  const session = await getSession();
  const profileId = session?.effectiveProfileId;

  if (!profileId) {
    // This should not happen due to server-side access control, but handle gracefully
    return null;
  }

  // Fetch list data server-side
  const listData = await getProvidersList(profileId);

  return (
    <div className="space-y-6" data-page="providers-index">
      <Providers listData={listData} deleteProviderAction={deleteProvider} />
    </div>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type { ProvidersListOut, DeleteProviderIn, DeleteProviderOut };

