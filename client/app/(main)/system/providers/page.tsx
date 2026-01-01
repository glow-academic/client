/**
 * app/(main)/system/providers/page.tsx
 * Providers list page
 */
import Providers from "@/components/providers/Providers";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import type { Metadata } from "next";

/** ---- Strong types from OpenAPI ---- */
type ProvidersListOut = OutputOf<"/api/v4/providers/list", "post">;
type DeleteProviderIn = InputOf<"/api/v4/providers/delete", "post">;
type DeleteProviderOut = OutputOf<"/api/v4/providers/delete", "post">;

/** ---- Direct fetch (no Next.js cache) ----
 * Using cache: 'no-store' to disable Next.js default fetch caching so hard refresh works.
 * Sending X-Bypass-Cache header only on hard refresh to bypass Redis cache.
 */
const getProvidersList = async (): Promise<ProvidersListOut> => {
  const bypassCache = await isHardRefresh();
  return api.post(
    "/providers/list",
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
async function deleteProvider(
  input: DeleteProviderIn
): Promise<DeleteProviderOut> {
  "use server";
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/providers/delete", {
    ...input,
    body: { ...input.body },
  });
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Providers",
    description:
      "Manage AI providers and their configurations for teaching assistant training platform. Configure provider settings, API endpoints, and maintain platform integrations for educational institutions and L&D programs.",
  };
}

export default async function ProvidersPage() {
  // Access control is handled server-side in layout
  // Get profileId from session

  // Fetch list data server-side
  const listData = await getProvidersList();

  return (
    <div className="space-y-6" data-page="providers-index">
      <Providers listData={listData} deleteProviderAction={deleteProvider} />
    </div>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type { DeleteProviderIn, DeleteProviderOut, ProvidersListOut };
