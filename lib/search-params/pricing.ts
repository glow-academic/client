/**
 * Server-side search params schema for the pricing page.
 * Uses nuqs/server for type-safe URL search param parsing.
 */

import {
  analyticsSearchParams,
  parseAsCommaSeparatedArray,
} from "@/lib/search-params/analytics";
import { createLoader, parseAsInteger, parseAsString } from "nuqs/server";

export const pricingSearchParams = {
  ...analyticsSearchParams,
  pricingPage: parseAsInteger,
  pricingPageSize: parseAsInteger,
  pricingSearch: parseAsString,
  pricingModelIds: parseAsCommaSeparatedArray,
  pricingProfileIds: parseAsCommaSeparatedArray,
  pricingActorIds: parseAsCommaSeparatedArray,
  pricingSortBy: parseAsString,
  pricingSortOrder: parseAsString,
};

export const loadPricingSearchParams = createLoader(pricingSearchParams);
