/**
 * Server-side search params schema for the activity page.
 * Uses nuqs/server for type-safe URL search param parsing.
 */

import { createLoader, parseAsInteger, parseAsString } from "nuqs/server";

import { analyticsSearchParams } from "./analytics";

export const activitySearchParams = {
  ...analyticsSearchParams,
  activityPage: parseAsInteger,
  activityPageSize: parseAsInteger,
  activitySearch: parseAsString,
};

export const loadActivitySearchParams = createLoader(activitySearchParams);
