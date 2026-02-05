/**
 * Server-side search params schema for the benchmark page.
 * Uses nuqs/server for type-safe URL search param parsing.
 */

import { parseAsCommaSeparatedArray } from "@/lib/search-params/analytics";
import {
  createLoader,
  parseAsBoolean,
  parseAsInteger,
  parseAsString,
} from "nuqs/server";

export const benchmarkSearchParams = {
  historyPage: parseAsInteger,
  historyPageSize: parseAsInteger,
  historySearch: parseAsString,
  historyEvalIds: parseAsCommaSeparatedArray,
  historyStatus: parseAsString,
  historyArchived: parseAsBoolean,
  historySortBy: parseAsString,
  historySortOrder: parseAsString,
};

export const loadBenchmarkSearchParams = createLoader(benchmarkSearchParams);
