/**
 * app/(main)/health/page.tsx
 * System health page for the user.
 * @AshokSaravanan222 & @siladiea
 * 06/18/2025
 */
import Logs from "@/components/artifacts/health/Logs";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { isHardRefresh } from "@/lib/cache-utils";
import {
  computeAnalyticsDefaults,
  resolveAnalyticsFilters,
} from "@/lib/search-params/analytics-defaults";
import type { Metadata } from "next";
import { cache } from "react";
import { loadHealthSearchParams } from "@/lib/search-params/health";

/** ---- Strong types from OpenAPI ---- */
type HealthBundleIn = InputOf<"/api/v4/artifacts/health/get", "post">;
type HealthBundleOut = OutputOf<"/api/v4/artifacts/health/get", "post">;

/** ---- Cached fetch used by page (prevents duplicate requests) ---- */
const getHealthBundle = cache(
  async (input: HealthBundleIn): Promise<HealthBundleOut> => {
    const bypassCache = await isHardRefresh();

    return api.post("/artifacts/health/get", input, {
      cache: "no-store",
      ...(bypassCache && {
        headers: {
          "X-Bypass-Cache": "1",
        },
      }),
    });
  },
);

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Health",
    description:
      "System health monitoring and diagnostics for teaching assistant training platform. Monitor platform performance, check system status, and maintain operational health for educational institutions and L&D programs.",
  };
}

interface HealthPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function HealthPage({ searchParams }: HealthPageProps) {
  // Parse search params via nuqs loader
  const q = loadHealthSearchParams(await searchParams);

  // Compute defaults and resolve filters (only startDate/endDate used for health)
  const { defaults, profileContext } = await computeAnalyticsDefaults();
  const filters = resolveAnalyticsFilters(q, defaults, profileContext);

  // Fetch bundle data server-side (for KPIs and metrics)
  const bundleData = await getHealthBundle({
    body: {
      date_from: filters.startDate,
      date_to: filters.endDate,
    },
  });

  return (
    <div className="space-y-6">
      <Logs bundleData={bundleData} />
    </div>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type { HealthBundleIn, HealthBundleOut };
