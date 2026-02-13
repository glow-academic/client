/**
 * Server-side search params schema for the analytics dashboard page.
 * Uses nuqs/server for type-safe URL search param parsing.
 * This file should only be imported by server components.
 */

import {
  analyticsSearchParams,
  dashboardSectionSearchParams,
  historySearchParams,
} from "@/lib/search-params/analytics";
import { createLoader, parseAsString } from "nuqs/server";

export const dashboardSearchParams = {
  ...analyticsSearchParams,
  ...historySearchParams,
  ...dashboardSectionSearchParams,
  _refresh: parseAsString,
};

export const loadDashboardSearchParams = createLoader(dashboardSearchParams);
