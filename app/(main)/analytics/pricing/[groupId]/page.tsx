/**
 * app/(main)/group/[groupId]/page.tsx
 * Canonical pricing group detail page — shows multiple runs stacked.
 * @AshokSaravanan222 & @siladiea
 * 01/XX/2025
 */


import Group from "@/components/artifacts/group/Group";
import { PageHeader } from "@/components/common/layout/PageHeader";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import type { Metadata } from "next";

/** ---- Strong types from OpenAPI ---- */
type PricingGroupDetailIn = InputOf<"/group/get", "post">;
type PricingGroupDetailOut = OutputOf<"/group/get", "post">;

/** ---- Direct fetch (no Next.js cache) ---- */
const getPricingGroupDetail = async (
  input: PricingGroupDetailIn
): Promise<PricingGroupDetailOut> => {
  const bypassCache = await isHardRefresh();

  return api.post("/group/get", input, {
    cache: "no-store",
    ...(bypassCache && {
      headers: {
        "X-Bypass-Cache": "1",
      },
    }),
  });
};

/** ---- Docs types for page metadata ---- */
type DocsIn = InputOf<"/pricing/docs", "post">;
type DocsOut = OutputOf<"/pricing/docs", "post">;

const getDocs = async (input: DocsIn): Promise<DocsOut> => {
  return api.post("/pricing/docs", input);
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ groupId: string }>;
}): Promise<Metadata> {
  const { groupId } = await params;
  const docs = await getDocs({ body: { entity_id: groupId } });
  return { title: docs.page_metadata?.detail.title, description: docs.page_metadata?.detail.description };
}

export default async function PricingGroupPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;

  if (!groupId) {
    return null;
  }

  const groupDetail = await getPricingGroupDetail({
    body: {
      group_id: groupId,
    },
  });

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { title: "Pricing", section: "analytics", url: "/analytics/pricing" },
          { title: "Group" },
        ]}
      />
      <div className="space-y-6 px-4 max-h-[calc(100vh-4rem)] overflow-hidden flex flex-col">
        <Group groupDetail={groupDetail} />
      </div>
    </>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type { PricingGroupDetailIn, PricingGroupDetailOut };
