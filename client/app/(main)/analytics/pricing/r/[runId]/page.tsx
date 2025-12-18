/**
 * app/(main)/analytics/pricing/r/[runId]/page.tsx
 * Pricing run detail page.
 * @AshokSaravanan222 & @siladiea
 * 01/XX/2025
 */

import { getSession } from "@/auth";
import RunMessages from "@/components/pricing/RunMessages";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import type { Metadata, ResolvingMetadata } from "next";

/** ---- Strong types from OpenAPI ---- */
type PricingRunDetailIn = InputOf<"/api/v3/pricing/detail", "post">;
type PricingRunDetailOut = OutputOf<"/api/v3/pricing/detail", "post">;

/** ---- Direct fetch (no Next.js cache) ----
 * Using cache: 'no-store' to disable Next.js default fetch caching so hard refresh works.
 * Sending X-Bypass-Cache header only on hard refresh to bypass Redis cache.
 */
const getPricingRunDetail = async (
  input: PricingRunDetailIn
): Promise<PricingRunDetailOut> => {
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
  { params }: { params: Promise<{ runId: string }> },
  _parent: ResolvingMetadata
): Promise<Metadata> {
  const { runId } = await params;

  return {
    title: `Run ${runId.substring(0, 8)}...`,
    description:
      "Run details for teaching assistant training platform. Review cost analysis, usage metrics, and pricing data for educational institutions and L&D programs.",
  };
}

export default async function PricingRunPage({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  const { runId } = await params;

  // Access control is handled server-side in layout
  // Get profileId from session
  const session = await getSession();
  const profileId = session?.effectiveProfileId;

  if (!profileId) {
    // This should not happen due to server-side access control, but handle gracefully
    return null;
  }

  // Fetch run detail data
  const runDetail = await getPricingRunDetail({
    body: {
      runId,
    },
  });

  return (
    <div className="space-y-6">
      <RunMessages runDetail={runDetail} />
    </div>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type { PricingRunDetailIn, PricingRunDetailOut };
