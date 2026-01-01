/**
 * app/(main)/analytics/pricing/g/[groupId]/page.tsx
 * Pricing group detail page - shows multiple runs stacked.
 * @AshokSaravanan222 & @siladiea
 * 01/XX/2025
 */

import { getSession } from "@/auth";
import GroupMessages from "@/components/pricing/GroupMessages";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import type { Metadata, ResolvingMetadata } from "next";

/** ---- Strong types from OpenAPI ---- */
type PricingGroupDetailIn = InputOf<"/api/v4/pricing/detail", "post">;
type PricingGroupDetailOut = OutputOf<"/api/v4/pricing/detail", "post">;

/** ---- Direct fetch (no Next.js cache) ----
 * Using cache: 'no-store' to disable Next.js default fetch caching so hard refresh works.
 * Sending X-Bypass-Cache header only on hard refresh to bypass Redis cache.
 */
const getPricingGroupDetail = async (
  input: PricingGroupDetailIn
): Promise<PricingGroupDetailOut> => {
  const bypassCache = await isHardRefresh();

  return api.post("/pricing/detail", input, {
    cache: "no-store",
    ...(bypassCache && {
      headers: {
        "X-Bypass-Cache": "1",
      },
    }),
  });
};

export async function generateMetadata(
  { params }: { params: Promise<{ groupId: string }> },
  _parent: ResolvingMetadata
): Promise<Metadata> {
  const { groupId } = await params;

  return {
    title: `Group ${groupId.substring(0, 8)}...`,
    description:
      "Group run details for teaching assistant training platform. Review cost analysis, usage metrics, and pricing data for educational institutions and L&D programs.",
  };
}

export default async function PricingGroupPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;

  // Access control is handled server-side in layout
  // Get profileId from session
  const session = await getSession();
  const profileId = session?.effectiveProfileId;

  if (!profileId || !groupId) {
    // This should not happen due to server-side access control, but handle gracefully
    return null;
  }

  // Fetch group detail data
  // Convert camelCase to snake_case for API
  const groupDetail = await getPricingGroupDetail({
    body: {
      group_id: groupId,
    },
  });

  return (
    <div className="space-y-6 max-h-[calc(100vh-4rem)] overflow-hidden flex flex-col">
      <GroupMessages groupDetail={groupDetail} />
    </div>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type { PricingGroupDetailIn, PricingGroupDetailOut };
