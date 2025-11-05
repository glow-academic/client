/**
 * app/(main)/analytics/reports/p/[profileId]/page.tsx
 * Reports page for the user.
 * @AshokSaravanan222 & @siladiea
 * 06/08/2025
 */

import Report from "@/components/reports/Report";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import { getDefaultAnalyticsFilters } from "@/lib/server/analytics-filters";
import type { Metadata, ResolvingMetadata } from "next";
import { cache } from "react";

/** ---- Strong types from OpenAPI ---- */
type ProfileDetailIn = InputOf<"/api/v3/profile/staff/detail", "post">;
type ProfileDetailOut = OutputOf<"/api/v3/profile/staff/detail", "post">;
type DashboardIn = InputOf<"/api/v3/dashboard", "post">;
type DashboardOut = OutputOf<"/api/v3/dashboard", "post">;

/** ---- Cached fetch used by page (prevents duplicate requests) ---- */
const getProfileDetail = cache(
  async (input: ProfileDetailIn): Promise<ProfileDetailOut> => {
    return api.post("/profile/staff/detail", input);
  }
);

const getDashboard = cache(
  async (input: DashboardIn): Promise<DashboardOut> => {
    return api.post("/dashboard", input);
  }
);

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

  // Get filters from search params or defaults, then set profileId
  const defaultFilters = await getDefaultAnalyticsFilters(
    searchParamsObj.toString() ? searchParamsObj : undefined
  );
  const dashboardFilters = { ...defaultFilters, profileId };

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
