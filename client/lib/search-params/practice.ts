/**
 * Server-side search params schema for the practice page.
 * Uses nuqs/server for type-safe URL search param parsing.
 */

import {
  analyticsSearchParams,
  historySearchParams,
} from "@/lib/search-params/analytics";
import { createLoader } from "nuqs/server";

export const practiceSearchParams = {
  ...analyticsSearchParams,
  ...historySearchParams,
};

export const loadPracticeSearchParams = createLoader(practiceSearchParams);
