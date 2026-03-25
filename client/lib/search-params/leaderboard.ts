/**
 * Server-side search params schema for the leaderboard page.
 * Uses nuqs/server for type-safe URL search param parsing.
 */

import { analyticsSearchParams } from "@/lib/search-params/analytics";
import { createLoader } from "nuqs/server";

export const leaderboardSearchParams = {
  ...analyticsSearchParams,
};

export const loadLeaderboardSearchParams = createLoader(leaderboardSearchParams);
