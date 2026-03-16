/**
 * Server-side search params schema for evals list page
 * Uses nuqs/server for type-safe URL search param parsing
 * This file should only be imported by server components
 */

import {
  createLoader,
  parseAsArrayOf,
  parseAsInteger,
  parseAsString,
} from "nuqs/server";

export const evalsSearchParams = {
  search: parseAsString,
  departmentIds: parseAsArrayOf(parseAsString),
  departmentSearch: parseAsString,
  page: parseAsInteger,
  pageSize: parseAsInteger,
};

export const loadEvalsSearchParams = createLoader(evalsSearchParams);
