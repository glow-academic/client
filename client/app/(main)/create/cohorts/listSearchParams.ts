/**
 * Server-side search params schema for cohorts list page
 * Uses nuqs/server for type-safe URL search param parsing
 * This file should only be imported by server components
 */

import {
  createLoader,
  parseAsArrayOf,
  parseAsInteger,
  parseAsString,
} from "nuqs/server";

export const cohortsListSearchParams = {
  search: parseAsString,
  simulationIds: parseAsArrayOf(parseAsString),
  profileIds: parseAsArrayOf(parseAsString),
  departmentIds: parseAsArrayOf(parseAsString),
  simulationSearch: parseAsString,
  profileSearch: parseAsString,
  departmentSearch: parseAsString,
  page: parseAsInteger,
  pageSize: parseAsInteger,
};

export const loadCohortsListSearchParams = createLoader(cohortsListSearchParams);
