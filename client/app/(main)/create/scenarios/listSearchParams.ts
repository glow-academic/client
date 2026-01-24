/**
 * Server-side search params schema for scenarios list page
 * Uses nuqs/server for type-safe URL search param parsing
 * This file should only be imported by server components
 */

import {
  createLoader,
  parseAsArrayOf,
  parseAsInteger,
  parseAsString,
} from "nuqs/server";

export const scenariosListSearchParams = {
  search: parseAsString,
  personaIds: parseAsArrayOf(parseAsString),
  simulationIds: parseAsArrayOf(parseAsString),
  departmentIds: parseAsArrayOf(parseAsString),
  personaSearch: parseAsString,
  simulationSearch: parseAsString,
  departmentSearch: parseAsString,
  page: parseAsInteger,
  pageSize: parseAsInteger,
};

export const loadScenariosListSearchParams = createLoader(scenariosListSearchParams);
