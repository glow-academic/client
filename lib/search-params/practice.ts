/**
 * Server-side search params schema for the practice page.
 * Uses nuqs/server for type-safe URL search param parsing.
 */

import {
  analyticsSearchParams,
  historySearchParams,
} from "@/lib/search-params/analytics";
import { createLoader, parseAsString } from "nuqs/server";

export const practiceSearchParams = {
  ...analyticsSearchParams,
  ...historySearchParams,
  groupId: parseAsString,
  groupSearch: parseAsString,
};

export const loadPracticeSearchParams = createLoader(practiceSearchParams);
