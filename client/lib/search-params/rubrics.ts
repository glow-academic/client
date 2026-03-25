/**
 * Server-side search params schema for rubrics list page
 * Uses nuqs/server for type-safe URL search param parsing
 * This file should only be imported by server components
 */

import {
  createLoader,
  parseAsArrayOf,
  parseAsInteger,
  parseAsString,
} from "nuqs/server";

export const rubricsSearchParams = {
  search: parseAsString,
  departmentIds: parseAsArrayOf(parseAsString),
  simulationIds: parseAsArrayOf(parseAsString),
  departmentSearch: parseAsString,
  simulationSearch: parseAsString,
  page: parseAsInteger,
  pageSize: parseAsInteger,
};

export const loadRubricsSearchParams = createLoader(rubricsSearchParams);
