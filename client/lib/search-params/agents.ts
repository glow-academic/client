/**
 * Server-side search params schema for agents list page
 * Uses nuqs/server for type-safe URL search param parsing
 * This file should only be imported by server components
 */

import {
  createLoader,
  parseAsArrayOf,
  parseAsInteger,
  parseAsString,
} from "nuqs/server";

export const agentsSearchParams = {
  search: parseAsString,
  departmentIds: parseAsArrayOf(parseAsString),
  modelIds: parseAsArrayOf(parseAsString),
  toolIds: parseAsArrayOf(parseAsString),
  departmentSearch: parseAsString,
  modelSearch: parseAsString,
  toolSearch: parseAsString,
  page: parseAsInteger,
  pageSize: parseAsInteger,
};

export const loadAgentsSearchParams = createLoader(agentsSearchParams);
