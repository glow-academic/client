/**
 * app/(main)/analytics/reports/p/[profileId]/page.tsx
 * Reports page for the user.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import { getSession } from "@/auth";

import Report from "@/components/reports/Report";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { searchParamsToFilters } from "@/utils/analytics-filters";
import type { Metadata, ResolvingMetadata } from "next";

/** ---- Strong types from OpenAPI ---- */
type ProfileDetailIn = InputOf<"/api/v3/profile/staff/detail", "post">;
type ProfileDetailOut = OutputOf<"/api/v3/profile/staff/detail", "post">;
type DashboardIn = InputOf<"/api/v3/dashboard", "post">;
type DashboardOut = OutputOf<"/api/v3/dashboard", "post">;

/** ---- Fetch helpers used by page (prevents duplicate requests) ---- */
async function getProfileDetail(
  input: ProfileDetailIn
): Promise<ProfileDetailOut> {
  return api.post("/profile/staff/detail", input);
}

async function getDashboard(input: DashboardIn): Promise<DashboardOut> {
  return api.post("/dashboard", input);
}

/** ---- Inline filters function for profile reports page ---- */
async function getProfileReportsFilters(searchParams?: URLSearchParams) {
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

export async function generateMetadata(
  { params }: { params: Promise<{ profileId: string }> },
  _parent: ResolvingMetadata
): Promise<Metadata> {
  const { profileId } = await params;

  try {
    const profileData = await getProfileDetail({
      body: {
        profileId,
        currentProfileId: profileId,
      },
    });
    const name = profileData.name || "";
    const firstName = name.split(" ")[0] || "";
    const lastName = name.split(" ").slice(1).join(" ") || "";
    return {
      title: `${firstName} ${lastName}`,
      description: `Reports for individual staff in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
    };
  } catch {
    return {
      title: "Profile Report",
      description: `Reports for individual staff in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
    };
  }
}

interface ProfileReportsPageProps {
  params: Promise<{ profileId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function ReportsPage({
  params,
  searchParams,
}: ProfileReportsPageProps) {
  const { profileId } = await params;

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

  // Get filters from search params or defaults, then set profileId and historyProfileId
  // profileId is used for filtering main dashboard metrics for this profile
  // historyProfileId is used only for history showRetry calculation
  const defaultFilters = await getProfileReportsFilters(
    searchParamsObj.toString() ? searchParamsObj : undefined
  );
  const dashboardFilters = {
    ...defaultFilters,
    profileId, // Used for main dashboard metrics filtering
    historyProfileId: profileId, // Used for history showRetry calculation
  };

  // Fetch profile detail and dashboard data server-side
  const [profileData, dashboardData] = await Promise.all([
    getProfileDetail({
      body: {
        profileId,
        currentProfileId: profileId,
      },
    }),
    getDashboard({
      body: dashboardFilters,
    }),
  ]);

  return (
    <div className="space-y-6">
      <Report
        profileId={profileId}
        profileData={profileData}
        dashboardData={dashboardData}
      />
    </div>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type { DashboardIn, DashboardOut, ProfileDetailIn, ProfileDetailOut };
