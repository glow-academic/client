/**
 * Server-side search params schema for tools list page
 * Uses nuqs/server for type-safe URL search param parsing
 * This file should only be imported by server components
 */

import {
  createLoader,
  parseAsArrayOf,
  parseAsInteger,
  parseAsString,
} from "nuqs/server";

export const toolsSearchParams = {
  search: parseAsString,
  departmentIds: parseAsArrayOf(parseAsString),
  agentIds: parseAsArrayOf(parseAsString),
  creatableIds: parseAsArrayOf(parseAsString),
  departmentSearch: parseAsString,
  agentSearch: parseAsString,
  page: parseAsInteger,
  pageSize: parseAsInteger,
};

export const loadToolsSearchParams = createLoader(toolsSearchParams);
