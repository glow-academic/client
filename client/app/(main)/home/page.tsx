/**
 * app/(main)/home/page.tsx
 * Home page for the user.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import { getSession } from "@/auth";

import Home from "@/components/home/Home";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { searchParamsToFilters } from "@/utils/analytics-filters";
import type { Metadata } from "next";
import { revalidateTag } from "next/cache";

/** ---- Strong types from OpenAPI ---- */
type HomeIn = InputOf<"/api/v3/home", "post">;
type HomeOut = OutputOf<"/api/v3/home", "post">;

/** ---- Inline filters function for home page ---- */
async function getHomeFilters(searchParams?: URLSearchParams) {
  const session = await getSession();

  // Fetch profile context to get earliestAttemptDate
  const profileContext = await api.post("/profile/context", {
    body: {
      actualProfileId: session?.user?.profileId || "",
      effectiveProfileId: session?.effectiveProfileId || "",
      pathname: "/",
    },
  });

  // Compute startDate using same logic as analytics context
  let startDate: Date;
  if (profileContext.earliestAttemptDate) {
    startDate = new Date(profileContext.earliestAttemptDate);
    startDate.setHours(0, 0, 0, 0);
  } else {
    // Fallback to 30 days ago (matching analytics context)
    startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    startDate.setHours(0, 0, 0, 0);
  }

  const endDate = new Date();
  endDate.setHours(23, 59, 59, 999);

  const defaults = {
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    cohortIds: [] as string[],
    roles: [] as string[],
    simulationFilters: ["general" as const],
    departmentIds: [] as string[],
  };

  // If search params are provided, merge them with defaults
  let filters = defaults;
  if (searchParams) {
    const parsedFilters = searchParamsToFilters(searchParams, defaults);
    filters = {
      startDate: parsedFilters.startDate || defaults.startDate,
      endDate: parsedFilters.endDate || defaults.endDate,
      cohortIds: parsedFilters.cohortIds || defaults.cohortIds,
      roles: parsedFilters.roles || defaults.roles,
      simulationFilters: (parsedFilters.simulationFilters ||
        defaults.simulationFilters) as typeof defaults.simulationFilters,
      departmentIds: parsedFilters.departmentIds || defaults.departmentIds,
    };
  }

  // Always use non-empty arrays: if selected filters are empty, use all IDs from profile context
  const cohortIds =
    filters.cohortIds && filters.cohortIds.length > 0
      ? filters.cohortIds
      : profileContext.cohortIds || [];
  const departmentIds =
    filters.departmentIds && filters.departmentIds.length > 0
      ? filters.departmentIds
      : profileContext.departmentIds || [];

  return {
    ...filters,
    cohortIds,
    departmentIds,
  };
}

export const metadata: Metadata = {
  title: "Home",
  description: `Home page for GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
};

/** ---- Server action to revalidate attempt cache when simulation starts ---- */
export async function revalidateAttempt(attemptId: string): Promise<void> {
  "use server";
  // Invalidate attempt-level cache
  revalidateTag("attempts");
  revalidateTag(`attempt:${attemptId}`);
  // Note: Chat-specific tags can be added here if chat IDs are known
  // For now, invalidating attempt-level cache ensures all chats refresh
}

interface HomePageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const session = await getSession();

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
  const defaultFilters = await getHomeFilters(
    searchParamsObj.toString() ? searchParamsObj : undefined
  );

  // Extract subset for Home: startDate, endDate (required)
  // Always include cohortIds and departmentIds (they are guaranteed to be non-empty from getHomeFilters)
  const homeFiltersBody: HomeIn["body"] = {
    startDate: defaultFilters.startDate,
    endDate: defaultFilters.endDate,
    cohortIds: defaultFilters.cohortIds, // Always non-empty
    departmentIds: defaultFilters.departmentIds, // Always non-empty
  };

  // profileId is left empty/null for main home metrics
  // historyProfileId is used only for history showRetry calculation
  if (session?.effectiveProfileId) {
    homeFiltersBody.historyProfileId = session.effectiveProfileId;
  }

  const homeFilters: HomeIn = {
    body: homeFiltersBody,
  };

  // Fetch home data server-side
  const homeData = await api.post("/home", homeFilters);

  return (
    <div className="space-y-6">
      <Home homeData={homeData} revalidateAttemptAction={revalidateAttempt} />
    </div>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type { HomeIn, HomeOut };
