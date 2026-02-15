/**
 * Server-side search params schema for providers list page
 * Uses nuqs/server for type-safe URL search param parsing
 * This file should only be imported by server components
 */

import {
  createLoader,
  parseAsArrayOf,
  parseAsInteger,
  parseAsString,
} from "nuqs/server";

export const providersSearchParams = {
  search: parseAsString,
  departmentIds: parseAsArrayOf(parseAsString),
  modelIds: parseAsArrayOf(parseAsString),
  statusIds: parseAsArrayOf(parseAsString),
  departmentSearch: parseAsString,
  modelSearch: parseAsString,
  page: parseAsInteger,
  pageSize: parseAsInteger,
};

export const loadProvidersSearchParams = createLoader(providersSearchParams);
