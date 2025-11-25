/**
 * app/(main)/management/policies/page.tsx
 * Policies list page
 * @AshokSaravanan222 & @siladiea
 * 12/24/2024
 */
import { getSession } from "@/auth";

import Policies from "@/components/policies/Policies";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import type { Metadata } from "next";

/** ---- Strong types from OpenAPI ---- */
type PoliciesListOut = OutputOf<"/api/v3/policies/list", "post">;
type DeletePolicyIn = InputOf<"/api/v3/policies/delete", "post">;
type DeletePolicyOut = OutputOf<"/api/v3/policies/delete", "post">;

/** ---- Direct fetch (no Next.js cache) ----
 * Using cache: 'no-store' to disable Next.js default fetch caching so hard refresh works.
 * Sending X-Bypass-Cache header only on hard refresh to bypass Redis cache.
 */
const getPoliciesList = async (
  profileId: string
): Promise<PoliciesListOut> => {
  const bypassCache = await isHardRefresh();
  return api.post(
    "/policies/list",
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
async function deletePolicy(
  input: DeletePolicyIn,
): Promise<DeletePolicyOut> {
  "use server";
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/policies/delete", input);
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
    title: "Policies",
    description: `Manage policies in GLOW${orgPart}.`,
  };
}

export default async function PoliciesPage() {
  const session = await getSession();
  const profileId = session?.effectiveProfileId || "";

  // Fetch list data server-side
  const listData = await getPoliciesList(profileId);

  return (
    <div className="space-y-6" data-page="policies-index">
      <Policies
        listData={listData}
        deletePolicyAction={deletePolicy}
      />
    </div>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  PoliciesListOut,
  DeletePolicyIn,
  DeletePolicyOut,
};

