/**
 * Server-side search params schema for models list page
 * Uses nuqs/server for type-safe URL search param parsing
 * This file should only be imported by server components
 */

import {
  createLoader,
  parseAsArrayOf,
  parseAsInteger,
  parseAsString,
} from "nuqs/server";

export const modelsSearchParams = {
  search: parseAsString,
  providerIds: parseAsArrayOf(parseAsString),
  departmentIds: parseAsArrayOf(parseAsString),
  agentIds: parseAsArrayOf(parseAsString),
  providerSearch: parseAsString,
  departmentSearch: parseAsString,
  agentSearch: parseAsString,
  page: parseAsInteger,
  pageSize: parseAsInteger,
};

export const loadModelsSearchParams = createLoader(modelsSearchParams);
