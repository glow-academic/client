/**
 * app/(main)/analytics/reports/page.tsx
 * Reports page for the analytics section.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import ReportsPage from "@/components/reports/ReportsPage";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { getDefaultAnalyticsFilters } from "@/lib/server/analytics-filters";
import type { Metadata } from "next";
import { cache } from "react";

/** ---- Strong types from OpenAPI ---- */
type ReportsIn = InputOf<"/api/v3/reports", "post">;
type ReportsOut = OutputOf<"/api/v3/reports", "post">;

/** ---- Cached fetch used by page (prevents duplicate requests) ---- */
const getReports = cache(async (input: ReportsIn): Promise<ReportsOut> => {
  return api.post("/reports", input);
});

export const metadata: Metadata = {
  title: "Reports",
  description: `Reports in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
};

interface ReportsPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function ReportsFullPage({
  searchParams,
}: ReportsPageProps) {
  // Parse search params
  const params = await searchParams;
  const searchParamsObj = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      if (Array.isArray(value)) {
        value.forEach((v) => searchParamsObj.append(key, v));
      } else {
        searchParamsObj.set(key, value);
      }
    }
  });

  // Get filters from search params or defaults
  const filters = await getDefaultAnalyticsFilters(
    searchParamsObj.toString() ? searchParamsObj : undefined,
  );

  // Fetch reports data server-side
  const reportsData = await getReports({
    body: filters,
  });

  return (
    <div className="space-y-6">
      <ReportsPage reportsData={reportsData} />
    </div>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type { ReportsIn, ReportsOut };
