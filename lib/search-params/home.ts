/**
 * Server-side search params schema for the home page.
 * Uses nuqs/server for type-safe URL search param parsing.
 */

import {
  analyticsSearchParams,
  historySearchParams,
} from "@/lib/search-params/analytics";
import { createLoader, parseAsString } from "nuqs/server";

export const homeSearchParams = {
  ...analyticsSearchParams,
  ...historySearchParams,
  // Optional URL-backed group selection. Empty when the panel is on the
  // default time-windowed group (clean URL). Set when the user explicitly
  // picks a previous chat from the panel's dropdown — SSR can then
  // pre-fetch that exact group's runs, which avoids the post-hydration
  // flicker that came from selecting client-side and waiting for a
  // round-trip.
  groupId: parseAsString,
  // URL-backed search term for the panel's chat-history dropdown.
  // Mirrors the persona-page pattern (``colorSearch``, etc.): typing
  // in the search box updates the URL shallowly so the filter state
  // is sharable / refresh-stable. Empty = no filter (clean URL).
  groupSearch: parseAsString,
};

export const loadHomeSearchParams = createLoader(homeSearchParams);
