/**
 * Server-side search params schema for the pricing group detail page.
 * Note: this is the URL query schema; the dynamic route segment named
 * `groupId` is different from `q.groupId` (the panel's user-picked
 * generation group, sourced from the URL query string).
 */
import { createLoader, parseAsString } from "nuqs/server";

export const pricingGroupSearchParams = {
  groupId: parseAsString,
  groupSearch: parseAsString,
};

export const loadPricingGroupSearchParams = createLoader(pricingGroupSearchParams);
