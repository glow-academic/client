/**
 * app/(main)/system/keys/page.tsx
 * Keys list page
 */
import { getSession } from "@/auth";

import Keys from "@/components/keys/Keys";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import type { Metadata } from "next";

/** ---- Strong types from OpenAPI ---- */
type KeysListOut = OutputOf<"/api/v3/keys/list", "post">;
type DeleteKeyIn = InputOf<"/api/v3/keys/delete", "post">;
type DeleteKeyOut = OutputOf<"/api/v3/keys/delete", "post">;

/** ---- Direct fetch (no Next.js cache) ----
 * Using cache: 'no-store' to disable Next.js default fetch caching so hard refresh works.
 * Sending X-Bypass-Cache header only on hard refresh to bypass Redis cache.
 */
const getKeysList = async (
  profileId: string
): Promise<KeysListOut> => {
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
    }
  );
};

/** ---- Strongly-typed server actions (single source of truth) ---- */
async function deleteKey(
  input: DeleteKeyIn,
): Promise<DeleteKeyOut> {
  "use server";
  const session = await getSession();
  const profileId = session?.effectiveProfileId || "guest-profile-id";
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/keys/delete", {
    ...input,
    body: { ...input.body, profileId },
  });
}

export async function generateMetadata(): Promise<Metadata> {
  const session = await getSession();
  const profileId = session?.effectiveProfileId || "guest-profile-id";

  let organizationName = "";
  let organizationDescription = "";
  try {
    const activeSettings = await api.post("/settings/active", {
      body: { profileId },
    });
    organizationName = activeSettings.organization_name || "";
    organizationDescription = activeSettings.organization_description || "";
  } catch {
    // If settings unavailable, organizationName and organizationDescription will be empty
  }

  const orgPart = organizationName
    ? ` at ${organizationName}${organizationDescription ? ` - ${organizationDescription}` : ""}`
    : "";

  return {
    title: "Keys",
    description: `Manage keys in GLOW${orgPart}.`,
  };
}

export default async function KeysPage() {
  const session = await getSession();
  const profileId = session?.effectiveProfileId || "";

  // Fetch list data server-side
  const listData = await getKeysList(profileId);

  return (
    <div className="space-y-6" data-page="keys-index">
      <Keys
        listData={listData}
        deleteKeyAction={deleteKey}
      />
    </div>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  KeysListOut,
  DeleteKeyIn,
  DeleteKeyOut,
};
