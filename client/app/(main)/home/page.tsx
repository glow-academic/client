/**
 * app/(main)/home/page.tsx
 * Home page for the user.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import { auth } from "@/auth";
import Home from "@/components/home/Home";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { getDefaultAnalyticsFilters } from "@/lib/server/analytics-filters";
import type { Metadata } from "next";
import { cache } from "react";

/** ---- Strong types from OpenAPI ---- */
type HomeIn = InputOf<"/api/v3/home", "post">;
type HomeOut = OutputOf<"/api/v3/home", "post">;

/** ---- Cached fetch used by page (prevents duplicate requests) ---- */
const getHome = cache(async (input: HomeIn): Promise<HomeOut> => {
  return api.post("/home", input);
});

export const metadata: Metadata = {
  title: "Home",
  description: `Home page for GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
};

interface HomePageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const session = await auth();

  // Parse search params
  const paramsObj = await searchParams;
  const searchParamsObj = new URLSearchParams();
  Object.entries(paramsObj).forEach(([key, value]) => {
    if (value) {
      if (Array.isArray(value)) {
        value.forEach((v) => searchParamsObj.append(key, v));
      } else {
        searchParamsObj.set(key, value);
      }
    }
  });

  // Get filters from search params or defaults, then subset to Home fields
  const defaultFilters = await getDefaultAnalyticsFilters(
    searchParamsObj.toString() ? searchParamsObj : undefined
  );

  // Extract subset for Home: startDate, endDate (required)
  // Only include optional fields if they have values
  const homeFiltersBody: HomeIn["body"] = {
    startDate: defaultFilters.startDate,
    endDate: defaultFilters.endDate,
  };

  // Add optional fields only if they have values
  if (defaultFilters.cohortIds && defaultFilters.cohortIds.length > 0) {
    homeFiltersBody.cohortIds = defaultFilters.cohortIds;
  }
  if (session?.effectiveProfileId) {
    homeFiltersBody.profileId = session.effectiveProfileId;
  }
  if (defaultFilters.departmentIds && defaultFilters.departmentIds.length > 0) {
    homeFiltersBody.departmentIds = defaultFilters.departmentIds;
  }

  const homeFilters: HomeIn = {
    body: homeFiltersBody,
  };

  // Fetch home data server-side
  const homeData = await getHome(homeFilters);

  return (
    <div className="space-y-6">
      <Home homeData={homeData} />
    </div>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type { HomeIn, HomeOut };
