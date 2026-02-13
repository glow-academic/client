/**
 * app/(main)/analytics/pricing/[groupId]/page.tsx
 * Pricing group detail page - shows multiple runs stacked.
 * @AshokSaravanan222 & @siladiea
 * 01/XX/2025
 */

import { getSession } from "@/auth";
import GroupMessages from "@/components/artifacts/pricing/GroupMessages";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import type { Metadata } from "next";

/** ---- Strong types from OpenAPI ---- */
type PricingGroupDetailIn = InputOf<"/api/v4/artifacts/group/get", "post">;
type PricingGroupDetailOut = OutputOf<"/api/v4/artifacts/group/get", "post">;

/** ---- Direct fetch (no Next.js cache) ----
 * Using cache: 'no-store' to disable Next.js default fetch caching so hard refresh works.
 * Sending X-Bypass-Cache header only on hard refresh to bypass Redis cache.
 */
const getPricingGroupDetail = async (
  input: PricingGroupDetailIn
): Promise<PricingGroupDetailOut> => {
  const bypassCache = await isHardRefresh();

  return api.post("/artifacts/group/get", input, {
    cache: "no-store",
    ...(bypassCache && {
      headers: {
        "X-Bypass-Cache": "1",
      },
    }),
  });
};

/** ---- Docs types for page metadata ---- */
type DocsIn = InputOf<"/api/v4/artifacts/pricing/docs", "post">;
type DocsOut = OutputOf<"/api/v4/artifacts/pricing/docs", "post">;

const getDocs = async (input: DocsIn): Promise<DocsOut> => {
  return api.post("/artifacts/pricing/docs", input);
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ groupId: string }>;
}): Promise<Metadata> {
  const { groupId } = await params;
  const docs = await getDocs({ body: { entity_id: groupId } });
  return { title: docs.detail.title, description: docs.detail.description };
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
  const profileId = session?.user?.profileId;

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
