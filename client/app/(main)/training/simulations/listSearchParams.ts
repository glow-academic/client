/**
 * Server-side search params schema for simulations list page
 * Uses nuqs/server for type-safe URL search param parsing
 * This file should only be imported by server components
 */

import {
  createLoader,
  parseAsArrayOf,
  parseAsInteger,
  parseAsString,
} from "nuqs/server";

export const simulationsListSearchParams = {
  search: parseAsString,
  scenarioIds: parseAsArrayOf(parseAsString),
  cohortIds: parseAsArrayOf(parseAsString),
  departmentIds: parseAsArrayOf(parseAsString),
  scenarioSearch: parseAsString,
  cohortSearch: parseAsString,
  departmentSearch: parseAsString,
  page: parseAsInteger,
  pageSize: parseAsInteger,
};

export const loadSimulationsListSearchParams = createLoader(simulationsListSearchParams);
