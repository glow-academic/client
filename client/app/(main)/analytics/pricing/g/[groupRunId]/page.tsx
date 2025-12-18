/**
 * app/(main)/analytics/pricing/g/[groupRunId]/page.tsx
 * Pricing group detail page - shows multiple runs stacked.
 * @AshokSaravanan222 & @siladiea
 * 01/XX/2025
 */

import { getSession } from "@/auth";
import GroupRunMessages from "@/components/pricing/GroupRunMessages";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import type { Metadata, ResolvingMetadata } from "next";

/** ---- Strong types from OpenAPI ---- */
type PricingGroupDetailIn = InputOf<"/api/v3/pricing/detail", "post">;
type PricingGroupDetailOut = OutputOf<"/api/v3/pricing/detail", "post">;

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
  { params }: { params: Promise<{ groupRunId: string }> },
  _parent: ResolvingMetadata
): Promise<Metadata> {
  const { groupRunId } = await params;

  return {
    title: `Group ${groupRunId.substring(0, 8)}...`,
    description:
      "Group run details for teaching assistant training platform. Review cost analysis, usage metrics, and pricing data for educational institutions and L&D programs.",
  };
}

export default async function PricingGroupPage({
  params,
}: {
  params: Promise<{ groupRunId: string }>;
}) {
  const { groupRunId } = await params;

  // Access control is handled server-side in layout
  // Get profileId from session
  const session = await getSession();
  const profileId = session?.effectiveProfileId;

  if (!profileId) {
    // This should not happen due to server-side access control, but handle gracefully
    return null;
  }

  // Fetch group detail data
  const groupDetail = await getPricingGroupDetail({
    body: {
      groupRunId,
    },
  });

  return (
    <div className="space-y-6">
      <GroupRunMessages groupDetail={groupDetail} />
    </div>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type { PricingGroupDetailIn, PricingGroupDetailOut };

