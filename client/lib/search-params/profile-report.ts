/**
 * Server-side search params schema for the profile report page.
 * Uses nuqs/server for type-safe URL search param parsing.
 */

import {
  analyticsSearchParams,
  dashboardSectionSearchParams,
  historySearchParams,
} from "@/lib/search-params/analytics";
import { createLoader } from "nuqs/server";

export const profileReportSearchParams = {
  ...analyticsSearchParams,
  ...historySearchParams,
  ...dashboardSectionSearchParams,
};

export const loadProfileReportSearchParams = createLoader(
  profileReportSearchParams,
);
