/**
 * app/(main)/cohorts/c/[cohortId]/page.tsx
 * Cohort dashboard page for the cohort.
 * @AshokSaravanan222 & @siladiea
 * 07/20/2025
 */

import { auth } from "@/auth";
import Leaderboard from "@/components/leaderboard/Leaderboard";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import type { Metadata, ResolvingMetadata } from "next";
import { cache } from "react";

/** ---- Strong types from OpenAPI ---- */
type LeaderboardIn = InputOf<"/api/v3/leaderboard", "post">;
type LeaderboardOut = OutputOf<"/api/v3/leaderboard", "post">;

type CohortDetailIn = InputOf<"/api/v3/cohorts/detail", "post">;
type CohortDetailOut = OutputOf<"/api/v3/cohorts/detail", "post">;

/** ---- Cached fetch used by both page + metadata (prevents double hit) ---- */
const getLeaderboard = cache(
  async (input: LeaderboardIn): Promise<LeaderboardOut> => {
    return api.post("/leaderboard", input);
  }
);

const getCohort = cache(
  async (input: CohortDetailIn): Promise<CohortDetailOut> => {
    return api.post("/cohorts/detail", input);
  }
);

/** ---- Metadata uses the same cached fetch ---- */
export async function generateMetadata(
  { params }: { params: Promise<{ cohortId: string }> },
  _parent: ResolvingMetadata
): Promise<Metadata> {
  const { cohortId } = await params;
  const session = await auth();
  const profileId = session?.effectiveProfileId || "";

  try {
    const cohort = await getCohort({ body: { cohortId, profileId } });
    return {
      title: `${cohort?.title || "Cohort"}`,
      description: `${cohort ? `${cohort.title} ${cohort.description || ""}` : "Cohort"} in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
    };
  } catch {
    return {
      title: "Cohort",
      description: `Cohort in GLOW (Graduate Learning Orientation Workshop) at ${process.env["NEXT_PUBLIC_CAMPUS"]}.`,
    };
  }
}

/** ---- Server renders client with typed data ---- */
export default async function CohortDashboardPage({
  params,
}: {
  params: Promise<{ cohortId: string }>;
}) {
  const { cohortId } = await params;

  // Prefetch leaderboard data with default date range (last 30 days)
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 30);

  const filters: LeaderboardIn = {
    body: {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      cohortIds: [cohortId],
      roles: [],
      simulationFilters: [],
      departmentIds: [],
    },
  };

  const leaderboardData = await getLeaderboard(filters);

  return (
    <div className="space-y-6">
      <Leaderboard
        cohortId={cohortId}
        initialLeaderboardData={leaderboardData}
      />
    </div>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type { LeaderboardIn, LeaderboardOut };
