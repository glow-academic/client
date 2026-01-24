/**
 * Server-side search params schema for personas list page
 * Uses nuqs/server for type-safe URL search param parsing
 * This file should only be imported by server components
 */

import {
  createLoader,
  parseAsArrayOf,
  parseAsInteger,
  parseAsString,
} from "nuqs/server";

export const personasSearchParams = {
  search: parseAsString,
  scenarioIds: parseAsArrayOf(parseAsString),
  fieldIds: parseAsArrayOf(parseAsString),
  departmentIds: parseAsArrayOf(parseAsString),
  scenarioSearch: parseAsString,
  fieldSearch: parseAsString,
  departmentSearch: parseAsString,
  page: parseAsInteger,
  pageSize: parseAsInteger,
};

export const loadPersonasSearchParams = createLoader(personasSearchParams);
