/**
 * Server-side search params schema for the home page.
 * Uses nuqs/server for type-safe URL search param parsing.
 */

import {
  analyticsSearchParams,
  historySearchParams,
} from "@/lib/search-params/analytics";
import { createLoader } from "nuqs/server";

export const homeSearchParams = {
  ...analyticsSearchParams,
  ...historySearchParams,
};

export const loadHomeSearchParams = createLoader(homeSearchParams);
