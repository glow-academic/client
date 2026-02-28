/**
 * app/(main)/analytics/pricing/page.tsx
 * Pricing page for the user.
 * @AshokSaravanan222 & @siladiea
 * 08/10/2025
 */

import { PricingRunsClient } from "@/components/artifacts/pricing/PricingRunsClient";
import { PricingSummary } from "@/components/artifacts/pricing/PricingSummary";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import { readViewCookie } from "@/lib/view-cookie";
import {
  computeAnalyticsDefaults,
  resolveAnalyticsFilters,
} from "@/lib/search-params/analytics-defaults";
import type { Metadata } from "next";
import { loadPricingSearchParams } from "@/lib/search-params/pricing";

/** ---- Strong types from OpenAPI ---- */
type PricingIn = InputOf<"/api/v4/artifacts/pricing/get", "post">;
type PricingOut = OutputOf<"/api/v4/artifacts/pricing/get", "post">;
type PricingRunsOut = NonNullable<PricingOut["history"]>;

/** ---- Direct fetch (no Next.js cache) ---- */
const getPricingAnalytics = async (input: PricingIn): Promise<PricingOut> => {
  const bypassCache = await isHardRefresh();

  return api.post("/artifacts/pricing/get", input, {
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

export async function generateMetadata(): Promise<Metadata> {
  const docs = await getDocs({ body: {} });
  return { title: docs.list.title, description: docs.list.description };
}

interface PricingPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function PricingPage({ searchParams }: PricingPageProps) {
  // Parse search params via nuqs loader
  const q = loadPricingSearchParams(await searchParams);

  // Compute defaults and resolve filters
  const { defaults, profileContext } = await computeAnalyticsDefaults();
  const filters = resolveAnalyticsFilters(q, defaults, profileContext);

  // Pricing-specific params with defaults
  const pricingPage = q.pricingPage ?? 0;
  const pricingPageSize = q.pricingPageSize ?? 10;
  const pricingModelIds = q.pricingModelIds ?? undefined;
  const pricingSortBy = q.pricingSortBy ?? "date";
  const pricingSortOrder = q.pricingSortOrder ?? "desc";

  // Map frontend sort field to backend field name
  const sortBy = pricingSortBy === "createdAt" ? "date" : pricingSortBy;

  // Use first model ID if provided (endpoint accepts single model_id)
  const modelId = pricingModelIds?.[0] ?? null;

  // Read view cookie for column visibility
  const initialColumnVisibility = await readViewCookie("pricing");

  // Fetch summary + embedded group history in a single API call
  const pricingData = await getPricingAnalytics({
    body: {
      start_date: filters.startDate,
      end_date: filters.endDate,
      department_ids: filters.departmentIds,
      roles: filters.roles,
      page_limit: 100,
      page_offset: 0,
      // Embedded group history params
      history_page: pricingPage,
      history_page_size: pricingPageSize,
      history_sort_by: sortBy,
      history_sort_order: pricingSortOrder,
      history_model_id: modelId,
    },
  });

  // Extract embedded history or use empty fallback
  const runsData: PricingRunsOut = pricingData.history ?? {
    items: [],
    total_count: 0,
  };

  return (
    <div className="space-y-6" data-page="pricing-index">
      <PricingSummary pricingData={pricingData} />
      <PricingRunsClient runsData={runsData} isLoading={false} initialColumnVisibility={initialColumnVisibility} />
    </div>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type { PricingIn, PricingOut, PricingRunsOut };
