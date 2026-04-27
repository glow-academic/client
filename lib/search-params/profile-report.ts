/**
 * Server-side search params schema for the profile report page.
 * Uses nuqs/server for type-safe URL search param parsing.
 */

import {
  analyticsSearchParams,
  dashboardSectionSearchParams,
  historySearchParams,
} from "@/lib/search-params/analytics";
import { createLoader, parseAsString } from "nuqs/server";

export const profileReportSearchParams = {
  ...analyticsSearchParams,
  ...historySearchParams,
  ...dashboardSectionSearchParams,
  groupId: parseAsString,
  groupSearch: parseAsString,
};

export const loadProfileReportSearchParams = createLoader(
  profileReportSearchParams,
);
