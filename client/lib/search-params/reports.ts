/**
 * Server-side search params schema for the reports page.
 * Uses nuqs/server for type-safe URL search param parsing.
 */

import {
  analyticsSearchParams,
  parseAsCommaSeparatedArray,
} from "@/lib/search-params/analytics";
import { createLoader, parseAsInteger, parseAsString } from "nuqs/server";

export const reportsSearchParams = {
  ...analyticsSearchParams,
  reportsPage: parseAsInteger,
  reportsPageSize: parseAsInteger,
  reportsSearch: parseAsString,
  reportsProfileIds: parseAsCommaSeparatedArray,
  reportsSimulationIds: parseAsCommaSeparatedArray,
  reportsScenarioIds: parseAsCommaSeparatedArray,
  reportsSortBy: parseAsString,
  reportsSortOrder: parseAsString,
};

export const loadReportsSearchParams = createLoader(reportsSearchParams);
