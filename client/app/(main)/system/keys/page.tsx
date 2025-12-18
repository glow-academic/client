/**
 * app/(main)/system/keys/page.tsx
 * Keys list page
 */
import Keys from "@/components/keys/Keys";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import { getSession } from "@/auth";
import type { Metadata } from "next";

/** ---- Strong types from OpenAPI ---- */
type KeysListOut = OutputOf<"/api/v3/keys/list", "post">;
type DeleteKeyIn = InputOf<"/api/v3/keys/delete", "post">;
type DeleteKeyOut = OutputOf<"/api/v3/keys/delete", "post">;

/** ---- Direct fetch (no Next.js cache) ----
 * Using cache: 'no-store' to disable Next.js default fetch caching so hard refresh works.
 * Sending X-Bypass-Cache header only on hard refresh to bypass Redis cache.
 */
const getKeysList = async (profileId: string): Promise<KeysListOut> => {
  const bypassCache = await isHardRefresh();
  return api.post(
    "/keys/list",
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
async function deleteKey(input: DeleteKeyIn): Promise<DeleteKeyOut> {
  "use server";
  const session = await getSession();
  const profileId = session?.effectiveProfileId;
  if (!profileId) {
    throw new Error("Authentication required");
  }
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/keys/delete", {
    ...input,
    body: { ...input.body, profileId },
  });
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Keys",
    description:
      "Manage API keys and authentication credentials for teaching assistant training platform. Configure secure access keys, manage API integrations, and maintain platform security for educational institutions and L&D programs.",
  };
}

export default async function KeysPage() {
  // Access control is handled server-side in layout
  // Get profileId from session
  const session = await getSession();
  const profileId = session?.effectiveProfileId;

  if (!profileId) {
    // This should not happen due to server-side access control, but handle gracefully
    return null;
  }

  // Fetch list data server-side
  const listData = await getKeysList(profileId);

  return (
    <div className="space-y-6" data-page="keys-index">
      <Keys listData={listData} deleteKeyAction={deleteKey} />
    </div>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type { DeleteKeyIn, DeleteKeyOut, KeysListOut };
