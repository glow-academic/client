/**
 * Server-side search params schema for the health page.
 * Uses nuqs/server for type-safe URL search param parsing.
 * This file should only be imported by server components.
 */

import { analyticsSearchParams } from "@/lib/search-params/analytics";
import { createLoader } from "nuqs/server";

export const healthSearchParams = {
  ...analyticsSearchParams,
};

export const loadHealthSearchParams = createLoader(healthSearchParams);
